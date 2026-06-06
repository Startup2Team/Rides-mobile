import { useMemo, useState } from 'react';
import {
  INITIAL_DRIVER_ONBOARDING_FORM,
  type CascadeField,
  type DriverOnboardingForm,
} from './onboardingTypes';

const RWANDAN_PLATE_PATTERNS = [
  /^R[A-Z]{2}\s\d{3}\s[A-Z]$/,
  /^RAC\s\d{3}\s[A-Z]$/,
  /^RAD\s\d{3}\s[A-Z]$/,
];

export function useDriverOnboardingForm() {
  const [form, setForm] = useState<DriverOnboardingForm>(INITIAL_DRIVER_ONBOARDING_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plateWarning, setPlateWarning] = useState('');

  const maxDobDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
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
    if (field === 'village') resets.cell = '';
    setForm(current => ({ ...current, ...resets, [field]: value }));
    setErrors(current => ({ ...current, [field]: '' }));
  };

  const handlePlateChange = (text: string) => {
    const upper = text.toUpperCase();
    update('plateNumber', upper);
    if (upper.length < 5) {
      setPlateWarning('');
      return;
    }
    const cleaned = upper.trim();
    const matched = RWANDAN_PLATE_PATTERNS.some(pattern => pattern.test(cleaned));
    setPlateWarning(matched ? '' : 'Format not matched — please verify it matches Rwanda plate standards.');
  };

  return { errors, form, handlePlateChange, maxDobDate, plateWarning, setErrors, setForm, update, updateCascade };
}
