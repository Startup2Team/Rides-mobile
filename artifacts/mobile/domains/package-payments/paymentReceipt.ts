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
  return `${receipt.receiptNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: string, mono = false): string {
  const cls = mono ? 'v mono' : 'v';
  return `<tr><td class="l">${escapeHtml(label)}</td><td class="${cls}">${escapeHtml(value)}</td></tr>`;
}

/**
 * Self-contained receipt document, rendered to PDF by expo-print. It must not
 * reference any external stylesheet, font or image (the renderer has no network)
 * and it must paginate cleanly on A4/Letter.
 */
export function renderReceiptHtml(receipt: PaymentReceipt): string {
  const rides =
    receipt.ridesGranted == null
      ? null
      : receipt.bonusRidesGranted && receipt.bonusRidesGranted > 0
        ? `${receipt.ridesGranted} + ${receipt.bonusRidesGranted} bonus`
        : `${receipt.ridesGranted}`;

  const rows = [
    row('Date paid', formatReceiptDate(receipt.paidAt)),
    row('Method', providerDisplayName(receipt.provider)),
    row('Type', receipt.source === 'automatic' ? 'Automatic (MoMo)' : 'Manual (reviewed)'),
    receipt.vehicleType ? row('Vehicle', receipt.vehicleType) : '',
    receipt.driverName ? row('Driver', receipt.driverName) : '',
    receipt.driverPhone ? row('Phone', receipt.driverPhone) : '',
    row('Reference', receipt.reference, true),
  ]
    .filter(Boolean)
    .join('');

  const ridesBanner = rides
    ? `<div class="rides">+ ${escapeHtml(rides)} rides added</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(receipt.receiptNumber)} · Rides receipt</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px 18px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #11181C; background: #FFFFFF;
    -webkit-text-size-adjust: 100%;
  }
  .sheet { max-width: 460px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .word { font-size: 17px; font-weight: 700; letter-spacing: -0.3px; }
  .no { font-size: 11px; color: #6B7280; letter-spacing: 0.3px; }
  .hero { text-align: center; padding: 26px 0 4px; }
  .amount { margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -1.2px; }
  .pkg { margin: 6px 0 0; font-size: 13px; color: #6B7280; }
  .paid {
    display: inline-block; margin-top: 12px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: #0F7B3E; background: #E7F6EC; padding: 5px 10px; border-radius: 999px;
  }
  .rides {
    margin-top: 16px; text-align: center; font-size: 12px; font-weight: 700;
    color: #1D4ED8; background: #EEF2FF; padding: 10px; border-radius: 12px;
  }
  .perf {
    margin: 20px 0; height: 1px;
    background-image: linear-gradient(to right, #D1D5DB 0 5px, transparent 5px 11px);
    background-size: 11px 1px; background-repeat: repeat-x;
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; vertical-align: top; font-size: 12.5px; }
  td.l { color: #6B7280; width: 42%; }
  td.v { font-weight: 600; text-align: right; word-break: break-word; }
  td.v.mono { font-family: "SF Mono", Menlo, Consolas, monospace; font-weight: 500; font-size: 11.5px; }
  .foot { margin: 20px 0 0; font-size: 10px; line-height: 1.6; color: #6B7280; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <span class="word">Rides</span>
      <span class="no">${escapeHtml(receipt.receiptNumber)}</span>
    </div>
    <div class="hero">
      <p class="amount">${escapeHtml(formatReceiptAmount(receipt.amountRwf))}</p>
      <p class="pkg">${escapeHtml(receipt.packageName)}</p>
      <span class="paid">Paid</span>
    </div>
    ${ridesBanner}
    <div class="perf"></div>
    <table>${rows}</table>
    <p class="foot">
      Keep this reference when contacting Rides support about this payment.
    </p>
  </div>
</body>
</html>`;
}
