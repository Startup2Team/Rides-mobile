import {
  describeManualPaymentApprovalTransaction,
  manualPaymentApprovalTransactionBlueprint,
} from '../manualPaymentApprovalTransaction';

describe('manual payment approval transaction blueprint', () => {
  test('documents the atomic approval sequence and idempotency scopes', () => {
    const blueprint = describeManualPaymentApprovalTransaction();
    expect(blueprint).toEqual(manualPaymentApprovalTransactionBlueprint);
    expect(blueprint.idempotencyScopes.approval).toBe('manual-payment-claim:{claimId}:approval');
    expect(blueprint.steps).toHaveLength(9);
    expect(blueprint.rollbackGuarantee).toContain('no partial approval state');
  });

  test('approval event shape excludes sensitive payment fields', () => {
    const event = {
      eventId: 'event-1',
      claimId: 'claim-1',
      driverId: 'driver-1',
      packageId: 'growth',
      vehicleId: 'vehicle-1',
      activationId: 'activation-1',
      entitlementVersion: 2,
      occurredAt: '2026-07-06T10:10:00.000Z',
    };

    expect(JSON.stringify(event)).not.toContain('payerPhoneNumber');
    expect(JSON.stringify(event)).not.toContain('transactionReference');
    expect(JSON.stringify(event)).not.toContain('merchantCode');
  });
});
