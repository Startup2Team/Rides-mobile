import { Alert } from 'react-native';

/** Reason picker shown when a driver declines an incoming ride request. */
export function showDeclineRideAlert(onConfirmDecline: () => void) {
  Alert.alert(
    'Decline request?',
    'Why do you want to decline this ride?',
    [
      { text: 'Too far from pickup', onPress: onConfirmDecline },
      { text: 'Busy right now', onPress: onConfirmDecline },
      { text: 'Wrong vehicle type', onPress: onConfirmDecline },
      { text: 'Other reason', onPress: onConfirmDecline },
      { text: 'Keep request', style: 'cancel' },
    ],
    { cancelable: true },
  );
}
