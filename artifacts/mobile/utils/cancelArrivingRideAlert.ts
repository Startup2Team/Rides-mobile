import { Alert } from 'react-native';

/** Native reason picker when cancelling while the driver is en route to pickup. */
export function showCancelArrivingRideAlert(onConfirmCancel: () => void) {
  Alert.alert(
    'Cancel ride?',
    'Why do you want to cancel while your driver is on the way?',
    [
      { text: 'Driver too far', onPress: onConfirmCancel },
      { text: 'Changed plans', onPress: onConfirmCancel },
      { text: 'Booked by mistake', onPress: onConfirmCancel },
      { text: 'Keep ride', style: 'cancel' },
    ],
    { cancelable: true },
  );
}

/** Native reason picker when cancelling after the driver has arrived at pickup. */
export function showCancelArrivedRideAlert(onConfirmCancel: () => void) {
  Alert.alert(
    'Cancel ride?',
    'Why are you cancelling after your driver has arrived?',
    [
      { text: 'Driver asked me to cancel', onPress: onConfirmCancel },
      { text: 'Waited too long', onPress: onConfirmCancel },
      { text: 'Changed plans', onPress: onConfirmCancel },
      { text: 'Keep ride', style: 'cancel' },
    ],
    { cancelable: true },
  );
}
