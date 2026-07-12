import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import type { DriverEntitlement } from "@/domain/driverRidePackages";
import { EMPTY_DRIVER_ENTITLEMENT } from "@/domain/driverRidePackages";
import type { Ride } from "@/types";
import DriverStats from "../stats";
import { loadStoredDriverRatings } from "@/persistence/driverRatingPersistence";
import { loadStoredDriverDailyGoals } from "@/persistence/driverDailyGoalPersistence";

let mockSummaryAppStateHandler: undefined | ((state: string) => void);
let mockSummaryFocusCallback: undefined | (() => void | (() => void));
let mockSummaryFocusCleanup: undefined | (() => void);

let mockRideHistory: Ride[] = [];
let mockDriverProfile = {
  acceptanceRate: 80,
  completedRides: 10,
  dailyDeclines: 2,
  dailyRides: 8,
  earningsTotal: 30_000,
  merchantCode: "",
  momoCode: "+250788000000",
};
let mockEntitlement: DriverEntitlement = {
  ...EMPTY_DRIVER_ENTITLEMENT,
  remainingBonusRides: 5,
  remainingRideCredits: 12,
  purchaseHistory: [
    {
      amount: 2_000,
      createdAt: "2026-07-08T10:00:00.000Z",
      packageId: "growth",
      phoneNumber: "+250788000000",
      provider: "mtn",
      status: "successful",
      transactionId: "momo-package:growth:2026-07-08T10:00:00.000Z",
      vehicleId: "driver-vehicle:moto:rad-001-a",
      vehicleType: "moto",
    },
  ],
  updatedAt: "2026-07-08T10:00:00.000Z",
};

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
    Pressable: host("Pressable"),
    ScrollView: host("ScrollView"),
    StyleSheet: {
      create: (styles: object) => styles,
      flatten: (style: object) => style,
      hairlineWidth: 1,
    },
    Text: host("Text"),
    TouchableOpacity: host("TouchableOpacity"),
    useColorScheme: () => "light",
    View: host("View"),
    Animated: {
      Value: jest.fn(() => ({
        interpolate: jest.fn(() => ({})),
        setValue: jest.fn(),
        stopAnimation: jest.fn(),
      })),
      timing: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn((cb) => cb && cb({ finished: true })),
        stop: jest.fn(),
      })),
    },
    AppState: {
      addEventListener: jest.fn((_event, handler) => {
        mockSummaryAppStateHandler = handler;
        return { remove: jest.fn() };
      }),
    },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: jest.fn((cb) => {
    const React = require("react");
    React.useEffect(() => {
      mockSummaryFocusCallback = cb;
      const cleanup = cb();
      mockSummaryFocusCleanup = typeof cleanup === "function" ? cleanup : undefined;
      return cleanup;
    }, [cb]);
  }),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(),
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockSvg = (props: any) => <View {...props} />;
  return {
    __esModule: true,
    default: MockSvg,
    Circle: MockSvg,
    Path: MockSvg,
    G: MockSvg,
    Defs: MockSvg,
    Filter: MockSvg,
    FeGaussianBlur: MockSvg,
    RadialGradient: MockSvg,
    Stop: MockSvg,
    Ellipse: MockSvg,
    ClipPath: MockSvg,
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Feather: Icon, FontAwesome: Icon };
});

jest.mock("@/components/GlassScrollView", () => ({
  GlassScrollView: ({
    children,
    onRefresh,
  }: {
    children?: React.ReactNode;
    onRefresh?: () => void;
  }) => {
    const React = require("react");
    const { Text, View } = require("react-native");
    return (
      <View>
        <Text onPress={onRefresh}>Refresh stats</Text>
        {children}
      </View>
    );
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "driver-1" },
    driverProfile: mockDriverProfile,
  }),
}));

jest.mock("@/context/DriverEntitlementContext", () => ({
  useDriverEntitlement: () => ({
    entitlement: mockEntitlement,
    isLoading: false,
    bonusRides: mockEntitlement.remainingBonusRides,
    rideCredits: mockEntitlement.remainingRideCredits,
    totalAvailableRides:
      mockEntitlement.remainingRideCredits +
      mockEntitlement.remainingBonusRides,
  }),
}));

jest.mock("@/query/hooks/useRideHistoryQuery", () => ({
  useRideHistoryQuery: () => ({
    data: mockRideHistory,
    isLoading: false,
    refetch: jest.fn(async () => ({ data: mockRideHistory })),
  }),
}));

jest.mock("@/persistence/driverRatingPersistence", () => ({
  loadStoredDriverRatings: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock("@/persistence/driverDailyGoalPersistence", () => ({
  loadStoredDriverDailyGoals: jest.fn(() => Promise.resolve({ data: [] })),
}));

function ride(overrides: Partial<Ride>): Ride {
  return {
    agreedFare: 1_000,
    completedAt: "2026-07-08T09:00:00.000Z",
    createdAt: "2026-07-08T08:30:00.000Z",
    customerId: "customer-1",
    destination: { address: "Destination", latitude: -1.95, longitude: 30.08 },
    distance: 4,
    driverId: "driver-1",
    duration: 12,
    id: "ride-1",
    negotiation: [],
    pickup: { address: "Pickup", latitude: -1.94, longitude: 30.06 },
    status: "completed",
    suggestedFare: 900,
    vehicleType: "moto",
    ...overrides,
  };
}

function renderWithQueryClient(ui: React.ReactElement) {
  return render(ui);
}

describe("DriverStats Summary UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date("2026-07-08T14:30:00.000Z") });
    mockSummaryAppStateHandler = undefined;
    mockSummaryFocusCallback = undefined;
    mockSummaryFocusCleanup = undefined;
    mockDriverProfile = {
      acceptanceRate: 80,
      completedRides: 10,
      dailyDeclines: 2,
      dailyRides: 8,
      earningsTotal: 30_000,
      merchantCode: "",
      momoCode: "+250788000000",
    };
    mockRideHistory = [
      ride({
        id: "today-1",
        agreedFare: 1_000,
        completedAt: "2026-07-08T09:00:00.000Z",
      }),
      ride({
        id: "week-1",
        agreedFare: 2_000,
        completedAt: "2026-07-06T12:00:00.000Z",
      }),
      ride({
        id: "month-1",
        agreedFare: 4_000,
        completedAt: "2026-07-01T12:00:00.000Z",
      }),
      ride({
        id: "other-driver",
        driverId: "driver-2",
        agreedFare: 9_000,
        completedAt: "2026-07-08T10:00:00.000Z",
      }),
      ride({
        id: "cancelled",
        status: "cancelled",
        agreedFare: 9_000,
        completedAt: "2026-07-08T10:00:00.000Z",
      }),
    ];
    mockEntitlement = {
      ...EMPTY_DRIVER_ENTITLEMENT,
      remainingBonusRides: 5,
      remainingRideCredits: 12,
      purchaseHistory: [],
      updatedAt: "2026-07-08T10:00:00.000Z",
    };
    (loadStoredDriverRatings as jest.Mock).mockResolvedValue({
      data: [
        {
          authority: "local_prototype",
          driverId: "driver-1",
          id: "rating-1",
          idempotencyKey: "rating-1",
          moderationStatus: "published",
          rideId: "today-1",
          stars: 5,
          createdAt: "2026-07-08T10:00:00.000Z",
        },
      ],
    });
    jest.spyOn(console, "error").mockImplementation((...args) => {
      if (String(args[0]).includes("react-test-renderer is deprecated")) return;
      console.warn(...args);
    });
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("renders the Summary hierarchy and removes package/payment drift", async () => {
    renderWithQueryClient(<DriverStats />);

    await screen.findAllByText(/30,000 RWF/);
    await waitFor(() =>
      expect(screen.getAllByText("1,000 RWF").length).toBeGreaterThan(0),
    );

    expect(screen.getAllByText("Summary").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wednesday/).length).toBeGreaterThan(0);
    expect(screen.getByText("Earnings")).toBeTruthy();
    expect(screen.getByText("Completed Trips")).toBeTruthy();
    expect(screen.getByText("Earnings Per Trip")).toBeTruthy();
    expect(screen.getByText("Driver Rating")).toBeTruthy();
    expect(screen.getByText("Acceptance")).toBeTruthy();
    expect(screen.getByText("Trends")).toBeTruthy();
    expect(screen.getByText("Performance")).toBeTruthy();
    expect(screen.queryByText("Package History")).toBeNull();
    expect(screen.queryByText("Mobile Money Details")).toBeNull();
    expect(screen.queryByText("Bonus Rides")).toBeNull();
  });

  test("does not render fake goals, fake percentages, or fake benchmark language", async () => {
    renderWithQueryClient(<DriverStats />);

    await screen.findAllByText(/30,000 RWF/);
    await waitFor(() =>
      expect(screen.getAllByText("1,000 RWF").length).toBeGreaterThan(0),
    );

    expect(screen.queryAllByText(/goal/i).length).toBe(1);
    expect(screen.queryByText(/50,000/)).toBeNull();
    expect(
      screen.queryByText(/% complete|completion progress|goal progress/i),
    ).toBeNull();
    expect(screen.queryByText(/improved/i)).toBeNull();
    expect(screen.queryByText(/better than/i)).toBeNull();
    expect(screen.queryByText(/top driver/i)).toBeNull();
    expect(screen.queryByText(/local_profile/i)).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
  });

  test("new-driver state renders truthful zero and unavailable states", async () => {
    mockRideHistory = [];
    mockDriverProfile = {
      acceptanceRate: 0,
      completedRides: 0,
      dailyDeclines: 0,
      dailyRides: 0,
      earningsTotal: 0,
      merchantCode: "",
      momoCode: "",
    };
    (loadStoredDriverRatings as jest.Mock).mockResolvedValue({ data: [] });

    renderWithQueryClient(<DriverStats />);

    await screen.findAllByText(/30,000 RWF/);
    await waitFor(() => expect(screen.getByText("0 RWF")).toBeTruthy());

    expect(screen.getByText("--")).toBeTruthy();
    expect(screen.getByText("No rating yet")).toBeTruthy();
    expect(
      screen.getByText("Keep driving to unlock your trends."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Complete trips across more active periods and Rides will show when you perform best.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/random/i)).toBeNull();
    expect(screen.queryByText(/yesterday/i)).toBeNull();
    expect(screen.queryByText(/last week/i)).toBeNull();
  });

  test("updates Summary to the current local day after foregrounding across midnight", async () => {
    renderWithQueryClient(<DriverStats />);
    await waitFor(() =>
      expect(screen.getAllByText(/Wednesday/).length).toBeGreaterThan(0),
    );

    jest.setSystemTime(new Date("2026-07-09T08:00:00.000Z"));
    act(() => mockSummaryAppStateHandler?.("active"));

    await waitFor(() =>
      expect(screen.getAllByText(/Thursday/).length).toBeGreaterThan(0),
    );
  });

  test("animates once on entry and does not replay on unchanged focus", async () => {
    renderWithQueryClient(<DriverStats />);
    await waitFor(() => expect(screen.getByTestId("summary-earnings-progress-ring")).toBeTruthy());
    const progressCalls = () => (Animated.timing as jest.Mock).mock.calls.filter(
      ([, config]) => config.duration === 850,
    ).length;
    expect(progressCalls()).toBe(1);

    act(() => {
      mockSummaryFocusCleanup?.();
      const cleanup = mockSummaryFocusCallback?.();
      mockSummaryFocusCleanup = typeof cleanup === "function" ? cleanup : undefined;
    });
    await Promise.resolve();

    expect(progressCalls()).toBe(1);
  });

  test("a goal change retargets the retained Summary ring once", async () => {
    renderWithQueryClient(<DriverStats />);
    await waitFor(() => expect(screen.getByTestId("summary-earnings-progress-ring")).toBeTruthy());
    const progressCalls = () => (Animated.timing as jest.Mock).mock.calls.filter(
      ([, config]) => config.duration === 850,
    ).length;
    const initialCount = progressCalls();
    (loadStoredDriverDailyGoals as jest.Mock).mockResolvedValue({
      data: [{
        amountRwf: 60_000,
        effectiveFromLocalDate: "2026-07-08",
        createdAt: "2026-07-08T12:00:00.000Z",
        updatedAt: "2026-07-08T12:00:00.000Z",
      }],
    });

    act(() => {
      mockSummaryFocusCleanup?.();
      const cleanup = mockSummaryFocusCallback?.();
      mockSummaryFocusCleanup = typeof cleanup === "function" ? cleanup : undefined;
    });
    await waitFor(() => expect(progressCalls()).toBe(initialCount + 1));
  });
});
