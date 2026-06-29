import type { ReadinessGateResult, ReadinessReport, ReadinessGateStatus } from '../types';

function rollupStatus(gates: ReadinessGateResult[]): ReadinessGateStatus {
  if (gates.some(gate => gate.status === 'fail')) return 'fail';
  if (gates.some(gate => gate.status === 'warn')) return 'warn';
  return 'pass';
}

export function createReadinessReport(gates: ReadinessGateResult[], now: () => Date = () => new Date()): ReadinessReport {
  const counts = {
    pass: gates.filter(gate => gate.status === 'pass').length,
    warn: gates.filter(gate => gate.status === 'warn').length,
    fail: gates.filter(gate => gate.status === 'fail').length,
    total: gates.length,
  };
  const readinessScore = counts.total === 0
    ? 0
    : Math.round(((counts.pass + counts.warn * 0.5) / counts.total) * 100);

  return {
    generatedAt: now().toISOString(),
    readinessScore,
    overallStatus: rollupStatus(gates),
    counts,
    gates: [...gates],
  };
}

