import { KIGALI_CENTER, type RideLocation, type VehicleType } from '@/types';
import { createListenerSet } from './storeUtils';

export type BookingStep = 'idle' | 'drafting' | 'ready' | 'searching' | 'cancelled';

export interface CancelledBookingDraft {
  pickup: RideLocation;
  destination: RideLocation;
  selectedVehicle: VehicleType;
  destText: string;
  cancelledAt: string;
}

export interface BookingState {
  pickup: RideLocation;
  destination: RideLocation | null;
  selectedVehicle: VehicleType;
  fareEstimate: number | null;
  step: BookingStep;
  cancelledDraft: CancelledBookingDraft | null;
  restoreCancelledDraftOnFocus: boolean;
}

const initialState: BookingState = {
  pickup: {
    ...KIGALI_CENTER,
    address: '',
    locationType: 'generic',
  },
  destination: null,
  selectedVehicle: 'moto',
  fareEstimate: null,
  step: 'idle',
  cancelledDraft: null,
  restoreCancelledDraftOnFocus: false,
};

let state = { ...initialState };
const listeners = createListenerSet<BookingState>();

function emit() {
  listeners.notify(state);
}

function update(next: Partial<BookingState> | ((current: BookingState) => Partial<BookingState>)) {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  emit();
}

export function getBookingState() {
  return state;
}

export function setBookingPickup(pickup: RideLocation) {
  update({ pickup, step: 'drafting' });
}

export function setBookingDestination(destination: RideLocation | null) {
  update({
    destination,
    step: destination ? 'ready' : 'drafting',
  });
}

export function setBookingSelectedVehicle(selectedVehicle: VehicleType) {
  update({ selectedVehicle });
}

export function setBookingFareEstimate(fareEstimate: number | null) {
  update({ fareEstimate });
}

export function setBookingStep(step: BookingStep) {
  update({ step });
}

export function captureCancelledBookingDraft(draft: Omit<CancelledBookingDraft, 'cancelledAt'>) {
  update({
    cancelledDraft: {
      ...draft,
      cancelledAt: new Date().toISOString(),
    },
    restoreCancelledDraftOnFocus: true,
    step: 'cancelled',
  });
}

export function restoreCancelledBookingDraft() {
  const cancelledDraft = state.cancelledDraft;
  if (!cancelledDraft) return;
  update({
    pickup: cancelledDraft.pickup,
    destination: cancelledDraft.destination,
    selectedVehicle: cancelledDraft.selectedVehicle,
    restoreCancelledDraftOnFocus: false,
    step: 'drafting',
  });
}

export function clearCancelledBookingDraft() {
  update({ cancelledDraft: null, restoreCancelledDraftOnFocus: false });
}

export function resetBookingStore() {
  state = { ...initialState };
  emit();
}

export function subscribeBookingStore(listener: (state: BookingState) => void) {
  return listeners.add(listener);
}

export function getInitialBookingState() {
  return { ...initialState };
}

