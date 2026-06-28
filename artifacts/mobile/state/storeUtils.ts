export type Listener<T> = (state: T) => void;

export function createListenerSet<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    add(listener: Listener<T>) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify(state: T) {
      listeners.forEach(listener => listener(state));
    },
    clear() {
      listeners.clear();
    },
    size() {
      return listeners.size;
    },
  };
}
