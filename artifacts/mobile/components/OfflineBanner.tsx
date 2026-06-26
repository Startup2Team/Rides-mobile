import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';

export function OfflineBanner() {
  const colors = useColors();
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
    }) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
      Animated.spring(slideAnim, {
        toValue: offline ? 0 : -48,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    });
    return unsub;
  }, [slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.destructive, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Feather name="wifi-off" size={14} color="#fff" />
      <Text style={styles.text}>No internet connection — showing cached data</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: { ...typography.label, fontFamily: typography.label.fontFamily, color: '#fff' },
});
