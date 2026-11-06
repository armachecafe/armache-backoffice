const KEY = 'armache.currentLocationId';

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function getCurrentLocationId(storage: MinimalStorage): string | null {
  return storage.getItem(KEY);
}

export function setCurrentLocationId(storage: MinimalStorage, locationId: string): void {
  storage.setItem(KEY, locationId);
}

export function clearCurrentLocationId(storage: MinimalStorage): void {
  storage.removeItem(KEY);
}
