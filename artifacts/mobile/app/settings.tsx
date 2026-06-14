import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { LanguageSelector } from '@/components/LanguageSelector';
import { APP_NAME, WEBSITE_URL } from '@/constants/branding';
import { useSavedLocations } from '@/context/SavedLocationsContext';
import { useColors } from '@/hooks/useColors';

const PHONE_CHANGE_MESSAGE = `Hi ${APP_NAME} support, I need help with: change my phone number`;
const SUPPORT_WHATSAPP_NUMBER = '250788123456';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === 'dark';
  const { savedPlaces } = useSavedLocations();
  const cardFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const pageBackground = isDark ? '#000000' : '#F2F2F7';

  const openSavedPlace = (label: 'Home' | 'Work' | 'School') => {
    router.push({ pathname: '/saved-place-selector', params: { label } });
  };

  const openPhoneChangeSupport = () => {
    const url = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(PHONE_CHANGE_MESSAGE)}`;
    void Linking.openURL(url);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all ride history. This cannot be undone.',
      [
        { text: 'Delete Forever', style: 'destructive', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Before you go...',
      'Help us improve. Why are you deleting your account?',
      [
        { text: 'Found a better service', onPress: confirmDelete },
        { text: 'Privacy concerns', onPress: confirmDelete },
        { text: 'Too many issues', onPress: confirmDelete },
        { text: 'No longer need it', onPress: confirmDelete },
        { text: 'Keep my account', style: 'cancel' },
      ],
    );
  };

  const savedAddress = (label: string) =>
    savedPlaces.find(place => place.label.toLowerCase() === label.toLowerCase())?.address;

  return (
    <View style={[styles.root, { backgroundColor: pageBackground }]}>
      <GlassHeader title="Settings" subtitle="Preferences and account controls" />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
          gap: 22,
        }}
      >
        <Section title="Preferences">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <View style={styles.languageRow}>
              <View style={styles.rowIcon}><Feather name="globe" size={19} color={colors.foreground} /></View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Language</Text>
                <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>Choose your preferred language</Text>
              </View>
              <LanguageSelector />
            </View>
            <Divider />
            <SettingsRow icon="bell" label="Notifications" detail="Manage ride and account alerts" onPress={() => router.push('/notifications')} />
          </View>
        </Section>

        <Section title="Saved Places">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow icon="home" label="Home Address" detail={savedAddress('Home') ?? 'Add home address'} onPress={() => openSavedPlace('Home')} />
            <Divider />
            <SettingsRow icon="briefcase" label="Work Address" detail={savedAddress('Work') ?? 'Add work address'} onPress={() => openSavedPlace('Work')} />
            <Divider />
            <SettingsRow icon="book-open" label="School Address" detail={savedAddress('School') ?? 'Add school address'} onPress={() => openSavedPlace('School')} />
          </View>
        </Section>

        <Section title="Account & Support">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow icon="phone" label="Change Phone Number" detail="Contact support on WhatsApp" onPress={openPhoneChangeSupport} />
            <Divider />
            <SettingsRow icon="shield" label="Privacy & Security" onPress={() => router.push('/privacy-security')} />
            <Divider />
            <SettingsRow icon="help-circle" label="Help & Support" onPress={() => router.push('/help-support')} />
            <Divider />
            <SettingsRow icon="external-link" label="Visit Our Website" detail="rides.rw" onPress={() => void Linking.openURL(WEBSITE_URL)} />
            <Divider />
            <SettingsRow icon="info" label={`About ${APP_NAME}`} onPress={() => router.push('/about')} />
          </View>
        </Section>

        <Section title="Danger Zone">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow icon="trash-2" label="Delete Account" detail="Permanently remove your account" onPress={handleDeleteAccount} destructive />
          </View>
        </Section>
      </GlassScrollView>
    </View>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  const colors = useColors();
  return <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
    {children}
  </View>;
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function SettingsRow({ destructive = false, detail, icon, label, onPress }: {
  destructive?: boolean;
  detail?: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const color = destructive ? colors.destructive : colors.foreground;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.62} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.rowIcon}><Feather name={icon} size={19} color={color} /></View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, { color }]}>{label}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: colors.mutedForeground }]} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2, marginLeft: 2 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({ ios: { borderCurve: 'continuous' } }),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 58, paddingHorizontal: 16, paddingVertical: 12 },
  languageRow: { flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 66, paddingHorizontal: 16, paddingVertical: 10 },
  rowIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  rowDetail: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 53 },
});
