import { describe, it, expect } from 'vitest';
import { getCurrentLocationId, setCurrentLocationId, clearCurrentLocationId } from './current-location';

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const store = { ...initial };
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
}

describe('current location storage', () => {
  it('returns null when nothing is stored', () => {
    expect(getCurrentLocationId(memoryStorage())).toBeNull();
  });

  it('saves and reads the location id', () => {
    const storage = memoryStorage();
    setCurrentLocationId(storage, 'l-1');
    expect(getCurrentLocationId(storage)).toBe('l-1');
  });

  it('clears the stored location id', () => {
    const storage = memoryStorage();
    setCurrentLocationId(storage, 'l-1');
    clearCurrentLocationId(storage);
    expect(getCurrentLocationId(storage)).toBeNull();
  });
});
