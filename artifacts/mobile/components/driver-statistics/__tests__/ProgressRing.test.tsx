import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { ProgressRing, PROGRESS_CHANGE_EPSILON } from '../ProgressRing';
import { DRIVER_STATISTICS_MOTION } from '@/domains/driver-statistics/driverStatisticsMotion';

const mockTimingAnimations: Array<{
  config: { duration: number; toValue: number };
  start: jest.Mock;
  stop: jest.Mock;
}> = [];
const mockSequences: Array<{ start: jest.Mock; stop: jest.Mock }> = [];
const mockAnimatedValues: Array<{
  interpolate: jest.Mock;
  setValue: jest.Mock;
  stopAnimation: jest.Mock;
}> = [];

jest.mock('react-native', () => {
  const React = require('react');
  const host = (name: string) => React.forwardRef((props: object, ref: unknown) =>
    React.createElement(name, { ...props, ref }));
  const Value = jest.fn(() => {
    const value = {
      interpolate: jest.fn(() => ({})),
      setValue: jest.fn(),
      stopAnimation: jest.fn(),
    };
    mockAnimatedValues.push(value);
    return value;
  });
  return {
    View: host('View'),
    StyleSheet: {
      absoluteFill: {},
      absoluteFillObject: {},
      create: (styles: object) => styles,
      flatten: (style: object) => style,
    },
    Easing: {
      cubic: 'cubic',
      out: jest.fn(value => value),
      inOut: jest.fn(value => value),
    },
    InteractionManager: {
      runAfterInteractions: jest.fn(callback => {
        callback();
        return { cancel: jest.fn() };
      }),
    },
    Animated: {
      Value,
      createAnimatedComponent: (Component: unknown) => Component,
      timing: jest.fn((_value, config) => {
        const animation = {
          config,
          start: jest.fn(),
          stop: jest.fn(),
        };
        mockTimingAnimations.push(animation);
        return animation;
      }),
      sequence: jest.fn(() => {
        const sequence = { start: jest.fn(), stop: jest.fn() };
        mockSequences.push(sequence);
        return sequence;
      }),
    },
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const host = (name: string) => (props: object) => React.createElement(name, props);
  return {
    __esModule: true,
    default: host('Svg'),
    Circle: host('Circle'),
    Defs: host('Defs'),
    FeGaussianBlur: host('FeGaussianBlur'),
    Filter: host('Filter'),
    G: host('G'),
    Path: host('Path'),
  };
});

function progressAnimations() {
  return mockTimingAnimations.filter(animation =>
    animation.config.duration === DRIVER_STATISTICS_MOTION.ringEntryMs
    || animation.config.duration === DRIVER_STATISTICS_MOTION.ringUpdateMs,
  );
}

function accessibilityNow(progress: number) {
  return {
    min: 0,
    max: 100,
    now: Math.round(Math.min(1, progress) * 100),
  };
}

function renderRing(overrides: Partial<React.ComponentProps<typeof ProgressRing>> = {}) {
  return render(
    <ProgressRing
      size={250}
      strokeWidth={50}
      progress={0.5}
      color="#FF2D55"
      trackColor="#FF2D55"
      {...overrides}
    />,
  );
}

describe('ProgressRing animation lifecycle', () => {
  beforeEach(() => {
    mockTimingAnimations.length = 0;
    mockSequences.length = 0;
    mockAnimatedValues.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('entry animation starts from zero when allowed', () => {
    renderRing({ animationMode: 'entry-and-updates' });

    expect(mockAnimatedValues[0].setValue).toHaveBeenCalledWith(0);
    expect(progressAnimations()).toHaveLength(1);
    expect(progressAnimations()[0].config.toValue).toBe(0.5);
    expect(progressAnimations()[0].config.duration).toBe(DRIVER_STATISTICS_MOTION.ringEntryMs);
  });

  test('entry-disabled and static rings render the target immediately', () => {
    renderRing({ animationMode: 'updates-only' });
    expect(progressAnimations()).toHaveLength(0);

    mockTimingAnimations.length = 0;
    renderRing({ animationMode: 'none', progress: 0.75 });
    expect(progressAnimations()).toHaveLength(0);
  });

  test('same target and changes below epsilon do not restart', () => {
    const view = renderRing();
    expect(progressAnimations()).toHaveLength(1);

    view.rerender(
      <ProgressRing size={250} strokeWidth={50} progress={0.5} color="#FF2D55" />,
    );
    view.rerender(
      <ProgressRing
        size={250}
        strokeWidth={50}
        progress={0.5 + PROGRESS_CHANGE_EPSILON / 2}
        color="#FF2D55"
      />,
    );

    expect(progressAnimations()).toHaveLength(1);
  });

  test('meaningful increase and decrease retarget from the retained value', () => {
    const view = renderRing();
    const first = progressAnimations()[0];

    view.rerender(
      <ProgressRing size={250} strokeWidth={50} progress={0.9} color="#FF2D55" />,
    );
    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(progressAnimations().at(-1)?.config.toValue).toBe(0.9);
    expect(progressAnimations().at(-1)?.config.duration).toBe(DRIVER_STATISTICS_MOTION.ringUpdateMs);
    expect(mockAnimatedValues[0].setValue).toHaveBeenCalledTimes(1);

    view.rerender(
      <ProgressRing size={250} strokeWidth={50} progress={0.2} color="#FF2D55" />,
    );
    expect(progressAnimations().at(-1)?.config.toValue).toBe(0.2);
    expect(mockAnimatedValues[0].setValue).toHaveBeenCalledTimes(1);
  });

  test('rapid progress changes retain only the latest target', () => {
    const view = renderRing();
    view.rerender(<ProgressRing size={250} strokeWidth={50} progress={0.7} color="#FF2D55" />);
    view.rerender(<ProgressRing size={250} strokeWidth={50} progress={1.4} color="#FF2D55" />);

    expect(progressAnimations().at(-1)?.config.toValue).toBe(1.4);
    expect(progressAnimations().slice(0, -1).every(animation => animation.stop.mock.calls.length === 1)).toBe(true);
  });

  test('arrow runs only for allowed entry and meaningful updates', () => {
    const view = renderRing({ showArrow: true, animateArrow: true });
    expect(mockSequences).toHaveLength(1);

    view.rerender(
      <ProgressRing size={250} strokeWidth={50} progress={0.5} color="#FF2D55" showArrow animateArrow />,
    );
    expect(mockSequences).toHaveLength(1);

    view.rerender(
      <ProgressRing size={250} strokeWidth={50} progress={0.8} color="#FF2D55" showArrow animateArrow />,
    );
    expect(mockSequences).toHaveLength(2);
  });

  test('disabled arrow and reduced motion run no animations', () => {
    renderRing({ showArrow: true, animateArrow: false });
    expect(mockSequences).toHaveLength(0);

    mockTimingAnimations.length = 0;
    renderRing({ showArrow: true, animateArrow: true, reducedMotion: true });
    expect(progressAnimations()).toHaveLength(0);
    expect(mockSequences).toHaveLength(0);
  });

  test('entry delay defers the first draw without hiding the ring', () => {
    renderRing({ entryDelayMs: 60 });
    expect(progressAnimations()).toHaveLength(0);
    expect(screen.getByTestId('progress-ring')).toBeTruthy();

    jest.advanceTimersByTime(60);
    expect(progressAnimations()).toHaveLength(1);
  });

  test('unmount stops active progress and arrow animations', () => {
    const view = renderRing({ showArrow: true, animateArrow: true });
    const progress = progressAnimations()[0];
    const arrow = mockSequences[0];

    view.unmount();

    expect(progress.stop).toHaveBeenCalled();
    expect(arrow.stop).toHaveBeenCalled();
  });

  test('compact overflow omits full shadow and bridge detail', () => {
    renderRing({ animationMode: 'none', detailLevel: 'compact', progress: 1.5 });

    expect(screen.getByTestId('progress-ring-overflow-arc')).toBeTruthy();
    expect(screen.getByTestId('progress-ring-raised-cap')).toBeTruthy();
    expect(screen.queryByTestId('progress-ring-overflow-shadow')).toBeNull();
    expect(screen.queryByTestId('progress-ring-cap-bridge')).toBeNull();
  });

  test('full overflow preserves bridge, shadow, and raised cap layers', () => {
    renderRing({ animationMode: 'none', detailLevel: 'full', progress: 2.5 });

    expect(screen.getByTestId('progress-ring-overflow-arc')).toBeTruthy();
    expect(screen.getByTestId('progress-ring-cap-bridge')).toBeTruthy();
    expect(screen.getByTestId('progress-ring-overflow-shadow')).toBeTruthy();
    expect(screen.getByTestId('progress-ring-raised-cap')).toBeTruthy();
  });

  test.each([0, 1, 1.5, 3.25])('static mode settles progress %s without animation', progress => {
    renderRing({ animationMode: 'none', progress });
    expect(screen.getByTestId('progress-ring').props.accessibilityValue).toEqual(
      accessibilityNow(progress),
    );
    expect(progressAnimations()).toHaveLength(0);
  });

  test('unconfigured goal renders inactive track with arrow badge and no progress layers', () => {
    renderRing({
      goalState: 'unconfigured',
      progress: 0.8,
      showArrow: true,
      animateArrow: false,
      showStartCapAtZero: true,
      animationMode: 'entry-and-updates',
    });

    expect(screen.getByTestId('progress-ring').props.accessibilityLabel).toBe(
      'Daily earnings goal not set.',
    );
    expect(screen.getByTestId('progress-ring').props.accessibilityValue).toEqual(
      accessibilityNow(0),
    );
    expect(screen.getByTestId('progress-ring-arrow-badge')).toBeTruthy();
    expect(screen.queryByTestId('progress-ring-zero-start-cap')).toBeNull();
    expect(screen.queryByTestId('progress-ring-overflow-arc')).toBeNull();
    expect(screen.queryByTestId('progress-ring-raised-cap')).toBeNull();
    expect(screen.queryByTestId('progress-ring-overflow-shadow')).toBeNull();
    expect(progressAnimations()).toHaveLength(0);
  });

  test('configured zero progress can still show the start cap', () => {
    renderRing({
      goalState: 'configured',
      progress: 0,
      showArrow: false,
      showStartCapAtZero: true,
      animationMode: 'none',
    });

    expect(screen.getByTestId('progress-ring-zero-start-cap')).toBeTruthy();
    expect(screen.queryByTestId('progress-ring-arrow-badge')).toBeNull();
  });
});
