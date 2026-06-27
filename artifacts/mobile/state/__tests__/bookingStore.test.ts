import {
  captureCancelledBookingDraft,
  clearCancelledBookingDraft,
  getBookingState,
  getInitialBookingState,
  resetBookingStore,
  setBookingDestination,
  setBookingFareEstimate,
  setBookingPickup,
  setBookingSelectedVehicle,
  setBookingStep,
  restoreCancelledBookingDraft,
} from '../bookingStore';

describe('bookingStore', () => {
  afterEach(() => {
    resetBookingStore();
  });

  test('tracks draft state and restores cancelled drafts', () => {
    setBookingPickup({
      latitude: -1,
      longitude: 30,
      address: 'Pickup',
      locationType: 'precise',
    });
    setBookingDestination({
      latitude: -2,
      longitude: 31,
      address: 'Dropoff',
      locationType: 'precise',
    });
    setBookingSelectedVehicle('cab');
    setBookingFareEstimate(1234);
    setBookingStep('searching');

    captureCancelledBookingDraft({
      pickup: getBookingState().pickup,
      destination: getBookingState().destination!,
      selectedVehicle: getBookingState().selectedVehicle,
      destText: 'Dropoff',
    });

    resetBookingStore();
    expect(getBookingState()).toEqual(getInitialBookingState());

    captureCancelledBookingDraft({
      pickup: {
        latitude: -1,
        longitude: 30,
        address: 'Pickup',
        locationType: 'precise',
      },
      destination: {
        latitude: -2,
        longitude: 31,
        address: 'Dropoff',
        locationType: 'precise',
      },
      selectedVehicle: 'moto',
      destText: 'Dropoff',
    });

    restoreCancelledBookingDraft();
    expect(getBookingState().restoreCancelledDraftOnFocus).toBe(false);
    expect(getBookingState().step).toBe('drafting');

    clearCancelledBookingDraft();
    expect(getBookingState().cancelledDraft).toBeNull();
  });
});

