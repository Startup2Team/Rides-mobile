import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { icons } from '@/constants/icons';
import { radius } from '@/constants/radius';
import { sizes } from '@/constants/sizes';
import { spacing, semanticSpacing } from '@/constants/spacing';
import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';

const LANGUAGE_FLAGS = ['rw', 'uk', 'fr', 'ug'] as const;
type LanguageFlag = typeof LANGUAGE_FLAGS[number];

const LANGUAGES: { code: string; label: string; value: LanguageFlag }[] = [
  { code: 'KIN', label: 'Kinyarwanda', value: 'rw' },
  { code: 'EN', label: 'English', value: 'uk' },
  { code: 'FR', label: 'French', value: 'fr' },
  { code: 'LG', label: 'Luganda', value: 'ug' },
];

function FlagPreview({ flag }: { flag: LanguageFlag }) {
  if (flag === 'rw') {
    return (
      <Svg width={58} height={58} viewBox="0 0 58 58" style={styles.flagSvg}>
        <Rect width={58} height={29} fill="#00A1DE" />
        <Rect y={29} width={58} height={14.5} fill="#FAD201" />
        <Rect y={43.5} width={58} height={14.5} fill="#20603D" />
        <G origin="43,16">
          {Array.from({ length: 24 }).map((_, index) => (
            <Line
              key={index}
              x1={43}
              y1={6.8}
              x2={43}
              y2={10.5}
              stroke="#E5BE01"
              strokeWidth={1.1}
              strokeLinecap="round"
              rotation={index * 15}
              origin="43,16"
            />
          ))}
        </G>
        <Circle cx={43} cy={16} r={5.2} fill="#E5BE01" />
        <Circle cx={43} cy={16} r={2.5} fill="#00A1DE" />
      </Svg>
    );
  }

  if (flag === 'fr') {
    return (
      <Svg width={58} height={58} viewBox="0 0 58 58" style={styles.flagSvg}>
        <Rect width={19.34} height={58} fill="#002395" />
        <Rect x={19.34} width={19.34} height={58} fill="#FFFFFF" />
        <Rect x={38.68} width={19.32} height={58} fill="#ED2939" />
      </Svg>
    );
  }

  if (flag === 'ug') {
    return (
      <Svg width={58} height={58} viewBox="0 0 58 58" style={styles.flagSvg}>
        <Rect width={58} height={9.67} fill="#000000" />
        <Rect y={9.67} width={58} height={9.67} fill="#FCDC04" />
        <Rect y={19.34} width={58} height={9.67} fill="#D90000" />
        <Rect y={29.01} width={58} height={9.67} fill="#000000" />
        <Rect y={38.68} width={58} height={9.67} fill="#FCDC04" />
        <Rect y={48.35} width={58} height={9.65} fill="#D90000" />
        <Circle cx={29} cy={29} r={8.5} fill="#FFFFFF" />
        <Circle cx={29} cy={29} r={5.8} fill="none" stroke="#D90000" strokeWidth={1} />
      </Svg>
    );
  }

  return (
    <Svg width={58} height={58} viewBox="0 0 58 58" style={styles.flagSvg}>
      <Rect width={58} height={58} fill="#012169" />
      <Polygon points="-6,0 0,-6 64,58 58,64" fill="#FFFFFF" />
      <Polygon points="58,-6 64,0 0,64 -6,58" fill="#FFFFFF" />
      <Polygon points="-3,0 0,-3 61,58 58,61" fill="#C8102E" />
      <Polygon points="58,-3 61,0 0,61 -3,58" fill="#C8102E" />
      <Line x1={29} y1={0} x2={29} y2={58} stroke="#FFFFFF" strokeWidth={18} />
      <Line x1={0} y1={29} x2={58} y2={29} stroke="#FFFFFF" strokeWidth={18} />
      <Line x1={29} y1={0} x2={29} y2={58} stroke="#C8102E" strokeWidth={10} />
      <Line x1={0} y1={29} x2={58} y2={29} stroke="#C8102E" strokeWidth={10} />
    </Svg>
  );
}

export function LanguageSelector() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [languageFlag, setLanguageFlag] = useState<LanguageFlag>('uk');
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);
  const languageCode = LANGUAGES.find(language => language.value === languageFlag)?.code ?? 'EN';

  const openLanguageSheet = () => {
    Keyboard.dismiss();
    setShowLanguageSheet(true);
  };

  const selectLanguage = (flag: LanguageFlag) => {
    setLanguageFlag(flag);
    setShowLanguageSheet(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={openLanguageSheet}
        style={[styles.languageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
      >
        <Text style={[styles.languageBtnText, { color: colors.foreground }]}>{languageCode}</Text>
        <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
        <View style={styles.languageBtnFlag}>
          <FlagPreview flag={languageFlag} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showLanguageSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageSheet(false)} />
        <View
          style={[
            styles.languageSheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 18,
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Choose language</Text>
          <View style={styles.languageOptions}>
            {LANGUAGES.map(language => {
              const selected = language.value === languageFlag;
              return (
                <TouchableOpacity
                  key={language.value}
                  style={[
                    styles.languageOption,
                    {
                      backgroundColor: selected ? colors.primaryHex + '18' : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => selectLanguage(language.value)}
                >
                  <View style={[styles.languageOptionFlag, { backgroundColor: colors.card }]}>
                    <FlagPreview flag={language.value} />
                  </View>
                  <Text style={[styles.languageOptionText, { color: colors.foreground }]}>
                    {language.label}
                  </Text>
                  {selected && <Feather name="check" size={icons.size.lg} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  languageBtn: {
    minWidth: 92,
    height: sizes.iconButton.md,
    borderRadius: radius.sheetCompact,
    borderWidth: 1,
    paddingLeft: 13,
    paddingRight: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: semanticSpacing.compactGap,
  },
  languageBtnText: {
    ...typography.label,
    fontFamily: typography.badge.fontFamily,
  },
  languageBtnFlag: {
    width: sizes.iconButton.sm,
    height: sizes.iconButton.sm,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagSvg: {
    transform: [{ scale: 0.64 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  languageSheet: {
    position: 'absolute',
    left: spacing[0],
    right: spacing[0],
    bottom: spacing[0],
    borderTopLeftRadius: radius.sheetCompact,
    borderTopRightRadius: radius.sheetCompact,
    borderTopWidth: 1,
    paddingTop: spacing[10],
    paddingHorizontal: 22,
    gap: semanticSpacing.comfortableGap,
  },
  sheetHandle: {
    width: 42,
    height: sizes.sheet.handleHeight,
    borderRadius: radius.xxs,
    backgroundColor: '#777',
    alignSelf: 'center',
  },
  sheetTitle: {
    ...typography.h3,
    fontFamily: typography.badge.fontFamily,
  },
  languageOptions: {
    gap: spacing[10],
  },
  languageOption: {
    minHeight: 64,
    borderRadius: sizes.avatar.sm,
    borderWidth: 1.5,
    paddingHorizontal: semanticSpacing.listItemPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: semanticSpacing.rowGap,
  },
  languageOptionFlag: {
    width: sizes.avatar.md,
    height: sizes.avatar.md,
    borderRadius: radius['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  languageOptionText: {
    flex: 1,
    ...typography.title,
    fontFamily: typography.title.fontFamily,
  },
});
