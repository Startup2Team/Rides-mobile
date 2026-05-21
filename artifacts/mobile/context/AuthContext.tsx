import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppMode, DriverProfile, User } from '@/types';

interface AuthContextType {
  user: User | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  saveDriverProfile: (profile: DriverProfile) => Promise<void>;
  switchMode: (mode: AppMode) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@taravelis_user',
  DRIVER_PROFILE: '@taravelis_driver_profile',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  const loadStoredData = async () => {
    try {
      const [userStr, driverStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.DRIVER_PROFILE),
      ]);
      if (userStr) setUser(JSON.parse(userStr));
      if (driverStr) setDriverProfile(JSON.parse(driverStr));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (newUser: User) => {
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setDriverProfile(null);
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
  }, [user]);

  const saveDriverProfile = useCallback(async (profile: DriverProfile) => {
    setDriverProfile(profile);
    await AsyncStorage.setItem(STORAGE_KEYS.DRIVER_PROFILE, JSON.stringify(profile));
  }, []);

  const switchMode = useCallback(async (mode: AppMode) => {
    if (!user) return;
    const updated = { ...user, mode };
    setUser(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      driverProfile,
      isLoading,
      login,
      logout,
      updateUser,
      saveDriverProfile,
      switchMode,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
