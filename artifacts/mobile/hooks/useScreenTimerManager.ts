import { useEffect, useRef } from 'react';
import { createRideTimerManager } from '@/context/ride/rideTimerManager';

export function useScreenTimerManager() {
  const managerRef = useRef(createRideTimerManager());
  const manager = managerRef.current;

  useEffect(() => () => {
    manager.endSession();
  }, [manager]);

  return manager;
}
