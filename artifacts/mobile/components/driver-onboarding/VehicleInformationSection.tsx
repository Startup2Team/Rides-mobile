import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppInput } from '@/components/AppInput';
import { VehicleCard } from '@/components/VehicleCard';
import type { useColors } from '@/hooks/useColors';
import type { VehicleType } from '@/types';
import type { DriverOnboardingForm } from '@/hooks/driver-onboarding/onboardingTypes';
import { VEHICLE_QUESTIONS } from './onboardingData';
import { styles } from './onboardingStyles';

export function VehicleInformationSection({ colors, errors, form, handlePlateChange, plateWarning, setErrors, update }: {
  colors: ReturnType<typeof useColors>; errors: Record<string, string>; form: DriverOnboardingForm;
  handlePlateChange: (text: string) => void; plateWarning: string;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>; update: (field: string, value: string) => void;
}) {
  return <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Vehicle Information</Text>
    <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Vehicle Type</Text>
    <View style={styles.vehicleGrid}>{(['moto', 'rifani', 'cab', 'hilux', 'fuso'] as VehicleType[]).map(vehicle => <VehicleCard key={vehicle} type={vehicle} selected={form.vehicleType === vehicle} onSelect={() => { update('vehicleType', vehicle); setErrors(current => ({ ...current, passengerSeats: '', loadCapacityKg: '' })); }} compact />)}</View>
    {VEHICLE_QUESTIONS[form.vehicleType].map(question => <AppInput key={question.field} label={question.label} placeholder={question.placeholder} value={form[question.field as keyof DriverOnboardingForm] as string} onChangeText={text => update(question.field, text.replace(/\D/g, ''))} error={errors[question.field]} leftIcon="info" keyboardType="numeric" />)}
    <View>
      <AppInput label="Plate Number" placeholder="RAD 000 A" value={form.plateNumber} onChangeText={handlePlateChange} error={errors.plateNumber} leftIcon="hash" autoCapitalize="characters" />
      {form.plateNumber.length > 0 && <View style={styles.plateGuide}><Feather name="info" size={12} color={colors.mutedForeground} /><Text style={[styles.plateGuideText, { color: colors.mutedForeground }]}>Rwanda formats: RAD 000 A (Moto) · RAC 000 A (Commercial) · RAA 000 A (Private)</Text></View>}
      {plateWarning ? <View style={[styles.plateWarning, { backgroundColor: '#FF950015', borderColor: '#FF950040' }]}><Feather name="alert-triangle" size={12} color="#FF9500" /><Text style={[styles.plateWarningText, { color: '#FF9500' }]}>{plateWarning}</Text></View> : null}
    </View>
    <AppInput
      label="Driver Licence Number"
      placeholder="16-digit licence number"
      value={form.licenseNumber}
      onChangeText={text => update('licenseNumber', text.replace(/\D/g, '').slice(0, 16))}
      error={errors.licenseNumber}
      leftIcon="credit-card"
      keyboardType="numeric"
      maxLength={16}
    />
  </View>;
}
