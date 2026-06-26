export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 2,
  header: 10,
  sheet: 30,
  searchOverlay: 80,
  backdrop: 85,
  modal: 90,
  mapPicker: 120,
  toast: 200,
  tooltip: 100,
  localOverlay: 3,
  scrollIndicator: 5,
} as const;

export type ZIndexToken = keyof typeof zIndex;
