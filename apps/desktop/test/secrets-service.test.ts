import { describe, it, expect } from 'vitest';
import { SecretName } from '@cockpitzero/shared';
import {
  createSecretsService,
  type SecretStore,
} from '../src/main/services/secrets/secrets-service.js';

/**
 * The secrets service is dependency-inverted over a `SecretStore` port (the real
 * one is `safeStorage` + a file; here it's an in-memory fake), so we can exercise
 * the set/clear/has logic, the status projection, the **no-plaintext** contract,
 * and the unavailable-storage branch — all electron-free, no disk, no keychain.
 */
function fakeStore({ available = true }: { available?: boolean } = {}): SecretStore {
  const map = new Map<string, string>();
  return {
    isAvailable: () => available,
    // The real adapter encrypts here; the fake just holds the plaintext so `get`
    // can round-trip. The point under test is the service's rules, not crypto.
    set: (name, value) => void map.set(name, value),
    get: (name) => map.get(name) ?? null,
    delete: (name) => void map.delete(name),
    has: (name) => map.has(name),
    names: () => [...map.keys()],
  };
}

describe('createSecretsService', () => {
  it('sets, reports status, reads in-process, and clears', () => {
    const service = createSecretsService({ store: fakeStore() });
    const key = SecretName.providerKey('anthropic');

    expect(service.has(key)).toBe(false);
    expect(service.status()[key]).toBeUndefined();

    expect(service.set(key, 'sk-ant-123')).toEqual({ ok: true });
    expect(service.has(key)).toBe(true);
    // status flips the name to true (and never leaks the value).
    expect(service.status()[key]).toBe(true);
    // In-process callers (P3) can read the plaintext back.
    expect(service.get(key)).toBe('sk-ant-123');

    expect(service.delete(key)).toEqual({ ok: true });
    expect(service.has(key)).toBe(false);
    // After clear the name is absent from status — the renderer reads it as false.
    expect(service.status()[key]).toBeUndefined();
    expect(service.get(key)).toBeNull();
  });

  it('trims the value and rejects an empty one (no plaintext stored)', () => {
    const store = fakeStore();
    const service = createSecretsService({ store });
    const key = SecretName.sessionToken;

    expect(service.set(key, '   ')).toEqual({ ok: false });
    expect(store.has(key)).toBe(false);

    expect(service.set(key, '  tok-42  ')).toEqual({ ok: true });
    expect(service.get(key)).toBe('tok-42');
  });

  it('refuses to persist when secure storage is unavailable', () => {
    const store = fakeStore({ available: false });
    const service = createSecretsService({ store });
    const key = SecretName.providerKey('openai');

    expect(service.isAvailable()).toBe(false);
    expect(service.set(key, 'sk-openai-xyz')).toEqual({ ok: false });
    // The defining guarantee: nothing was written — never a plaintext fallback.
    expect(store.has(key)).toBe(false);
    expect(service.status()[key]).toBeUndefined();
  });

  it('clear is idempotent', () => {
    const service = createSecretsService({ store: fakeStore() });
    expect(service.delete(SecretName.oauth('google'))).toEqual({ ok: true });
  });
});
