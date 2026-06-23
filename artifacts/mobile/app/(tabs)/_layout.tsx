import { Tabs } from 'expo-router';
import React from 'react';
import { BottomTabBar, customerTabBarIcons } from '@/components/navigation/BottomTabBar';

export default function TabLayout() {
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
          title: 'Home',
          tabBarIcon: customerTabBarIcons.index,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Trips',
          tabBarIcon: customerTabBarIcons.history,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: customerTabBarIcons.profile,
        }}
      />
    </Tabs>
  );
}
