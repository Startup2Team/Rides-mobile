import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { LanguageSelector } from '@/components/LanguageSelector';
import { APP_NAME, WEBSITE_URL } from '@/constants/branding';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { useAuth } from '@/context/AuthContext';
import { useSavedLocations } from '@/context/SavedLocationsContext';
import { useColors } from '@/hooks/useColors';
import { AppText } from '@/components/AppText';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { typography } from '@/constants/typography';
import { replaceAuthBoundary } from '@/navigation/navigationPolicy';
import { deleteAccount } from '@/services/authSession';
import { usePressGuard } from '@/hooks/usePressGuard';
import { DailyGoalIcon } from "@/components/DailyGoalIcon";
import { PrivacySecurityIcon } from "@/components/PrivacySecurityIcon";
import { HelpSupportIcon } from "@/components/HelpSupportIcon";
import { AlertsIcon } from "@/components/AlertsIcon";
import { AboutRidesIcon } from "@/components/AboutRidesIcon";
import { VisitWebsiteIcon } from "@/components/VisitWebsiteIcon";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const isDark = useColorScheme() === "dark";
  const { logout, user } = useAuth();
  const { savedPlaces } = useSavedLocations();
  const isDriver = user?.mode === "driver";
  const cardFill = isDark ? "#1C1C1E" : "#FFFFFF";
  const pageBackground = isDark ? "#000000" : "#F2F2F7";

  const openSavedPlace = (label: "Home" | "Work" | "School") => {
    const existing = savedPlaces.find(
      (place) => place.label.toLowerCase() === label.toLowerCase(),
    );
    if (existing) {
      router.push({
        pathname: "/saved-place-selector",
        params: { mode: "edit", savedPlaceId: existing.id },
      });
    } else {
      router.push({
        pathname: "/saved-place-selector",
        params: { mode: "add", label },
      });
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all ride history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            // Real server-side deletion (DELETE /v1/auth/account): the backend
            // anonymizes the account and revokes all sessions. Only sign out
            // AFTER it succeeds — never pretend it worked when it didn't.
            try {
              await deleteAccount();
            } catch {
              Alert.alert(
                'Could not delete account',
                "Something went wrong deleting your account. Check your connection and try again, or contact support if it keeps happening.",
              );
              return;
            }
            await logout();
            replaceAuthBoundary(router, '/(auth)/welcome');
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Before you go...",
      "Help us improve. Why are you deleting your account?",
      [
        { text: "Found a better service", onPress: confirmDelete },
        { text: "Privacy concerns", onPress: confirmDelete },
        { text: "Too many issues", onPress: confirmDelete },
        { text: "No longer need it", onPress: confirmDelete },
        { text: "Keep my account", style: "cancel" },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        onPress: async () => {
          await logout();
          replaceAuthBoundary(router, "/(auth)/welcome");
        },
      },
    ]);
  };

  const savedAddress = (label: string) =>
    savedPlaces.find(
      (place) => place.label.toLowerCase() === label.toLowerCase(),
    )?.address;

  return (
    <View style={[styles.root, { backgroundColor: pageBackground }]}>
      <GlassHeader
        title="Settings"
        right={
          <TouchableOpacity
            style={styles.headerRightBtn}
            onPress={() => router.push("/share")}
            accessibilityRole="button"
            accessibilityLabel="Share QR Code"
          >
            <Ionicons
              name="qr-code-outline"
              size={20}
              color={colors.foreground}
            />
          </TouchableOpacity>
        }
      />
      <GlassScrollView
        indicatorTop={headerMetrics.indicatorTop}
        contentContainerStyle={{
          paddingTop: headerMetrics.contentTop,
          paddingBottom: insets.bottom + FORM_BOTTOM_PADDING,
          paddingHorizontal: semanticSpacing.cardPadding,
          gap: radius.sheetCompact,
        }}
      >
        <Section title="Preferences">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <View style={styles.languageRow}>
              <View style={styles.rowIcon}>
                <Feather
                  name="globe"
                  size={icons.size.lg}
                  color={colors.primary}
                />
              </View>
              <View style={styles.rowCopy}>
                <AppText
                  variant="body"
                  style={[styles.rowLabel, { color: colors.foreground }]}
                >
                  Language
                </AppText>
                <AppText
                  variant="tiny"
                  style={[styles.rowDetail, { color: colors.mutedForeground }]}
                >
                  Choose your preferred language
                </AppText>
              </View>
              <LanguageSelector />
            </View>
            <Divider />
            <SettingsRow
              icon={<AlertsIcon />}
              label="Notifications"
              detail="Manage ride and account alerts"
              onPress={() => router.push("/notifications")}
            />
          </View>
        </Section>

        <Section title="Shortcuts">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow
              icon="home"
              label="Home Address"
              detail={savedAddress("Home") ?? "Add home address"}
              onPress={() => openSavedPlace("Home")}
            />
            <Divider />
            <SettingsRow
              icon="briefcase"
              label="Work Address"
              detail={savedAddress("Work") ?? "Add work address"}
              onPress={() => openSavedPlace("Work")}
            />
            <Divider />
            <SettingsRow
              iconFamily="mci"
              icon="account-group"
              label="School Address"
              detail={savedAddress("School") ?? "Add school address"}
              onPress={() => openSavedPlace("School")}
            />
            {isDriver && (
              <>
                <Divider />
                <SettingsRow
                  icon={<DailyGoalIcon />}
                  label="Daily Earnings Goal"
                  detail="Set daily earnings goal"
                  onPress={() => router.push("/driver-daily-goal")}
                />
              </>
            )}
          </View>
        </Section>

        <Section title="Account and Support">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow
              icon={<PrivacySecurityIcon />}
              label="Privacy and Security"
              onPress={() => router.push("/privacy-security")}
            />
            <Divider />
            <SettingsRow
              icon={<HelpSupportIcon />}
              label="Help and Support"
              onPress={() => router.push("/help-support")}
            />
            <Divider />
            <SettingsRow
              icon={<VisitWebsiteIcon />}
              label="Visit Our Website"
              detail="rides.rw"
              onPress={() => void Linking.openURL(WEBSITE_URL)}
            />
            <Divider />
            <SettingsRow
              icon={<AboutRidesIcon />}
              label={`About ${APP_NAME}`}
              onPress={() => router.push("/about")}
            />
          </View>
        </Section>

        <Section title="Danger zone">
          <View style={[styles.card, { backgroundColor: cardFill }]}>
            <SettingsRow
              icon="log-out"
              label="Log Out"
              detail="Sign out of your account"
              onPress={handleLogout}
              destructive
            />
            <Divider />
            <SettingsRow
              icon="trash-2"
              label="Delete Account"
              detail="Permanently remove your account"
              onPress={handleDeleteAccount}
              destructive
            />
          </View>
        </Section>
      </GlassScrollView>
    </View>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <AppText
        variant="h3"
        style={[styles.sectionTitle, { color: colors.foreground }]}
      >
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function SettingsRow({
  destructive = false,
  detail,
  iconFamily = "feather",
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  detail?: string;
  iconFamily?: "feather" | "mci";
  icon:
    | keyof typeof Feather.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap
    | React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const guardedPress = usePressGuard(onPress);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={guardedPress}
      activeOpacity={0.62}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>
        {React.isValidElement(icon) ? (
          icon
        ) : iconFamily === "mci" ? (
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={icons.size.lg}
            color={destructive ? colors.destructive : colors.primary}
          />
        ) : (
          <Feather
            name={icon as keyof typeof Feather.glyphMap}
            size={icons.size.lg}
            color={destructive ? colors.destructive : colors.primary}
          />
        )}
      </View>
      <View style={styles.rowCopy}>
        <AppText
          variant="body"
          style={[
            styles.rowLabel,
            { color: destructive ? colors.destructive : colors.foreground },
          ]}
        >
          {label}
        </AppText>
        {detail ? (
          <AppText
            variant="tiny"
            style={[styles.rowDetail, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {detail}
          </AppText>
        ) : null}
      </View>
      <Feather
        name="chevron-right"
        size={icons.semantic.row}
        color={colors.mutedForeground}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { gap: spacing[10] },
  sectionTitle: {
    ...typography.h3,
    fontFamily: typography.badge.fontFamily,
    letterSpacing: -0.2,
    marginLeft: spacing[2],
  },
  card: {
    borderRadius: radius.card,
    overflow: "hidden",
    ...Platform.select({ ios: { borderCurve: "continuous" } }),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 58,
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[12],
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: spacing[64] + spacing[2],
    paddingHorizontal: semanticSpacing.cardPadding,
    paddingVertical: spacing[10],
  },
  rowIcon: {
    width: icons.size.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing[2] },
  rowLabel: { ...typography.body, fontFamily: typography.label.fontFamily },
  rowDetail: { ...typography.tiny, fontFamily: typography.caption.fontFamily },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 53 },
  headerRightBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
