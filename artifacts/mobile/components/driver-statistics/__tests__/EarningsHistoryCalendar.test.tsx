import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { EarningsHistoryCalendar } from '../EarningsHistoryCalendar';
import {
  createEmptyDriverDailyStatistics,
  getCalendarIndexForLocalDate,
  getCalendarTotalMonths,
} from '@/domains/driver-statistics';

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  return {
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    Pressable: host('Pressable'),
    View: host('View'),
    Text: host('Text'),
    FlatList: React.forwardRef(
      (
        props: {
          data?: Array<number>;
          renderItem?: (info: { item: number; index: number }) => React.ReactNode;
          keyExtractor?: (item: number, index: number) => string;
          testID?: string;
          initialScrollIndex?: number;
        },
        ref: unknown,
      ) => {
        const { data = [], renderItem, keyExtractor, testID, initialScrollIndex = 0 } = props;
        const center = Math.min(Math.max(0, initialScrollIndex), Math.max(0, data.length - 1));
        const start = Math.max(0, center - 2);
        const end = Math.min(data.length - 1, center + 2);
        const nodes = [];
        for (let index = start; index <= end; index += 1) {
          const item = data[index];
          nodes.push(
            React.createElement(
              React.Fragment,
              { key: keyExtractor ? keyExtractor(item, index) : String(index) },
              renderItem ? renderItem({ item, index }) : null,
            ),
          );
        }
        return React.createElement(
          'FlatList',
          {
            ref,
            testID,
            initialScrollIndex,
            dataLength: data.length,
          },
          nodes,
        );
      },
    ),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    useColorScheme: () => 'light',
  };
});

jest.mock('@/hooks/useColors', () => ({
  useColors: () => ({
    foreground: '#000',
    mutedForeground: '#666',
    muted: '#eee',
    card: '#fff',
    border: '#ddd',
    destructiveHex: '#f00',
  }),
}));

jest.mock('@/components/AppText', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    AppText: ({ children, ...props }: { children?: React.ReactNode }) => (
      <Text {...props}>{children}</Text>
    ),
  };
});

const progressRingProps: Array<Record<string, unknown>> = [];
const mockMonthBuildSpy = jest.fn();

jest.mock('@/components/driver-statistics/ProgressRing', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    ProgressRing: (props: {
      children?: React.ReactNode;
      animationMode?: string;
      progress?: number;
      goalState?: string;
    }) => {
      progressRingProps.push(props);
      return (
        <View testID="calendar-progress-ring">
          <Text>{`mode:${props.animationMode}`}</Text>
          <Text>{`goal:${props.goalState}`}</Text>
          {props.children}
        </View>
      );
    },
  };
});

jest.mock('@/domains/driver-statistics', () => {
  const actual = jest.requireActual('@/domains/driver-statistics');
  return {
    ...actual,
    buildDriverStatisticsCalendarMonthAtIndex: (args: unknown) => {
      mockMonthBuildSpy(args);
      return actual.buildDriverStatisticsCalendarMonthAtIndex(args);
    },
  };
});

describe('EarningsHistoryCalendar', () => {
  beforeEach(() => {
    progressRingProps.length = 0;
    mockMonthBuildSpy.mockClear();
  });

  const baseIndex = new Map([
    [
      '2026-07-08',
      {
        ...createEmptyDriverDailyStatistics('2026-07-08'),
        earningsRwf: 12_000,
      },
    ],
  ]);

  const goals = [
    {
      amountRwf: 30_000,
      effectiveFromLocalDate: '2026-07-01',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ];

  test('FlatList receives lightweight index data and only builds nearby months', () => {
    const { UNSAFE_getByType } = render(
      <EarningsHistoryCalendar
        todayLocalDate="2026-07-10"
        selectedLocalDate="2026-07-08"
        dailyStatisticsIndex={baseIndex}
        goalRecords={goals}
        accentColor="#111"
        onSelectDate={jest.fn()}
      />,
    );

    const list = UNSAFE_getByType('FlatList' as never);
    expect(list.props.dataLength).toBe(getCalendarTotalMonths('2026-07-10'));
    expect(list.props.initialScrollIndex).toBe(
      getCalendarIndexForLocalDate('2026-07-08', '2026-07-10'),
    );
    expect(mockMonthBuildSpy.mock.calls.length).toBeLessThan(10);
    expect(mockMonthBuildSpy.mock.calls.length).toBeGreaterThan(0);
    expect(screen.getByTestId('calendar-month-2026-07')).toBeTruthy();
    expect(screen.getByTestId('calendar-month-abbrev-2026-07')).toBeTruthy();
    expect(screen.getByText('Jul')).toBeTruthy();
    expect(screen.queryByTestId('calendar-month-2026-08')).toBeNull();
  });

  test('visible month renders correctly for year 1500', () => {
    render(
      <EarningsHistoryCalendar
        todayLocalDate="2026-07-10"
        selectedLocalDate="1500-01-15"
        dailyStatisticsIndex={new Map()}
        goalRecords={[]}
        accentColor="#111"
        onSelectDate={jest.fn()}
      />,
    );

    expect(screen.getByTestId('calendar-month-1500-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-1500-01-15').props.accessibilityState.selected).toBe(
      true,
    );
  });

  test('future dates are disabled and calendar rings stay static', () => {
    render(
      <EarningsHistoryCalendar
        todayLocalDate="2026-07-10"
        selectedLocalDate="2026-07-10"
        dailyStatisticsIndex={baseIndex}
        goalRecords={goals}
        accentColor="#111"
        onSelectDate={jest.fn()}
      />,
    );

    expect(screen.getByTestId('calendar-day-2026-07-11').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(progressRingProps.every((props) => props.animationMode === 'none')).toBe(true);
  });

  test('selecting a date before account creation is allowed', () => {
    const onSelectDate = jest.fn();
    render(
      <EarningsHistoryCalendar
        todayLocalDate="2026-07-10"
        selectedLocalDate="1500-01-15"
        dailyStatisticsIndex={new Map()}
        goalRecords={[]}
        accentColor="#111"
        onSelectDate={onSelectDate}
      />,
    );

    fireEvent.press(screen.getByTestId('calendar-day-1500-01-10'));
    expect(onSelectDate).toHaveBeenCalledWith('1500-01-10');
  });
});
