const requiredPublicVariables = [
  {
    name: 'EXPO_PUBLIC_MAPBOX_TOKEN',
    validate: value => value.startsWith('pk.') && value.length > 10,
    guidance: 'must be a Mapbox public token beginning with "pk."',
  },
];

const optionalPublicVariables = [
  'EXPO_PUBLIC_NOMINATIM_USER_AGENT',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
];

const failures = requiredPublicVariables.flatMap(({ name, validate, guidance }) => {
  const value = process.env[name]?.trim() ?? '';
  if (!value) return [`${name} is required`];
  if (!validate(value)) return [`${name} ${guidance}`];
  return [];
});

if (failures.length > 0) {
  console.error('Mobile release environment validation failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Mobile release environment validation passed.');
console.log(`Required public variables present: ${requiredPublicVariables.length}`);
console.log(
  `Optional public variables configured: ${
    optionalPublicVariables.filter(name => Boolean(process.env[name]?.trim())).length
  }/${optionalPublicVariables.length}`,
);
