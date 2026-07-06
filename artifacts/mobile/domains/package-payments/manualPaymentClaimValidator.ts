import { normalizeRwandaPhoneNumber } from '@/utils/rwandaValidation';
import { normalizePackagePaymentMode } from './packagePaymentMode';
import { calculateManualPaymentClaimExpiry, isManualPaymentClaimExpired } from './manualPaymentExpiryPolicy';
import { createManualPaymentClaimAuditEntry, createManualPaymentClaimId } from './manualPaymentClaimHelpers';
import {
  type CreateManualPaymentClaimInput,
  type ManualPackagePaymentConfiguration,
  type ManualPaymentClaim,
  type ManualPaymentProviderConfiguration,
  type ManualPaymentValidationIssue,
  type ManualPaymentValidationResult,
  type PackagePaymentConfiguration,
  type PackagePaymentFailure,
} from './types';

function fail<T>(
  code: PackagePaymentFailure['code'],
  message: string,
  issues: ManualPaymentValidationIssue[] = [],
  details?: PackagePaymentFailure['details'],
): ManualPaymentValidationResult<T> {
  return {
    data: null,
    failure: {
      code,
      message,
      details: details ?? (issues.length > 0 ? { issueCount: issues.length } : undefined),
    },
    issues,
  };
}

function success<T>(data: T): ManualPaymentValidationResult<T> {
  return { data, failure: null };
}

function isPositiveWholeNumber(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function asManualPackageConfiguration(
  value: unknown,
): ManualPaymentValidationResult<ManualPackagePaymentConfiguration> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('invalid_payment_configuration', 'Manual package payment configuration is invalid.');
  }

  const config = value as Partial<ManualPackagePaymentConfiguration>;
  if (!Array.isArray(config.providers) || config.providers.length === 0) {
    return fail('invalid_payment_configuration', 'At least one manual payment provider is required.');
  }
  if (!isPositiveWholeNumber(config.claimExpiresAfterMinutes)) {
    return fail('invalid_payment_configuration', 'Manual payment claim expiry must be a positive whole minute value.');
  }
  if (typeof config.transactionReferenceRequired !== 'boolean') {
    return fail('invalid_payment_configuration', 'transactionReferenceRequired must be boolean.');
  }
  if (typeof config.proofImageEnabled !== 'boolean') {
    return fail('invalid_payment_configuration', 'proofImageEnabled must be boolean.');
  }
  if (config.proofImageRequired !== undefined && typeof config.proofImageRequired !== 'boolean') {
    return fail('invalid_payment_configuration', 'proofImageRequired must be boolean when present.');
  }

  const claimExpiresAfterMinutes = config.claimExpiresAfterMinutes as number;
  const transactionReferenceRequired = config.transactionReferenceRequired;
  const proofImageEnabled = config.proofImageEnabled;
  const proofImageRequired = config.proofImageRequired;

  const providers: ManualPaymentProviderConfiguration[] = [];
  for (const item of config.providers) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return fail('invalid_payment_configuration', 'Manual payment provider configuration is invalid.');
    }
    const provider = item as Partial<ManualPaymentProviderConfiguration>;
    if (provider.provider !== 'mtn' && provider.provider !== 'airtel') {
      return fail('invalid_payment_configuration', 'Manual payment provider is invalid.');
    }
    if (!isNonEmptyString(provider.merchantCode)) {
      return fail('invalid_payment_configuration', 'Manual payment provider merchant code is required.');
    }
    if (!isNonEmptyString(provider.ussdTemplate)) {
      return fail('invalid_payment_configuration', 'Manual payment provider USSD template is required.');
    }
    if (typeof provider.enabled !== 'boolean') {
      return fail('invalid_payment_configuration', 'Manual payment provider enabled flag is required.');
    }
    const merchantCode = (provider.merchantCode as string).trim();
    const ussdTemplate = (provider.ussdTemplate as string).trim();
    providers.push({
      provider: provider.provider,
      displayName: typeof provider.displayName === 'string' && provider.displayName.trim().length > 0
        ? provider.displayName.trim()
        : undefined,
      merchantCode,
      ussdTemplate,
      enabled: provider.enabled,
    });
  }

  return success({
    providers,
    claimExpiresAfterMinutes,
    transactionReferenceRequired,
    proofImageEnabled,
    proofImageRequired,
  });
}

export function validateManualPaymentProviderConfiguration(
  value: unknown,
): ManualPaymentValidationResult<ManualPaymentProviderConfiguration> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('invalid_payment_configuration', 'Manual payment provider configuration is invalid.');
  }

  const provider = value as Partial<ManualPaymentProviderConfiguration>;
  if (provider.provider !== 'mtn' && provider.provider !== 'airtel') {
    return fail('invalid_payment_configuration', 'Manual payment provider is invalid.');
  }
  if (!isNonEmptyString(provider.merchantCode)) {
    return fail('invalid_payment_configuration', 'Manual payment provider merchant code is required.');
  }
  if (!isNonEmptyString(provider.ussdTemplate)) {
    return fail('invalid_payment_configuration', 'Manual payment provider USSD template is required.');
  }
  if (typeof provider.enabled !== 'boolean') {
    return fail('invalid_payment_configuration', 'Manual payment provider enabled flag is required.');
  }

  const merchantCode = (provider.merchantCode as string).trim();
  const ussdTemplate = (provider.ussdTemplate as string).trim();

  return success({
    provider: provider.provider,
    displayName: typeof provider.displayName === 'string' && provider.displayName.trim().length > 0
      ? provider.displayName.trim()
      : undefined,
    merchantCode,
    ussdTemplate,
    enabled: provider.enabled,
  });
}

export function validateManualPackagePaymentConfiguration(
  value: unknown,
): ManualPaymentValidationResult<ManualPackagePaymentConfiguration> {
  return asManualPackageConfiguration(value);
}

export function validatePackagePaymentConfiguration(
  value: unknown,
): ManualPaymentValidationResult<PackagePaymentConfiguration> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fail('invalid_payment_configuration', 'Package payment configuration is invalid.');
  }

  const config = value as Partial<PackagePaymentConfiguration>;
  const version = config.version as string;
  const updatedAt = config.updatedAt as string;
  const mode = normalizePackagePaymentMode(config.mode);
  if (!mode) {
    return fail('invalid_payment_configuration', 'Package payment mode is invalid.');
  }
  if (!isNonEmptyString(version)) {
    return fail('invalid_payment_configuration', 'Package payment configuration version is required.');
  }
  if (!isNonEmptyString(updatedAt) || Number.isNaN(new Date(updatedAt).getTime())) {
    return fail('invalid_payment_configuration', 'Package payment configuration updatedAt is invalid.');
  }

  let manual: ManualPackagePaymentConfiguration | undefined;
  if (config.manual != null) {
    const manualValidation = validateManualPackagePaymentConfiguration(config.manual);
    if (manualValidation.failure || !manualValidation.data) {
      return fail('invalid_payment_configuration', manualValidation.failure?.message ?? 'Manual package payment configuration is invalid.');
    }
    manual = manualValidation.data;
  } else if (mode === 'manual') {
    return fail('invalid_payment_configuration', 'Manual package payment configuration is required when mode is manual.');
  }

  return success({
    mode,
    manual,
    version: version.trim(),
    updatedAt: updatedAt.trim(),
  });
}

function validateClaimFields(
  input: CreateManualPaymentClaimInput,
  config: PackagePaymentConfiguration,
) {
  const issues: ManualPaymentValidationIssue[] = [];
  const offer = input.offer;
  const driverId = input.driverId;
  const payerPhoneNumber = input.payerPhoneNumber;
  const transactionReference = input.transactionReference;
  const proofImageId = input.proofImageId;

  if (!isNonEmptyString(driverId)) {
    issues.push({ field: 'driverId', code: 'required', message: 'driverId is required.' });
  }
  if (!isNonEmptyString(offer.offerId)) {
    issues.push({ field: 'offerId', code: 'required', message: 'offerId is required.' });
  }
  if (!isNonEmptyString(offer.packageId)) {
    issues.push({ field: 'packageId', code: 'required', message: 'packageId is required.' });
  }
  if (!isNonEmptyString(offer.packageVersion)) {
    issues.push({ field: 'packageVersion', code: 'required', message: 'packageVersion is required.' });
  }
  if (!isNonEmptyString(offer.packageName)) {
    issues.push({ field: 'packageName', code: 'required', message: 'packageName is required.' });
  }
  if (!isNonEmptyString(offer.vehicleId)) {
    issues.push({ field: 'vehicleId', code: 'required', message: 'vehicleId is required.' });
  }
  if (!isNonEmptyString(offer.vehicleType)) {
    issues.push({ field: 'vehicleType', code: 'required', message: 'vehicleType is required.' });
  }
  if (!isPositiveWholeNumber(offer.priceRwf)) {
    issues.push({ field: 'expectedAmountRwf', code: 'invalid_amount', message: 'expectedAmountRwf must be a positive whole amount.' });
  }

  const createdAt = typeof offer.createdAt === 'string' ? offer.createdAt : '';
  const expiresAt = typeof offer.expiresAt === 'string' ? offer.expiresAt : '';
  if (!isNonEmptyString(createdAt) || Number.isNaN(new Date(createdAt).getTime())) {
    issues.push({ field: 'createdAt', code: 'invalid_timestamp', message: 'offer.createdAt is invalid.' });
  }
  if (!isNonEmptyString(expiresAt) || Number.isNaN(new Date(expiresAt).getTime())) {
    issues.push({ field: 'expiresAt', code: 'invalid_timestamp', message: 'offer.expiresAt is invalid.' });
  }
  if (
    isNonEmptyString(createdAt)
    && isNonEmptyString(expiresAt)
    && new Date(expiresAt).getTime() <= new Date(createdAt).getTime()
  ) {
    issues.push({ field: 'expiresAt', code: 'invalid_expiry', message: 'expiresAt must be after createdAt.' });
  }

  const normalizedPhone = isNonEmptyString(payerPhoneNumber) ? normalizeRwandaPhoneNumber(payerPhoneNumber) : null;
  if (!normalizedPhone) {
    issues.push({ field: 'payerPhoneNumber', code: 'invalid_phone', message: 'payerPhoneNumber is invalid.' });
  }

  const manual = config.manual;
  if (manual?.transactionReferenceRequired && !isNonEmptyString(transactionReference)) {
    issues.push({ field: 'transactionReference', code: 'required', message: 'transactionReference is required.' });
  }
  if (manual?.proofImageRequired && !isNonEmptyString(proofImageId)) {
    issues.push({ field: 'proofImageId', code: 'required', message: 'proofImageId is required.' });
  }

  return {
    issues,
    normalizedPhone,
    createdAt,
    expiresAt,
  };
}

export function validateManualPaymentClaim(
  input: CreateManualPaymentClaimInput,
  configuration: PackagePaymentConfiguration,
): ManualPaymentValidationResult<ManualPaymentClaim> {
  const config = validatePackagePaymentConfiguration(configuration);
  if (config.failure || !config.data) {
    return fail('invalid_payment_configuration', 'Package payment configuration is invalid.');
  }

  if (config.data.mode === 'disabled') {
    return fail('payment_mode_disabled', 'Package payment is disabled.');
  }
  if (config.data.mode !== 'manual') {
    return fail('manual_payment_unavailable', 'Manual package payment is unavailable in the current mode.');
  }

  const validation = validateClaimFields(input, config.data);
  if (validation.issues.length > 0) {
    const transactionReferenceRequired = validation.issues.some(issue => issue.field === 'transactionReference');
    const proofRequired = validation.issues.some(issue => issue.field === 'proofImageId');
    if (transactionReferenceRequired) {
      return fail('transaction_reference_required', 'A transaction reference is required.', validation.issues);
    }
    if (proofRequired) {
      return fail('proof_required', 'A proof image is required.', validation.issues);
    }
    return fail('invalid_claim', 'Manual payment claim is invalid.', validation.issues);
  }

  const manual = config.data.manual;
  if (!manual) {
    return fail('invalid_payment_configuration', 'Manual package payment configuration is required.');
  }

  const expiresAt = calculateManualPaymentClaimExpiry(validation.createdAt, manual);
  if (!expiresAt) {
    return fail('invalid_payment_configuration', 'Manual payment claim expiry configuration is invalid.');
  }

  const normalizedPhone = validation.normalizedPhone;
  if (!normalizedPhone) {
    return fail('invalid_claim', 'payerPhoneNumber is invalid.', [{
      field: 'payerPhoneNumber',
      code: 'invalid_phone',
      message: 'payerPhoneNumber is invalid.',
    }]);
  }

  const providerConfig = manual.providers.find(item => item.provider === input.provider);
  if (!providerConfig || !providerConfig.enabled) {
    return fail('provider_disabled', 'The selected manual payment provider is disabled.', [], {
      provider: input.provider,
    });
  }

  const claimId = input.claimId ?? createManualPaymentClaimId(new Date(validation.createdAt));
  return success({
    id: claimId,
    version: 1,
    driverId: input.driverId.trim(),
    vehicleId: input.offer.vehicleId,
    vehicleType: input.offer.vehicleType,
    offerId: input.offer.offerId,
    packageId: input.offer.packageId,
    packageVersion: input.offer.packageVersion,
    packageName: input.offer.packageName,
    expectedAmountRwf: input.offer.priceRwf,
    provider: input.provider,
    merchantCodeSnapshot: providerConfig.merchantCode,
    payerPhoneNumber: normalizedPhone,
    transactionReference: input.transactionReference?.trim() || undefined,
    proofImageId: input.proofImageId?.trim() || undefined,
    status: 'draft',
    createdAt: validation.createdAt,
    expiresAt,
    idempotencyKey: input.idempotencyKey ?? `manual-payment-claim:${claimId}`,
    auditLog: [
      createManualPaymentClaimAuditEntry({
        claimId,
        at: validation.createdAt,
        actorType: 'driver',
        action: 'claim_created',
      }),
    ],
  });
}

export function validateManualPaymentClaimForSubmission(
  claim: ManualPaymentClaim,
  configuration: PackagePaymentConfiguration,
  now = new Date(),
): ManualPaymentValidationResult<ManualPaymentClaim> {
  if (isManualPaymentClaimExpired(claim, now)) {
    return fail('claim_expired', 'Manual payment claim has expired.');
  }

  const config = validatePackagePaymentConfiguration(configuration);
  if (config.failure || !config.data) {
    return fail('invalid_payment_configuration', 'Manual payment configuration is invalid.');
  }
  if (config.data.mode === 'disabled') {
    return fail('payment_mode_disabled', 'Package payment is disabled.');
  }

  return validateManualPaymentClaim({
    claimId: claim.id,
    driverId: claim.driverId,
    offer: {
      offerId: claim.offerId,
      packageId: claim.packageId,
      packageVersion: claim.packageVersion,
      packageName: claim.packageName,
      vehicleId: claim.vehicleId,
      vehicleType: claim.vehicleType,
      priceRwf: claim.expectedAmountRwf,
      ridesGranted: 0,
      bonusRidesGranted: 0,
      createdAt: claim.createdAt,
      expiresAt: claim.expiresAt,
      source: 'local_catalog',
      quoteAuthority: 'local',
    },
    provider: claim.provider,
    payerPhoneNumber: claim.payerPhoneNumber,
    transactionReference: claim.transactionReference,
    proofImageId: claim.proofImageId,
  }, config.data);
}
