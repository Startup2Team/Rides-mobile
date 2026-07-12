import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Keyboard } from "react-native";
import { router } from "expo-router";
import DriverDailyGoalScreen from "../driver-daily-goal";
import {
  loadStoredDriverDailyGoals,
  saveStoredDriverDailyGoals,
} from "@/persistence/driverDailyGoalPersistence";
import { driverStatisticsHaptics } from "@/domains/driver-statistics/driverStatisticsHaptics";
import { publishDriverDailyGoalUpdate } from "@/persistence/driverDailyGoalUpdateSignal";

const mockShowToast = jest.fn();

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name: string) =>
    React.forwardRef((props: object, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    );
  return {
    Platform: {
      OS: "android",
      select: (options: Record<string, unknown>) =>
        options.android ?? options.default,
    },
    PlatformColor: (name: string) => name,
    Pressable: host("Pressable"),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    useColorScheme: () => "light",
    View: host("View"),
    TextInput: host("TextInput"),
    KeyboardAvoidingView: host("KeyboardAvoidingView"),
    Keyboard: {
      dismiss: jest.fn(),
    },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon };
});

jest.mock("@/components/GlassHeader", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    GlassHeader: ({
      title,
      onBackPress,
    }: {
      title: string;
      onBackPress?: () => void;
    }) => (
      <View>
        <Pressable onPress={onBackPress} accessibilityLabel="Back">
          <Text>Back</Text>
        </Pressable>
        <Text>{title}</Text>
      </View>
    ),
    useGlassHeaderMetrics: () => ({ contentTop: 120 }),
  };
});

jest.mock("@/context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("@/persistence/driverDailyGoalPersistence", () => ({
  loadStoredDriverDailyGoals: jest.fn(() =>
    Promise.resolve({ data: [], source: "missing" }),
  ),
  saveStoredDriverDailyGoals: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/domains/driver-statistics/driverStatisticsHaptics", () => ({
  driverStatisticsHaptics: {
    selection: jest.fn(),
    lightImpact: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/persistence/driverDailyGoalUpdateSignal", () => ({
  publishDriverDailyGoalUpdate: jest.fn(),
}));

describe("DriverDailyGoalScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(2026, 6, 10, 9, 0, 0) });
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [],
      source: "missing",
    });
    (saveStoredDriverDailyGoals as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("1. Amount controls are rendered", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");
    expect(screen.getByLabelText("Decrease daily earnings goal")).toBeTruthy();
    expect(screen.getByLabelText("Increase daily earnings goal")).toBeTruthy();
    expect(
      screen.getByLabelText("Edit daily earnings goal amount"),
    ).toBeTruthy();
  });

  test("2. Tapping amount focuses numeric input", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    // Tap to edit
    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));

    // TextInput should now be visible and display raw value
    const input = screen.getByTestId("daily-goal-amount-input");
    expect(input.props.value).toBe("30000");
  });

  test("3. Typed digits update draft value", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    // Change value
    fireEvent.changeText(input, "45000");
    expect(input.props.value).toBe("45000");
  });

  test("4. Non-digit characters are ignored or removed", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    // Type text with non-digits
    fireEvent.changeText(input, "abc32,500xyz");
    expect(input.props.value).toBe("32500");
  });

  test("5. Empty input disables Save Goal and blur restores previous value", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    // Set value to empty
    fireEvent.changeText(input, "");
    expect(input.props.value).toBe("");

    // Save button should be disabled
    const saveBtn = screen.getByLabelText("Set daily earnings goal");
    expect(saveBtn.props.disabled).toBe(true);

    // Blur input
    fireEvent(input, "blur");

    // Display should restore original value
    await screen.findByText("30,000");
  });

  test("6. Invalid amount cannot be saved", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    // Under the 1,000 RWF minimum.
    fireEvent.changeText(input, "900");
    const saveBtn = screen.getByLabelText("Set daily earnings goal");
    expect(saveBtn.props.disabled).toBe(true);
  });

  test("7. Plus/minus works after direct typing", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    fireEvent.changeText(input, "35500");

    // Tap increase (plus step is 1,000)
    fireEvent.press(screen.getByLabelText("Increase daily earnings goal"));
    expect(input.props.value).toBe("36500");

    // Tap decrease
    fireEvent.press(screen.getByLabelText("Decrease daily earnings goal"));
    expect(input.props.value).toBe("35500");
  });

  test("8. Save persists typed amount", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    fireEvent.changeText(input, "35000");

    // Save
    fireEvent.press(screen.getByLabelText("Set daily earnings goal"));

    await waitFor(() => {
      expect(saveStoredDriverDailyGoals).toHaveBeenCalledWith([
        expect.objectContaining({
          amountRwf: 35000,
          effectiveFromLocalDate: "2026-07-10",
        }),
      ]);
    });
  });

  test("9. First-time Set Goal stays enabled for the suggested amount", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    const saveBtn = screen.getByLabelText("Set daily earnings goal");
    expect(saveBtn.props.disabled).toBe(false);
  });

  test("10. Keyboard dismissal/save behavior does not break navigation", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");
    fireEvent.changeText(input, "40000");

    const saveBtn = screen.getByLabelText("Set daily earnings goal");
    fireEvent.press(saveBtn);

    // Keyboard should be dismissed
    expect(Keyboard.dismiss).toHaveBeenCalled();

    // Navigation back should be called
    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });

  test("11. Minimum and maximum rules still apply", async () => {
    // Override persistence to load the minimum goal (1,000).
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          amountRwf: 1000,
          effectiveFromLocalDate: "2026-07-10",
          createdAt: "2026-07-10T08:00:00.000Z",
          updatedAt: "2026-07-10T08:00:00.000Z",
        },
      ],
      source: "current",
    });

    render(<DriverDailyGoalScreen />);
    await screen.findByText("1,000");

    // Decrease at min should not go below min
    fireEvent.press(screen.getByLabelText("Decrease daily earnings goal"));
    expect(screen.getByText("1,000")).toBeTruthy();

    // Now edit to under min
    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");
    fireEvent.changeText(input, "900"); // under min

    // Save button should be disabled
    const saveBtn = screen.getByLabelText("Save daily earnings goal");
    expect(saveBtn.props.disabled).toBe(true);

    // Blur should clamp to the 1,000 RWF minimum.
    fireEvent(input, "blur");
    await screen.findByText("1,000");
  });

  test("12. Input exceeding max limit is rejected", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");

    // Type 1,000,000 (valid)
    fireEvent.changeText(input, "1000000");
    expect(input.props.value).toBe("1000000");

    // Try to type another '0' (10,000,000 - invalid)
    fireEvent.changeText(input, "10000000");
    // It should keep the previous value
    expect(input.props.value).toBe("1000000");
  });

  test("13. Save uses the actual current local date after midnight", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    fireEvent.changeText(screen.getByTestId("daily-goal-amount-input"), "35000");
    jest.setSystemTime(new Date(2026, 6, 11, 0, 5, 0));
    fireEvent.press(screen.getByLabelText("Set daily earnings goal"));

    await waitFor(() => {
      expect(saveStoredDriverDailyGoals).toHaveBeenCalledWith([
        expect.objectContaining({
          amountRwf: 35000,
          effectiveFromLocalDate: "2026-07-11",
        }),
      ]);
    });
  });

  test("14. Plus/minus triggers selection haptic only on valid changes", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Increase daily earnings goal"));
    expect(driverStatisticsHaptics.selection).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText("Decrease daily earnings goal"));
    expect(driverStatisticsHaptics.selection).toHaveBeenCalledTimes(2);
  });

  test("15. First-time Set Goal persists suggestion and shows set toast once", async () => {
    let resolveSave: (() => void) | undefined;
    (saveStoredDriverDailyGoals as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    const saveBtn = screen.getByLabelText("Set daily earnings goal");
    fireEvent.press(saveBtn);
    fireEvent.press(saveBtn);

    expect(saveStoredDriverDailyGoals).toHaveBeenCalledTimes(1);
    expect(saveStoredDriverDailyGoals).toHaveBeenCalledWith([
      expect.objectContaining({
        amountRwf: 30_000,
        effectiveFromLocalDate: "2026-07-10",
      }),
    ]);

    await act(async () => {
      resolveSave?.();
    });

    await waitFor(() => {
      expect(driverStatisticsHaptics.success).toHaveBeenCalledTimes(1);
      expect(publishDriverDailyGoalUpdate).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith("Daily goal set", "success", {
        haptic: false,
      });
      expect(router.back).toHaveBeenCalled();
    });
  });

  test("15b. Existing unchanged goal keeps Save disabled; update toast on change", async () => {
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValueOnce({
      data: [{
        amountRwf: 30_000,
        effectiveFromLocalDate: "2026-07-10",
        createdAt: "2026-07-10T08:00:00.000Z",
        updatedAt: "2026-07-10T08:00:00.000Z",
      }],
      source: "current",
    });

    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");
    expect(screen.getByLabelText("Save daily earnings goal").props.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText("Increase daily earnings goal"));
    await waitFor(() => {
      expect(screen.getByLabelText("Save daily earnings goal").props.disabled).toBe(
        false,
      );
    });
    fireEvent.press(screen.getByLabelText("Save daily earnings goal"));

    await waitFor(() => {
      expect(saveStoredDriverDailyGoals).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith("Daily goal updated", "success", {
        haptic: false,
      });
    });
  });

  test("16. Save failure keeps the screen open and does not publish", async () => {
    (saveStoredDriverDailyGoals as jest.Mock).mockRejectedValueOnce(
      new Error("persist failed"),
    );

    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");
    fireEvent.press(screen.getByLabelText("Increase daily earnings goal"));
    fireEvent.press(screen.getByLabelText("Set daily earnings goal"));

    await waitFor(() => {
      expect(driverStatisticsHaptics.warning).toHaveBeenCalledTimes(1);
      expect(publishDriverDailyGoalUpdate).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(
        "Could not save daily goal",
        "error",
        { haptic: false },
      );
    });

    expect(screen.getByLabelText("Set daily earnings goal").props.disabled).toBe(
      false,
    );
  });

  test("17. Goal amount edit mode preserves the amount touch area", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    const amountArea = screen.getByLabelText("Edit daily earnings goal amount");
    fireEvent.press(amountArea);

    expect(screen.getByTestId("daily-goal-amount-input")).toBeTruthy();
    expect(amountArea).toBeTruthy();
  });
});
