import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { getLegacyDriverPolicyRedirect } from '@/utils/driverVerification';

/**
 * Legacy route retained for old links. Policy acceptance now happens inside
 * onboarding and this route must never create or approve a driver profile.
 */
export default function DriverPolicyScreen() {
  const { driverProfile } = useAuth();
  return <Redirect href={getLegacyDriverPolicyRedirect(driverProfile)} />;
}
