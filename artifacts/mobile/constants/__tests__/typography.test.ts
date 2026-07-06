import { fonts } from '@/constants/fonts';
import { typography } from '@/constants/typography';

describe('typography tokens', () => {
  test('uses the loaded Inter font families', () => {
    expect(fonts.regular).toBe('Inter_400Regular');
    expect(fonts.medium).toBe('Inter_500Medium');
    expect(fonts.semibold).toBe('Inter_600SemiBold');
    expect(fonts.bold).toBe('Inter_700Bold');
  });

  test('defines the Phase 1 reduced typography scale', () => {
    expect(typography.displayXL).toMatchObject({ fontSize: 34, lineHeight: 40, fontFamily: fonts.bold });
    expect(typography.display).toMatchObject({ fontSize: 30, lineHeight: 36, fontFamily: fonts.bold });
    expect(typography.h1).toMatchObject({ fontSize: 24, lineHeight: 30, fontFamily: fonts.bold });
    expect(typography.h2).toMatchObject({ fontSize: 20, lineHeight: 26, fontFamily: fonts.bold });
    expect(typography.h3).toMatchObject({ fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold });
    expect(typography.title).toMatchObject({ fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold });
    expect(typography.body).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: fonts.regular });
    expect(typography.bodySmall).toMatchObject({ fontSize: 14, lineHeight: 20, fontFamily: fonts.regular });
    expect(typography.label).toMatchObject({ fontSize: 13, lineHeight: 18, fontFamily: fonts.medium });
    expect(typography.caption).toMatchObject({ fontSize: 12, lineHeight: 16, fontFamily: fonts.regular });
    expect(typography.tiny).toMatchObject({ fontSize: 11, lineHeight: 14, fontFamily: fonts.medium });
    expect(typography.button).toMatchObject({ fontSize: 16, lineHeight: 20, fontFamily: fonts.semibold });
    expect(typography.tab).toMatchObject({ fontSize: 11, lineHeight: 14, fontFamily: fonts.medium });
    expect(typography.badge).toMatchObject({ fontSize: 11, lineHeight: 14, fontFamily: fonts.bold });
    expect(typography.code).toMatchObject({ fontSize: 12, lineHeight: 16 });
  });
});
