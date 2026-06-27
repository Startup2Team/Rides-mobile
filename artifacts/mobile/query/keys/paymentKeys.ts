export const paymentKeys = {
  all: ['payments'] as const,
  methods: () => ['payments', 'methods'] as const,
  wallet: () => ['payments', 'wallet'] as const,
} as const;
