import { act, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import type { NegotiationMessage } from '@/types';
import { useNegotiationActions } from '../useNegotiationActions';

// Flush the microtask queue so a `void promise.then().catch().finally()`
// chain (as used by dispatchMessage) has settled before assertions run.
async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

function useHarness(sendNegotiationMessage: (text: string, messageId?: string) => Promise<string>) {
  const [messageText, setMessageText] = useState('hello driver');
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  const actions = useNegotiationActions({
    canCounter: false,
    canSendMessage: true,
    counterOffer: () => {},
    currentRide: null,
    declineDriverOffer: () => {},
    messageSending,
    messageText,
    offerText: '',
    pendingMessageId,
    sendNegotiationMessage,
    setCounterLoading: () => {},
    setFareError: () => {},
    setMessageError,
    setMessageSending,
    setMessageText,
    setOfferText: () => {},
    setPendingMessageId,
    setPendingOfferAmount: () => {},
    setShowDriverTyping: () => {},
  });

  return { actions, messageError, messageSending, messageText, pendingMessageId };
}

describe('useNegotiationActions — handleSendMessage / handleRetryMessage', () => {
  // NEG-2 / NEG-3: a failed send must restore the draft + surface the error,
  // never render as delivered, and a retry must reuse the same message id
  // (rideNegotiation.addCustomerTextMessage replaces in place on a matching
  // id) instead of appending a second, duplicate bubble.
  test('failure restores the draft and sets the error; retry reuses the same message id', async () => {
    const sendNegotiationMessage = jest.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('msg-ok');

    const { result } = renderHook(() => useHarness(sendNegotiationMessage));

    await act(async () => {
      result.current.actions.handleSendMessage();
      await flushMicrotasks();
    });

    expect(sendNegotiationMessage).toHaveBeenCalledTimes(1);
    const [firstText, firstId] = sendNegotiationMessage.mock.calls[0];
    expect(firstText).toBe('hello driver');
    expect(typeof firstId).toBe('string');
    expect(result.current.messageText).toBe('hello driver'); // draft restored, not lost
    expect(result.current.messageError).toBe('Message failed to send. Tap send to retry.');
    expect(result.current.pendingMessageId).toBe(firstId); // still tracked for retry
    expect(result.current.messageSending).toBe(false);

    // Retry (tap Send again with the same, restored draft).
    await act(async () => {
      result.current.actions.handleSendMessage();
      await flushMicrotasks();
    });

    expect(sendNegotiationMessage).toHaveBeenCalledTimes(2);
    const [secondText, secondId] = sendNegotiationMessage.mock.calls[1];
    expect(secondText).toBe('hello driver');
    expect(secondId).toBe(firstId); // same id → provider replaces the bubble, no duplicate
    expect(result.current.messageError).toBeNull();
    expect(result.current.pendingMessageId).toBeNull(); // delivered, nothing left pending
  });

  test('handleRetryMessage resends a failed bubble by its own id without touching the draft box', async () => {
    const sendNegotiationMessage = jest.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useHarness(sendNegotiationMessage));

    const failedMessage: NegotiationMessage = {
      id: 'msg-failed-1',
      sender: 'customer',
      type: 'text',
      text: 'are you close?',
      timestamp: new Date().toISOString(),
      deliveryStatus: 'failed',
    };

    await act(async () => {
      result.current.actions.handleRetryMessage(failedMessage);
      await flushMicrotasks();
    });

    expect(sendNegotiationMessage).toHaveBeenCalledWith('are you close?', 'msg-failed-1');
    // The input box's own draft ("hello driver") is untouched by a bubble retry.
    expect(result.current.messageText).toBe('hello driver');
    expect(result.current.pendingMessageId).toBeNull();
  });
});
