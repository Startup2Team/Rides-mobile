import type { ManualPaymentProviderConfiguration, PackagePaymentFailure, PackagePaymentOutcome } from './types';

const SUPPORTED_PLACEHOLDERS = new Set(['merchantCode', 'amount']);

function fail<T>(code: PackagePaymentFailure['code'], message: string, details?: PackagePaymentFailure['details']): PackagePaymentOutcome<T> {
  return { data: null, failure: { code, message, details } };
}

function isPositiveWholeAmount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function buildManualPaymentUssdInstruction(
  providerConfiguration: ManualPaymentProviderConfiguration,
  amountRwf: number,
): PackagePaymentOutcome<string> {
  if (!providerConfiguration.enabled) {
    return fail('provider_disabled', 'The selected manual payment provider is disabled.', {
      provider: providerConfiguration.provider,
    });
  }
  const merchantCode = providerConfiguration.merchantCode.trim();
  if (!merchantCode) {
    return fail('invalid_payment_configuration', 'Manual payment merchant code is required.', {
      provider: providerConfiguration.provider,
    });
  }
  if (!isPositiveWholeAmount(amountRwf)) {
    return fail('invalid_ussd_template', 'Manual payment amount must be a positive whole RWF amount.');
  }

  const template = providerConfiguration.ussdTemplate.trim();
  if (!template || !template.includes('{merchantCode}') || !template.includes('{amount}')) {
    return fail('invalid_ussd_template', 'Manual payment USSD template is malformed.');
  }
  if (/[{}]/.test(template)) {
    const placeholders = template.match(/{([^}]+)}/g) ?? [];
    const hasUnsupportedPlaceholder = placeholders.some(token => {
      const placeholder = token.slice(1, -1);
      return !SUPPORTED_PLACEHOLDERS.has(placeholder);
    });
    if (hasUnsupportedPlaceholder) {
      return fail('invalid_ussd_template', 'Manual payment USSD template contains an unsupported placeholder.');
    }
  }

  const instruction = template
    .replaceAll('{merchantCode}', merchantCode)
    .replaceAll('{amount}', String(amountRwf));

  if (instruction.includes('{') || instruction.includes('}')) {
    return fail('invalid_ussd_template', 'Manual payment USSD template is malformed.');
  }

  return { data: instruction, failure: null };
}
