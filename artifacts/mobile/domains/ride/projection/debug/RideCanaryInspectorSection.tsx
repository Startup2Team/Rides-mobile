import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import type { useColors } from '@/hooks/useColors';
import { RideCanaryInspectorCard } from './RideCanaryInspectorCard';
import type { RideCanaryInspectorTone } from './RideCanaryInspectorHooks';

export interface RideCanaryInspectorField {
  label: string;
  value: string | number | boolean | null | undefined;
}

export function RideCanaryInspectorSection({
  colors,
  title,
  tone,
  fields,
  footer,
}: {
  colors: ReturnType<typeof useColors>;
  title: string;
  tone: RideCanaryInspectorTone;
  fields: RideCanaryInspectorField[];
  footer?: React.ReactNode;
}) {
  return (
    <RideCanaryInspectorCard colors={colors} title={title} tone={tone}>
      {fields.map(field => (
        <View key={field.label} style={styles.row}>
          <AppText variant="tiny" style={[styles.label, { color: colors.mutedForeground }]}>
            {field.label}
          </AppText>
          <AppText variant="tiny" style={[styles.value, { color: colors.foreground }]}>
            {typeof field.value === 'boolean' ? (field.value ? 'yes' : 'no') : field.value ?? 'n/a'}
          </AppText>
        </View>
      ))}
      {footer}
    </RideCanaryInspectorCard>
  );
}

export function RideCanaryInspectorActionRow({
  colors,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return <View style={[styles.actions, { borderTopColor: colors.border }]}>{children}</View>;
}

export function RideCanaryInspectorMeta({
  colors,
  label,
  value,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="tiny" style={[styles.label, { color: colors.mutedForeground }]}>{label}</AppText>
      <AppText variant="tiny" style={[styles.value, { color: colors.foreground }]}>{value}</AppText>
    </View>
  );
}

export function RideCanaryInspectorPrimaryAction({
  title,
  onPress,
  icon,
}: {
  title: string;
  onPress: () => void;
  icon: React.ComponentProps<typeof AppButton>['icon'];
}) {
  return <AppButton title={title} onPress={onPress} icon={icon} variant="secondary" compact fullWidth labelFontSize={12} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flexShrink: 1,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    marginTop: 6,
    paddingTop: 8,
    gap: 8,
  },
});
