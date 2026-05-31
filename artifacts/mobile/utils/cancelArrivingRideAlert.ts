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
