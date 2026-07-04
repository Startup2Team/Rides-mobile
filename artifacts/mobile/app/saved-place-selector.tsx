import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHeader, useGlassHeaderMetrics } from '@/components/GlassHeader';
import { GlassScrollView } from '@/components/GlassScrollView';
import { AppText } from '@/components/AppText';

import { buttonCornerRadius } from '@/constants/buttons';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { FORM_BOTTOM_PADDING } from '@/constants/tabBar';
import { typography } from '@/constants/typography';
import { createMapPickerSessionId, useMapPicker } from '@/context/MapPickerContext';
import { useSavedLocations } from '@/context/SavedLocationsContext';
import { useColors } from '@/hooks/useColors';
import { useLocationSearch } from '@/hooks/home/useLocationSearch';
import { KIGALI_CENTER, type RideLocation, type SavedLocation } from '@/types';

type SavedPlaceLabel = 'Home' | 'Work' | 'School' | 'Church' | 'Other';

export default function SavedPlaceSelectorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerMetrics = useGlassHeaderMetrics();
  const scheme = useColorScheme();

  const {
    mode = 'add',
    label: rawLabel,
    savedPlaceId,
    initialAddress,
    initialLatitude,
    initialLongitude,
  } = useLocalSearchParams<{
    mode?: 'add' | 'edit';
    label?: string;
    savedPlaceId?: string;
    initialAddress?: string;
    initialLatitude?: string;
    initialLongitude?: string;
  }>();

  const { savedPlaces, persistSavedPlaces } = useSavedLocations();
  const { consumeResult, clearResult } = useMapPicker();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  const existing = useMemo(() => {
    if (mode === 'edit' && savedPlaceId) {
      return savedPlaces.find(place => place.id === savedPlaceId);
    }
    if (mode === 'add' && rawLabel && rawLabel !== 'Other') {
      return savedPlaces.find(place => place.label.toLowerCase() === rawLabel.toLowerCase());
    }
    return undefined;
  }, [mode, savedPlaceId, rawLabel, savedPlaces]);

  const label = useMemo(() => {
    if (mode === 'edit' && existing) {
      return existing.label;
    }
    return rawLabel || 'Other';
  }, [mode, existing, rawLabel]);

  const displayLabel = useMemo(() => {
    return normalizeLabel(label);
  }, [label]);

  const initialCoords = useMemo(() => {
    if (initialLatitude && initialLongitude) {
      const lat = parseFloat(initialLatitude);
      const lng = parseFloat(initialLongitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    if (existing) {
      return { latitude: existing.latitude, longitude: existing.longitude };
    }
    return KIGALI_CENTER;
  }, [initialLatitude, initialLongitude, existing]);

  const initialAddressStr = useMemo(() => {
    if (initialAddress) {
      return initialAddress;
    }
    if (existing) {
      return existing.address ?? '';
    }
    return '';
  }, [initialAddress, existing]);

  const [customLabel, setCustomLabel] = useState(() => {
    if (displayLabel === 'Other') {
      if (mode === 'add' && label === 'Other') {
        return '';
      }
      return label;
    }
    return '';
  });

  const inputRef = useRef<TextInput>(null);
  const {
    text: searchText,
    setText: setSearchText,
    handleTextChange: handleSearchTextChange,
    loading: searchLoading,
    suggestions: searchSuggestions,
    clearText: clearSearchText,
    buildTypedLocation: buildSearchTypedLocation,
  } = useLocationSearch(initialCoords);

  useEffect(() => {
    if (initialAddressStr) {
      setSearchText(initialAddressStr);
    }
  }, [initialAddressStr, setSearchText]);

  useEffect(() => {
    if (displayLabel === 'Other' && label && label !== 'Other') {
      setCustomLabel(label);
    }
  }, [displayLabel, label]);
  if (mode === 'edit' && !existing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <GlassHeader title="Edit Place" />
        <View
          style={[
            styles.searchBody,
            {
              paddingTop: headerMetrics.contentTop + spacing[24],
              alignItems: 'center',
              justifyContent: 'center',
              gap: semanticSpacing.cardPadding,
            },
          ]}
        >
          <Feather name="alert-triangle" size={icons.size.hero} color={colors.destructive} />
          <AppText variant="title" style={{ color: colors.foreground, textAlign: 'center' }}>
            Saved place not found or has been deleted.
          </AppText>
          <TouchableOpacity
            style={{ paddingHorizontal: semanticSpacing.screenPadding, paddingVertical: spacing[10], borderRadius: radius['3xl'], backgroundColor: colors.primary }}
            onPress={() => router.back()}
          >
            <AppText variant="button" style={{ color: colors.primaryForeground }}>Go Back</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  useEffect(() => {
    return () => {
      if (pendingSessionId) {
        clearResult(pendingSessionId);
      }
    };
  }, [clearResult, pendingSessionId]);

  const savePlace = useCallback(async (place: RideLocation) => {
    const finalLabel = displayLabel === 'Other' ? customLabel.trim() : label;
    if (!finalLabel) {
      Alert.alert('Name this place', 'Enter a label before saving this location.');
      return;
    }
    const saved: SavedLocation = {
      ...place,
      id: (mode === 'edit' && existing) ? existing.id : `settings-${finalLabel.toLowerCase()}-${Date.now()}`,
      label: finalLabel,
    };
    const next = [
      saved,
      ...savedPlaces.filter(item => {
        const isCurrentItem = (mode === 'edit' && existing) ? item.id === existing.id : false;
        const isSameLabel = item.label.toLowerCase() === finalLabel.toLowerCase();
        const isSameId = item.id === saved.id;
        return !isCurrentItem && !isSameLabel && !isSameId;
      }),
    ];
    await persistSavedPlaces(next);
    router.back();
  }, [customLabel, displayLabel, existing, label, mode, persistSavedPlaces, savedPlaces]);

  useFocusEffect(
    useCallback(() => {
      if (!pendingSessionId) return undefined;
      const result = consumeResult(pendingSessionId);
      if (!result) return undefined;
      setPendingSessionId(null);

      const expectedResultMode = mode === 'edit' ? 'saved-place-edit' : 'saved-place-add';
      const expectedSavedPlaceId = mode === 'edit' ? existing?.id ?? savedPlaceId : undefined;

      if (result.mode !== expectedResultMode) return undefined;
      if (expectedSavedPlaceId && result.savedPlaceId !== expectedSavedPlaceId) return undefined;
      if (!expectedSavedPlaceId && result.savedPlaceId && result.savedPlaceId.length > 0) {
        return undefined;
      }

      void savePlace({
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.address,
        locationType: 'precise',
      });
      return undefined;
    }, [consumeResult, existing?.id, mode, pendingSessionId, savePlace, savedPlaceId]),
  );

  if (mode === 'edit' && !existing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <GlassHeader title="Edit Place" />
        <View
          style={[
            styles.searchBody,
            {
              paddingTop: headerMetrics.contentTop + spacing[24],
              alignItems: 'center',
              justifyContent: 'center',
              gap: semanticSpacing.cardPadding,
            },
          ]}
        >
          <Feather name="alert-triangle" size={icons.size.hero} color={colors.destructive} />
          <AppText variant="title" style={{ color: colors.foreground, textAlign: 'center' }}>
            Saved place not found or has been deleted.
          </AppText>
          <TouchableOpacity
            style={{ paddingHorizontal: semanticSpacing.screenPadding, paddingVertical: spacing[10], borderRadius: radius['3xl'], backgroundColor: colors.primary }}
            onPress={() => router.back()}
          >
            <AppText variant="button" style={{ color: colors.primaryForeground }}>Go Back</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const deletePlace = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.label}"?`,
      'This saved place will be removed from your list. This cannot be undone.',
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = savedPlaces.filter(place => place.id !== existing.id);
            await persistSavedPlaces(next);
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const openMap = () => {
    const routeLabel = displayLabel === 'Other' ? (customLabel.trim() || label) : label;
    const sessionId = createMapPickerSessionId();
    clearResult();
    setPendingSessionId(sessionId);
    router.push({
      pathname: '/map-picker',
      params: {
        target: 'saved-place',
        mode: mode === 'edit' ? 'saved-place-edit' : 'saved-place-add',
        sessionId,
        savedPlaceId: mode === 'edit' && existing ? existing.id : undefined,
        label: routeLabel,
        initialLatitude: initialCoords.latitude.toString(),
        initialLongitude: initialCoords.longitude.toString(),
        initialAddress: searchText.trim() || initialAddressStr,
      },
    });
  };

  const hasQuery = searchText.trim().length >= 2;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <GlassHeader
        title={displayLabel === 'Other' ? (mode === 'edit' ? 'Edit Place' : 'Add Place') : `${mode === 'edit' ? 'Edit' : 'Add'} ${label}`}
        right={
          mode === 'edit' && existing ? (
            <View style={styles.headerActionSlot}>
              <TouchableOpacity
                onPress={deletePlace}
                activeOpacity={0.8}
                style={[styles.headerDeleteButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Delete saved place"
                testID="header-delete-button"
              >
                <Feather name="trash-2" size={icons.semantic.button} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />
      <View style={[styles.searchBody, { paddingTop: headerMetrics.contentTop - spacing[4] }]}>
        {displayLabel === 'Other' ? (
          <View style={[styles.labelInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bookmark" size={icons.semantic.row} color={colors.mutedForeground} />
            <TextInput
              autoFocus
              value={customLabel}
              onChangeText={setCustomLabel}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Place name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              accessibilityLabel="Place name"
              onSubmitEditing={() => inputRef.current?.focus()}
              keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
            />
          </View>
        ) : null}
        <View style={[styles.searchInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={icons.semantic.row} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            autoFocus={displayLabel !== 'Other'}
            value={searchText}
            onChangeText={handleSearchTextChange}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={`Search ${label.toLowerCase()} address`}
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
          />
          {searchLoading ? (
            <View style={styles.searchClear}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
          {!searchLoading && searchText.length > 0 ? (
            <TouchableOpacity
              style={[styles.searchClear, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={clearSearchText}
              accessibilityLabel="Clear address search"
            >
              <Feather name="x" size={icons.semantic.button} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={styles.mapOption} onPress={openMap} activeOpacity={0.65}>
          <View style={[styles.mapOptionIcon, { backgroundColor: colors.muted }]}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={colors.foreground} />
          </View>
          <AppText variant="h3" style={[styles.mapOptionText, { color: colors.foreground }]}>Set location on map</AppText>
        </TouchableOpacity>

        <GlassScrollView
          style={styles.results}
          indicatorTop={spacing[8]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + FORM_BOTTOM_PADDING }}
        >
          {hasQuery ? (
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => savePlace(buildSearchTypedLocation())}
            >
              <Feather name="edit-2" size={17} color={colors.foreground} />
              <View style={styles.resultCopy}>
                <AppText variant="bodySmall" style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>
                  Use "{searchText.trim()}"
                </AppText>
                <AppText variant="tiny" style={[styles.resultSubtitle, { color: colors.mutedForeground }]}>Save the typed address</AppText>
              </View>
            </TouchableOpacity>
          ) : null}

          {searchSuggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.id}
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => savePlace({
                ...suggestion.coords,
                address: suggestion.place_name,
                locationType: 'precise',
              })}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={19} color={colors.foreground} />
              <View style={styles.resultCopy}>
                <AppText variant="bodySmall" style={[styles.resultTitle, { color: colors.foreground }]} numberOfLines={1}>{suggestion.title}</AppText>
                <AppText variant="tiny" style={[styles.resultSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {suggestion.subtitle ?? suggestion.place_name}
                </AppText>
              </View>
            </TouchableOpacity>
          ))}

          {hasQuery && !searchLoading && searchSuggestions.length === 0 ? (
            <AppText variant="caption" style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No matches yet. Try a full place name, street address, or set the location on the map.
            </AppText>
          ) : null}


        </GlassScrollView>
      </View>
    </View>
  );
}

function normalizeLabel(value?: string): SavedPlaceLabel {
  if (value === 'Home' || value === 'Work' || value === 'School' || value === 'Church' || value === 'Other') return value;
  if (value && value.trim().length > 0) return 'Other';
  return 'Other';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchBody: { flex: 1, paddingHorizontal: semanticSpacing.cardPadding },
  searchInputWrap: {
    height: sizes.input.lg,
    borderRadius: buttonCornerRadius(sizes.input.lg),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: semanticSpacing.listItemPadding,
  },
  labelInputWrap: {
    height: sizes.input.lg,
    borderRadius: buttonCornerRadius(sizes.input.lg),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: semanticSpacing.listItemPadding,
    marginBottom: spacing[10],
  },
  searchInput: { flex: 1, ...typography.title, fontFamily: typography.label.fontFamily },
  searchClear: {
    width: sizes.avatar.xs,
    height: sizes.avatar.xs,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionSlot: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerDeleteButton: {
    width: sizes.avatar.xs,
    height: sizes.avatar.xs,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapOption: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: radius['3xl'] - spacing[2] },
  mapOptionIcon: { width: sizes.iconButton.md, height: sizes.iconButton.md, borderRadius: radius.sheetCompact, alignItems: 'center', justifyContent: 'center' },
  mapOptionText: { flex: 1, ...typography.h3 },
  results: { flex: 1 },
  resultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  resultCopy: { flex: 1, gap: 3 },
  resultTitle: { ...typography.bodySmall, fontFamily: typography.title.fontFamily },
  resultSubtitle: { ...typography.tiny, fontFamily: typography.caption.fontFamily },
  emptyText: { paddingVertical: radius.sheetCompact, ...typography.caption },

});
