import {
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
  loadStoredDriverDailyGoals: jest.fn(() => Promise.resolve({ data: [] })),
  saveStoredDriverDailyGoals: jest.fn(() => Promise.resolve()),
}));

describe("DriverDailyGoalScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(2026, 6, 10, 9, 0, 0) });
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
    const saveBtn = screen.getByLabelText("Save daily earnings goal");
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

    // Under minimum limit (which is now 500)
    fireEvent.changeText(input, "400");
    const saveBtn = screen.getByLabelText("Save daily earnings goal");
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
    fireEvent.press(screen.getByLabelText("Save daily earnings goal"));

    await waitFor(() => {
      expect(saveStoredDriverDailyGoals).toHaveBeenCalledWith([
        expect.objectContaining({
          amountRwf: 35000,
          effectiveFromLocalDate: "2026-07-10",
        }),
      ]);
    });
  });

  test("9. Save button is disabled when amount is unchanged", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    const saveBtn = screen.getByLabelText("Save daily earnings goal");
    expect(saveBtn.props.disabled).toBe(true);
  });

  test("10. Keyboard dismissal/save behavior does not break navigation", async () => {
    render(<DriverDailyGoalScreen />);
    await screen.findByText("30,000");

    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");
    fireEvent.changeText(input, "40000");

    const saveBtn = screen.getByLabelText("Save daily earnings goal");
    fireEvent.press(saveBtn);

    // Keyboard should be dismissed
    expect(Keyboard.dismiss).toHaveBeenCalled();

    // Navigation back should be called
    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });

  test("11. Minimum and maximum rules still apply", async () => {
    // Override persistence to load minimum goal (500)
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          amountRwf: 500,
          effectiveFromLocalDate: "2026-07-10",
          createdAt: "2026-07-10T08:00:00.000Z",
          updatedAt: "2026-07-10T08:00:00.000Z",
        },
      ],
    });

    render(<DriverDailyGoalScreen />);
    await screen.findByText("500");

    // Decrease at min should not go below min
    fireEvent.press(screen.getByLabelText("Decrease daily earnings goal"));
    expect(screen.getByText("500")).toBeTruthy();

    // Now edit to under min
    fireEvent.press(screen.getByLabelText("Edit daily earnings goal amount"));
    const input = screen.getByTestId("daily-goal-amount-input");
    fireEvent.changeText(input, "400"); // under min

    // Save button should be disabled
    const saveBtn = screen.getByLabelText("Save daily earnings goal");
    expect(saveBtn.props.disabled).toBe(true);

    // Blur should clamp to min limit (500)
    fireEvent(input, "blur");
    await screen.findByText("500");
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
});
