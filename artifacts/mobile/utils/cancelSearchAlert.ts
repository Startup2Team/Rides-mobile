import { Alert } from 'react-native';

export interface CancelSearchAlertOptions {
  /** Pause driver matching while the alert is visible (searching screen). */
  onPauseMatching?: () => void;
  /** Resume matching when the user taps Continue searching or dismisses the alert. */
  onResumeMatching?: () => void;
}

/** Shared cancel-search reason sheet for searching + negotiation flows. */
export function showCancelSearchAlert(
  onConfirmCancel: () => void,
  options?: CancelSearchAlertOptions,
) {
  options?.onPauseMatching?.();

  const resumeMatching = () => {
    options?.onResumeMatching?.();
  };

  Alert.alert(
    'Cancel search?',
    'Any reason you want to stop matching you with a nearby driver?',
    [
      { text: 'Search is taking too long', onPress: onConfirmCancel },
      { text: 'I changed my mind', onPress: onConfirmCancel },
      { text: 'Wrong pickup or drop off', onPress: onConfirmCancel },
      { text: 'Found another option', onPress: onConfirmCancel },
      { text: 'Continue searching', style: 'cancel', onPress: resumeMatching },
    ],
    { cancelable: true, onDismiss: resumeMatching },
  );
}
