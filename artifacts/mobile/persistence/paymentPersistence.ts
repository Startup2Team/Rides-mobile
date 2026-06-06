import { STORAGE_KEYS } from '@/constants/storage';
import type { PaymentMethod } from '@/types';
import { paymentMethodsSchema } from './storageSchemas';
import { loadSecureStorage, saveSecureStorage } from './secureStorage';

export const loadStoredPaymentMethods = () =>
  loadSecureStorage<PaymentMethod[]>(STORAGE_KEYS.paymentMethods, paymentMethodsSchema);

export const saveStoredPaymentMethods = (methods: PaymentMethod[]) =>
  saveSecureStorage(STORAGE_KEYS.paymentMethods, methods);
