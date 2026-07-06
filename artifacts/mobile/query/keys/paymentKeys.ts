export const paymentKeys = {
  all: ['payments'] as const,
  methods: (userId: string) => ['payments', 'methods', userId] as const,
  default: (userId: string) => ['payments', 'default', userId] as const,
  billing: (userId: string) => ['payments', 'billing', userId] as const,
  wallet: () => ['payments', 'wallet'] as const,
} as const;
