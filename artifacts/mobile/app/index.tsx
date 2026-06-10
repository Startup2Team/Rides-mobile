import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { canAccessDriverMode } from '@/utils/driverVerification';

export default function Index() {
  const { user, driverProfile, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.mode === 'driver' && canAccessDriverMode(driverProfile)) return <Redirect href="/(driver)" />;
  return <Redirect href="/(tabs)" />;
}
