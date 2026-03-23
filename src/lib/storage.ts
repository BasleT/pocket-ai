type StorageArea = 'local' | 'session';

type StoredRecord = Record<string, unknown>;

async function getStorageArea(area: StorageArea): Promise<chrome.storage.StorageArea> {
  if (area === 'local') {
    return chrome.storage.local;
  }

  return chrome.storage.session;
}

export async function storageGet<T>(area: StorageArea, key: string): Promise<T | undefined> {
  const storageArea = await getStorageArea(area);
  const result = await storageArea.get(key);
  return result[key] as T | undefined;
}

export async function storageSet<T>(area: StorageArea, key: string, value: T): Promise<void> {
  const storageArea = await getStorageArea(area);
  await storageArea.set({ [key]: value });
}

export async function storageRemove(area: StorageArea, key: string): Promise<void> {
  const storageArea = await getStorageArea(area);
  await storageArea.remove(key);
}

export async function storageGetMany<T extends StoredRecord>(
  area: StorageArea,
  keys: Array<keyof T>,
): Promise<Partial<T>> {
  const storageArea = await getStorageArea(area);
  const result = await storageArea.get(keys.map((key) => String(key)));
  return result as Partial<T>;
}
