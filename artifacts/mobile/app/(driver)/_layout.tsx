import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessDriverMode } from '@/utils/driverVerification';
import { BottomTabBar, driverTabBarIcons } from '@/components/navigation/BottomTabBar';

export default function DriverTabLayout() {
  const { driverProfile } = useAuth();

  if (!canAccessDriverMode(driverProfile)) return <Redirect href="/driver-submission-confirmation" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: driverTabBarIcons.index,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: driverTabBarIcons.stats,
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          title: 'Share',
          tabBarIcon: driverTabBarIcons.share,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: driverTabBarIcons.profile,
        }}
      />
    </Tabs>
  );
}
