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
import { useColors } from '@/hooks/useColors';

const LANGUAGE_FLAGS = ['rw', 'uk'] as const;
type LanguageFlag = typeof LANGUAGE_FLAGS[number];

const LANGUAGES: { label: string; value: LanguageFlag }[] = [
  { label: 'Kinyarwanda', value: 'rw' },
  { label: 'English', value: 'uk' },
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
  const [languageFlag, setLanguageFlag] = useState<LanguageFlag>('rw');
  const [showLanguageSheet, setShowLanguageSheet] = useState(false);

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
        style={[styles.languageBtn, { backgroundColor: colors.card }]}
        activeOpacity={0.8}
      >
        <FlagPreview flag={languageFlag} />
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
                      backgroundColor: selected ? colors.primary + '18' : colors.card,
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
                  {selected && <Feather name="check" size={20} color={colors.primary} />}
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flagSvg: {
    transform: [{ scale: 1.05 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  languageSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 22,
    gap: 16,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#777',
    alignSelf: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  languageOptions: {
    gap: 10,
  },
  languageOption: {
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageOptionFlag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  languageOptionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
