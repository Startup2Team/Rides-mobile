import { repositoryResolver } from '../../adapters';
import { remoteReadinessMatrix } from '../remoteReadinessMatrix';
import { remoteReadinessPolicies } from '../remoteReadinessPolicies';
import {
  getHybridCandidates,
  getRemoteBlockedDomains,
  getRemoteProductionGuardAudit,
  getRemoteReadinessReport,
  getSafeStagingCandidates,
} from '../remoteReadinessReport';
import { scoreRemoteReadiness } from '../remoteReadinessScoring';

describe('remote readiness matrix', () => {
  test('all implemented domains appear in the matrix', () => {
    expect(Object.keys(remoteReadinessMatrix)).toEqual(expect.arrayContaining([
      'auth',
      'profile',
      'savedLocations',
      'notifications',
      'vehicles',
      'packages',
      'paymentMethods',
      'rideReads',
      'driverOnboarding',
      'search',
      'map',
      'rideCommands',
      'realtimeEvents',
      'paymentTransactions',
      'wallet',
      'adminReview',
    ]));
  });

  test('score helper preserves expected risk-backed recommendations', () => {
    expect(scoreRemoteReadiness('savedLocations')).toMatchObject({
      domain: 'savedLocations',
      score: 95,
      recommendedMode: 'hybrid_candidate',
    });
    expect(scoreRemoteReadiness('profile')).toMatchObject({
      domain: 'profile',
      score: 93,
      recommendedMode: 'hybrid_candidate',
    });
    expect(scoreRemoteReadiness('auth')).toMatchObject({
      domain: 'auth',
      score: 62,
      recommendedMode: 'shadow_only',
    });
  });

  test('risk categories remain classified for the current rollout set', () => {
    expect(remoteReadinessMatrix.auth.riskCategory).toBe('identity/security');
    expect(remoteReadinessMatrix.packages.riskCategory).toBe('financial');
    expect(remoteReadinessMatrix.paymentMethods.riskCategory).toBe('financial');
    expect(remoteReadinessMatrix.rideReads.riskCategory).toBe('lifecycle');
    expect(remoteReadinessMatrix.search.riskCategory).toBe('medium');
    expect(remoteReadinessMatrix.map.riskCategory).toBe('medium');
  });

  test('safe staging and hybrid candidate helpers return the expected domains', () => {
    expect(getSafeStagingCandidates()).toEqual(expect.arrayContaining([
      'notifications',
      'vehicles',
      'rideReads',
      'driverOnboarding',
      'search',
      'map',
    ]));
    expect(getHybridCandidates()).toEqual(expect.arrayContaining([
      'profile',
      'savedLocations',
      'paymentMethods',
    ]));
  });

  test('blocked domains include remote-authority guardrails', () => {
    expect(getRemoteBlockedDomains()).toEqual(expect.arrayContaining([
      'auth',
      'packages',
      'paymentMethods',
      'rideReads',
      'driverOnboarding',
      'search',
      'map',
      'rideCommands',
      'realtimeEvents',
      'paymentTransactions',
      'wallet',
      'adminReview',
    ]));
  });

  test('production guard audit passes with current defaults', () => {
    const audit = getRemoteProductionGuardAudit();

    expect(repositoryResolver.getMode()).toBe('LOCAL');
    expect(audit.passed).toBe(true);
    expect(audit.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'repository-resolver-default-local', passed: true }),
      expect.objectContaining({ name: 'otp-shadow-dry-run-documented', passed: true }),
      expect.objectContaining({ name: 'payment-execution-out-of-scope', passed: true }),
      expect.objectContaining({ name: 'ride-command-writes-disabled', passed: true }),
    ]));
  });

  test('report generator includes blockers and warnings', () => {
    const report = getRemoteReadinessReport(new Date('2026-07-03T00:00:00.000Z'));

    expect(report.lastEvaluatedAt).toBe('2026-07-03T00:00:00.000Z');
    expect(report.domains.find(item => item.domain === 'auth')).toMatchObject({
      blockers: expect.arrayContaining(['No backend token/session persistence strategy for remote authority yet.']),
      warnings: expect.arrayContaining(['OTP shadow flow must stay dry-run only.']),
    });
    expect(report.safeStagingCandidates).toEqual(getSafeStagingCandidates());
    expect(report.hybridCandidates).toEqual(getHybridCandidates());
    expect(report.blockedDomains).toEqual(getRemoteBlockedDomains());
    expect(report.productionGuardAudit.passed).toBe(true);
  });

  test('policy thresholds remain documented for later staging progression', () => {
    expect(remoteReadinessPolicies.scoreThresholds).toMatchObject({
      not_ready: 0,
      shadow_only: 40,
      staging_shadow_candidate: 72,
      hybrid_candidate: 84,
      remote_candidate: 95,
    });
  });
});
