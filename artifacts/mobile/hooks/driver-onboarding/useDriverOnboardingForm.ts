import { useMemo, useState } from 'react';
import {
  INITIAL_DRIVER_ONBOARDING_FORM,
  type CascadeField,
  type DriverOnboardingForm,
} from './onboardingTypes';
import { formatRwandaPlateInput, isValidRwandaPlateNumber } from '@/utils/rwandaValidation';

export function useDriverOnboardingForm() {
  const [form, setForm] = useState<DriverOnboardingForm>(INITIAL_DRIVER_ONBOARDING_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plateWarning, setPlateWarning] = useState('');

  const maxDobDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 16);
    return date;
  }, []);

  const update = (field: string, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: '' }));
  };

  const updateCascade = (field: CascadeField, value: string) => {
    const resets: Partial<DriverOnboardingForm> = {};
    if (field === 'province') resets.district = resets.sector = resets.cell = resets.village = '';
    if (field === 'district') resets.sector = resets.cell = resets.village = '';
    if (field === 'sector') resets.cell = resets.village = '';
    if (field === 'cell') resets.village = '';
    setForm(current => ({ ...current, ...resets, [field]: value }));
    setErrors(current => ({ ...current, [field]: '' }));
  };

  const handlePlateChange = (text: string) => {
    const formatted = formatRwandaPlateInput(text);
    update('plateNumber', formatted);
    if (formatted.length < 5) {
      setPlateWarning('');
      return;
    }
    setPlateWarning(isValidRwandaPlateNumber(formatted) ? '' : 'Enter a Rwanda plate in the format RAD 000 A.');
  };

  return { errors, form, handlePlateChange, maxDobDate, plateWarning, setErrors, setForm, update, updateCascade };
}
