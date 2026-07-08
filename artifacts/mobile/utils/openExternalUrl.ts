import { Linking } from 'react-native';

export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    if (typeof Linking.canOpenURL === 'function') {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        return false;
      }
    }

    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
