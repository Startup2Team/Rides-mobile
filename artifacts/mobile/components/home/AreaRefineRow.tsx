import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { spacing } from '@/constants/spacing';
import type { useColors } from '@/hooks/useColors';
import { useAdminUnitSearchQuery, useAdminUnitsQuery } from '@/query/hooks';
import type { AdminUnit } from '@/services/locations';

/**
 * Area chips backed by the Rwanda admin hierarchy (/locations/admin-units).
 * Admin units carry no coordinates, so they cannot be picked as a destination —
 * they narrow the *query* instead: tapping "Remera" rewrites the search text to
 * its full path, which the geocoder then resolves precisely, and drills one
 * level down so the rider can keep narrowing. Free, so it runs before Mapbox
 * has anything to say; when the backend is unreachable the row simply hides and
 * the Mapbox results below are untouched.
 */
export function AreaRefineRow({
  colors,
  query,
  onSelectArea,
}: {
  colors: ReturnType<typeof useColors>;
  query: string;
  onSelectArea: (unit: AdminUnit) => void;
}) {
  const [drillParent, setDrillParent] = useState<AdminUnit | null>(null);

  const searchQuery = useAdminUnitSearchQuery(query, { enabled: drillParent === null });
  const childrenQuery = useAdminUnitsQuery(drillParent?.id ?? null, {
    enabled: drillParent !== null,
  });

  const units: AdminUnit[] = drillParent ? childrenQuery.data ?? [] : searchQuery.data ?? [];
  if (!drillParent && units.length === 0) return null;

  const select = (unit: AdminUnit) => {
    setDrillParent(unit);
    onSelectArea(unit);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="tiny" style={[styles.title, { color: colors.mutedForeground }]}>
        Areas
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {drillParent ? (
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: colors.primary }]}
            onPress={() => setDrillParent(null)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Clear area ${drillParent.name}`}
            accessibilityHint="Removes this area filter and returns to matching areas"
          >
            <Feather name="x" size={icons.semantic.badge} color={colors.primaryForeground} />
            <AppText variant="label" style={[styles.chipText, { color: colors.primaryForeground }]} numberOfLines={1}>
              {drillParent.name}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {units.map(unit => (
          <TouchableOpacity
            key={unit.id}
            style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => select(unit)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${unit.name}, ${unit.level}`}
            accessibilityHint={`Narrows the search to ${unit.path}`}
          >
            <AppText variant="label" style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
              {unit.name}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[8],
  },
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing[6],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[8],
    paddingRight: spacing[8],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 44,
    maxWidth: 220,
    paddingHorizontal: spacing[14],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  chipText: {
    flexShrink: 1,
  },
});
