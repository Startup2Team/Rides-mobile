export const customerRatingKeys = {
  all: ["customer", "ratings"] as const,
  mine: () => ["customer", "ratings", "mine"] as const,
} as const;
