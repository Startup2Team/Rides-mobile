// This screen is no longer used — booking is now an inline bottom sheet on the home screen.
// Kept as a redirect to avoid broken routes.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { navigateToCustomerHomeAfterCompletion } from '@/navigation/navigationPolicy';

export default function BookingRedirect() {
  useEffect(() => { navigateToCustomerHomeAfterCompletion(router); }, []);
  return null;
}
