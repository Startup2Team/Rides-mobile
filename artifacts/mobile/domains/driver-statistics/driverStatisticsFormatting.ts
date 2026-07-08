export function formatDriverStatisticsRwf(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `${new Intl.NumberFormat('en-RW').format(safeAmount)} RWF`;
}
