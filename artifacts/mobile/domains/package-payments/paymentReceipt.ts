/**
 * Receipts for settled package payments.
 *
 * A receipt is only ever built from a payment the platform has already settled —
 * an automatic MoMo purchase that reached PAID, or a manual claim an admin
 * approved. Anything still in flight has no receipt, because there is nothing to
 * attest to yet.
 *
 * Pure module: no React, no React Native, no filesystem. The screen renders the
 * model; the sheet writes `renderReceiptHtml` to a file and shares it.
 */

import type { ManualPaymentClaimReadModel } from './manualPaymentClaimReadModel';

export type PaymentReceiptSource = 'automatic' | 'manual';

export interface PaymentReceipt {
  /** Human-facing receipt number, stable for a given payment. */
  receiptNumber: string;
  source: PaymentReceiptSource;
  packageName: string;
  amountRwf: number;
  /** 'mtn' | 'airtel' | null — null when the payment predates provider capture. */
  provider: string | null;
  /** ISO timestamp of settlement. */
  paidAt: string;
  ridesGranted: number | null;
  bonusRidesGranted: number | null;
  /** Provider/claim reference the driver can quote to support. */
  reference: string;
  driverName: string | null;
  driverPhone: string | null;
  vehicleType: string | null;
}

export interface ReceiptHolder {
  name?: string | null;
  phone?: string | null;
}

const RECEIPT_PREFIX = 'RCPT';

/** Short, stable, quotable — the tail of the payment id, not a random number. */
export function buildReceiptNumber(paymentId: string): string {
  const compact = paymentId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const tail = compact.slice(-8) || compact;
  return `${RECEIPT_PREFIX}-${tail}`;
}

export function providerDisplayName(provider: string | null | undefined): string {
  if (!provider) return 'Mobile Money';
  return provider.toLowerCase() === 'mtn' ? 'MTN MoMo' : 'Airtel Money';
}

/** A settled automatic purchase (status PAID). */
export function isReceiptablePurchaseStatus(status: string): boolean {
  return status.toUpperCase() === 'PAID';
}

/** An admin-approved manual claim. */
export function isReceiptableClaimStatus(status: string): boolean {
  return status.toLowerCase() === 'approved';
}

export function buildPurchaseReceipt(
  purchase: {
    id: string;
    status: string;
    packageName: string;
    pricePaidRwf: number;
    ridesGranted: number;
    bonusRidesGranted: number;
    provider: string | null;
    createdAt: string;
  },
  holder: ReceiptHolder = {},
): PaymentReceipt | null {
  if (!isReceiptablePurchaseStatus(purchase.status)) return null;
  return {
    receiptNumber: buildReceiptNumber(purchase.id),
    source: 'automatic',
    packageName: purchase.packageName,
    amountRwf: purchase.pricePaidRwf,
    provider: purchase.provider,
    paidAt: purchase.createdAt,
    ridesGranted: purchase.ridesGranted,
    bonusRidesGranted: purchase.bonusRidesGranted,
    reference: purchase.id,
    driverName: holder.name ?? null,
    driverPhone: holder.phone ?? null,
    vehicleType: null,
  };
}

export function buildClaimReceipt(
  claim: Pick<
    ManualPaymentClaimReadModel,
    | 'id'
    | 'displayClaimId'
    | 'status'
    | 'packageName'
    | 'expectedAmountRwf'
    | 'provider'
    | 'approvedAt'
    | 'submittedAt'
    | 'createdAt'
    | 'vehicleType'
    | 'maskedTransactionReference'
  >,
  holder: ReceiptHolder = {},
): PaymentReceipt | null {
  if (!isReceiptableClaimStatus(claim.status)) return null;
  return {
    receiptNumber: buildReceiptNumber(claim.displayClaimId || claim.id),
    source: 'manual',
    packageName: claim.packageName,
    amountRwf: claim.expectedAmountRwf,
    provider: claim.provider,
    // Settlement time is approval time; fall back only if it wasn't recorded.
    paidAt: claim.approvedAt ?? claim.submittedAt ?? claim.createdAt,
    // Grants come from the entitlement ledger, not the claim, so don't guess.
    ridesGranted: null,
    bonusRidesGranted: null,
    reference: claim.maskedTransactionReference || claim.displayClaimId || claim.id,
    driverName: holder.name ?? null,
    driverPhone: holder.phone ?? null,
    vehicleType: claim.vehicleType ?? null,
  };
}

export function formatReceiptAmount(amountRwf: number): string {
  return `${amountRwf.toLocaleString('en-RW')} RWF`;
}

export function formatReceiptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Safe filename — shared straight into the OS share sheet. */
export function receiptFileName(receipt: PaymentReceipt): string {
  return `${receipt.receiptNumber.replace(/[^A-Za-z0-9-]/g, '')}.html`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string): string {
  return `<tr><td class="l">${escapeHtml(label)}</td><td class="v">${escapeHtml(value)}</td></tr>`;
}

/**
 * Self-contained receipt document. Shared as a file, so it must not reference any
 * external stylesheet, font or image — and it must print cleanly on A4/Letter.
 */
export function renderReceiptHtml(receipt: PaymentReceipt): string {
  const rides =
    receipt.ridesGranted == null
      ? null
      : receipt.bonusRidesGranted && receipt.bonusRidesGranted > 0
        ? `${receipt.ridesGranted} + ${receipt.bonusRidesGranted} bonus`
        : `${receipt.ridesGranted}`;

  const rows = [
    row('Receipt number', receipt.receiptNumber),
    row('Date paid', formatReceiptDate(receipt.paidAt)),
    row('Package', receipt.packageName),
    receipt.vehicleType ? row('Vehicle', receipt.vehicleType) : '',
    row('Payment method', providerDisplayName(receipt.provider)),
    row('Payment type', receipt.source === 'automatic' ? 'Automatic (MoMo)' : 'Manual (proof reviewed)'),
    rides ? row('Rides added', rides) : '',
    row('Reference', receipt.reference),
    receipt.driverName ? row('Driver', receipt.driverName) : '',
    receipt.driverPhone ? row('Phone', receipt.driverPhone) : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(receipt.receiptNumber)} · Rides receipt</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #11181C; background: #F2F2F7;
    -webkit-text-size-adjust: 100%;
  }
  .sheet {
    max-width: 520px; margin: 0 auto; background: #FFFFFF;
    border: 1px solid #E3E3E8; border-radius: 18px; padding: 28px;
  }
  .brand { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .word { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; }
  .paid {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: #0F7B3E; background: #E7F6EC; padding: 5px 9px; border-radius: 8px; white-space: nowrap;
  }
  .amount { margin: 22px 0 4px; font-size: 34px; font-weight: 700; letter-spacing: -1px; }
  .caption { margin: 0; font-size: 12px; color: #6B7280; }
  hr { border: 0; border-top: 1px solid #E3E3E8; margin: 22px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; vertical-align: top; font-size: 13px; }
  td.l { color: #6B7280; width: 44%; }
  td.v { color: #11181C; font-weight: 600; text-align: right; word-break: break-word; }
  .foot { margin: 22px 0 0; font-size: 11px; line-height: 1.6; color: #6B7280; }
  @media print {
    body { background: #FFFFFF; padding: 0; }
    .sheet { border: 0; border-radius: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <span class="word">Rides</span>
      <span class="paid">Payment confirmed</span>
    </div>
    <p class="amount">${escapeHtml(formatReceiptAmount(receipt.amountRwf))}</p>
    <p class="caption">Paid for ${escapeHtml(receipt.packageName)}</p>
    <hr />
    <table>${rows}</table>
    <hr />
    <p class="foot">
      This receipt confirms a ride-package payment settled by Rides. Keep the
      reference above when contacting support about this payment.
    </p>
  </div>
</body>
</html>`;
}
