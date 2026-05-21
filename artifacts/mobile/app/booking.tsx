// This screen is no longer used — booking is now an inline bottom sheet on the home screen.
// Kept as a redirect to avoid broken routes.
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function BookingRedirect() {
  useEffect(() => { router.replace('/(tabs)/'); }, []);
  return null;
}
