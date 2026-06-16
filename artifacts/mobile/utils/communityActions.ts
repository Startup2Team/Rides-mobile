import * as StoreReview from 'expo-store-review';
import { Linking, Platform, Share } from 'react-native';
import {
  ANDROID_PACKAGE,
  APP_NAME,
  SUPPORT_EMAIL,
  WEBSITE_URL,
} from '@/constants/branding';

export async function rateRides() {
  if (await StoreReview.isAvailableAsync()) {
    await StoreReview.requestReview();
    return;
  }

  if (Platform.OS === 'android') {
    await Linking.openURL(`market://details?id=${ANDROID_PACKAGE}`);
    return;
  }

  await Linking.openURL(WEBSITE_URL);
}

export async function leaveRidesFeedback() {
  const subject = encodeURIComponent(`${APP_NAME} app feedback`);
  const body = encodeURIComponent(
    `Hi ${APP_NAME} support,\n\nI'd love to share feedback about:\n\n- Bug or issue:\n- Feature suggestion:\n- Other feedback:\n\n`,
  );
  await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
}

export async function shareRides() {
  await Share.share({
    message: `Invite friends and family to experience ${APP_NAME}: ${WEBSITE_URL}`,
    title: `Share ${APP_NAME}`,
    url: WEBSITE_URL,
  });
}
