const MASTER_KEY_STORAGE_KEY = 'secureMasterKey.v1';

type EncryptedPayload = {
  version: 1;
  iv: string;
  ciphertext: string;
};

type SecretStore = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

function toBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function createMemorySecretStore(initialData: Record<string, unknown> = {}): SecretStore {
  const data = new Map<string, unknown>(Object.entries(initialData));

  return {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}

export function createChromeLocalSecretStore(): SecretStore {
  return {
    async get(key) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
  };
}

async function importRawAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function exportRawAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

export async function getOrCreateMasterKey(store: SecretStore): Promise<CryptoKey> {
  const stored = await store.get(MASTER_KEY_STORAGE_KEY);
  if (typeof stored === 'string' && stored.length > 0) {
    return importRawAesKey(fromBase64(stored));
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await exportRawAesKey(key);
  await store.set(MASTER_KEY_STORAGE_KEY, toBase64(raw));
  return key;
}

export async function encryptSecret(value: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function decryptSecret(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(plaintext);
}

export async function setEncryptedSecret(store: SecretStore, key: string, value: string): Promise<void> {
  const masterKey = await getOrCreateMasterKey(store);
  const encrypted = await encryptSecret(value, masterKey);
  await store.set(`secure.${key}`, encrypted);
}

export async function getEncryptedSecret(store: SecretStore, key: string): Promise<string | undefined> {
  const encrypted = await store.get(`secure.${key}`);
  if (!encrypted || typeof encrypted !== 'object') {
    return undefined;
  }

  const payload = encrypted as EncryptedPayload;
  if (payload.version !== 1 || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string') {
    return undefined;
  }

  const masterKey = await getOrCreateMasterKey(store);
  return decryptSecret(payload, masterKey);
}

export async function removeEncryptedSecret(store: SecretStore, key: string): Promise<void> {
  await store.remove(`secure.${key}`);
}
