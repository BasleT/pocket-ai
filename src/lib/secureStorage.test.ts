import { describe, expect, it } from 'vitest';

import {
  createMemorySecretStore,
  decryptSecret,
  encryptSecret,
  getOrCreateMasterKey,
  setEncryptedSecret,
  getEncryptedSecret,
} from './secureStorage';

describe('secureStorage encryption', () => {
  it('encrypts and decrypts secret payloads', async () => {
    const key = await getOrCreateMasterKey(createMemorySecretStore());
    const encrypted = await encryptSecret('super-secret-value', key);
    const decrypted = await decryptSecret(encrypted, key);

    expect(decrypted).toBe('super-secret-value');
    expect(encrypted.ciphertext).not.toContain('super-secret-value');
  });

  it('persists encrypted secrets in storage adapter', async () => {
    const store = createMemorySecretStore();

    await setEncryptedSecret(store, 'groqApiKey', 'abc123');
    const value = await getEncryptedSecret(store, 'groqApiKey');

    expect(value).toBe('abc123');
  });

  it('returns undefined for unknown secret keys', async () => {
    const store = createMemorySecretStore();
    const value = await getEncryptedSecret(store, 'missing');
    expect(value).toBeUndefined();
  });
});
