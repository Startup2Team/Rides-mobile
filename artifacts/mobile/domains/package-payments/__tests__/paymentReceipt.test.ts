import {
  buildClaimReceipt,
  buildPurchaseReceipt,
  buildReceiptNumber,
  formatReceiptAmount,
  providerDisplayName,
  receiptFileName,
  renderReceiptHtml,
} from '../paymentReceipt';
import type { ManualPaymentClaimReadModel } from '../manualPaymentClaimReadModel';

const paidPurchase = {
  id: 'b7f1c3d4-9a2e-4c11-8f77-2ab3cd45ef99',
  status: 'PAID',
  packageName: 'Weekly 40 rides',
  pricePaidRwf: 12000,
  ridesGranted: 40,
  bonusRidesGranted: 5,
  provider: 'mtn',
  createdAt: '2026-07-20T09:15:00.000Z',
};

const approvedClaim = {
  id: 'claim-uuid-1',
  displayClaimId: 'CLM-4821',
  status: 'approved',
  packageName: 'Monthly 200 rides',
  expectedAmountRwf: 48000,
  provider: 'airtel',
  approvedAt: '2026-07-21T11:00:00.000Z',
  submittedAt: '2026-07-21T08:00:00.000Z',
  createdAt: '2026-07-21T07:00:00.000Z',
  vehicleType: 'moto',
  maskedTransactionReference: '****7788',
} as unknown as ManualPaymentClaimReadModel;

describe('buildReceiptNumber', () => {
  it('is short, uppercase and derived from the payment id', () => {
    expect(buildReceiptNumber(paidPurchase.id)).toBe('RCPT-CD45EF99');
  });

  it('is stable for the same payment', () => {
    expect(buildReceiptNumber('abc-123')).toBe(buildReceiptNumber('abc-123'));
  });

  it('copes with an id shorter than the tail length', () => {
    expect(buildReceiptNumber('a1')).toBe('RCPT-A1');
  });
});

describe('buildPurchaseReceipt', () => {
  it('builds a receipt for a settled purchase', () => {
    const receipt = buildPurchaseReceipt(paidPurchase, { name: 'Jean B.', phone: '+250788000111' });
    expect(receipt).not.toBeNull();
    expect(receipt!.source).toBe('automatic');
    expect(receipt!.amountRwf).toBe(12000);
    expect(receipt!.ridesGranted).toBe(40);
    expect(receipt!.bonusRidesGranted).toBe(5);
    expect(receipt!.driverName).toBe('Jean B.');
  });

  it('refuses anything not settled — there is nothing to attest to yet', () => {
    expect(buildPurchaseReceipt({ ...paidPurchase, status: 'PENDING' })).toBeNull();
    expect(buildPurchaseReceipt({ ...paidPurchase, status: 'FAILED' })).toBeNull();
  });
});

describe('buildClaimReceipt', () => {
  it('builds a receipt for an approved claim, dated at approval', () => {
    const receipt = buildClaimReceipt(approvedClaim);
    expect(receipt).not.toBeNull();
    expect(receipt!.source).toBe('manual');
    expect(receipt!.paidAt).toBe('2026-07-21T11:00:00.000Z');
    expect(receipt!.reference).toBe('****7788');
    // Grants live in the entitlement ledger, not on the claim — never guessed.
    expect(receipt!.ridesGranted).toBeNull();
  });

  it('refuses a claim that is not approved', () => {
    for (const status of ['submitted', 'pending_review', 'needs_clarification', 'rejected', 'expired']) {
      expect(buildClaimReceipt({ ...approvedClaim, status } as ManualPaymentClaimReadModel)).toBeNull();
    }
  });
});

describe('formatting helpers', () => {
  it('formats RWF with no decimals', () => {
    expect(formatReceiptAmount(12000)).toBe('12,000 RWF');
  });

  it('names providers the way drivers know them', () => {
    expect(providerDisplayName('mtn')).toBe('MTN MoMo');
    expect(providerDisplayName('airtel')).toBe('Airtel Money');
    expect(providerDisplayName(null)).toBe('Mobile Money');
  });

  it('produces a filesystem-safe filename', () => {
    const receipt = buildPurchaseReceipt(paidPurchase)!;
    expect(receiptFileName(receipt)).toMatch(/^RCPT-[A-Z0-9]+\.pdf$/);
  });
});

describe('renderReceiptHtml', () => {
  it('is a self-contained document with no external references', () => {
    const html = renderReceiptHtml(buildPurchaseReceipt(paidPurchase)!);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('states the amount, package and reference', () => {
    const html = renderReceiptHtml(buildPurchaseReceipt(paidPurchase)!);
    expect(html).toContain('12,000 RWF');
    expect(html).toContain('Weekly 40 rides');
    expect(html).toContain(paidPurchase.id);
    expect(html).toContain('40 + 5 bonus');
  });

  it('omits the rides row when the grant is unknown', () => {
    const html = renderReceiptHtml(buildClaimReceipt(approvedClaim)!);
    expect(html).not.toContain('Rides added');
  });

  it('escapes package names so a stray quote cannot break the document', () => {
    const html = renderReceiptHtml(
      buildPurchaseReceipt({ ...paidPurchase, packageName: 'Weekly "40" <b>rides</b>' })!,
    );
    expect(html).toContain('Weekly &quot;40&quot; &lt;b&gt;rides&lt;/b&gt;');
    expect(html).not.toContain('<b>rides</b>');
  });
});
