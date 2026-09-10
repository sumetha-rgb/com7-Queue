"use client";

type CacheEntry<T> = {
  savedAt: number;
  value: T;
};

const entries = new Map<string, CacheEntry<unknown>>();

export function getCachedPageState<T>(key: string, maxAgeMs = 5 * 60_000): T | null {
  const entry = entries.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.savedAt > maxAgeMs) {
    entries.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedPageState<T>(key: string, value: T) {
  entries.set(key, { savedAt: Date.now(), value });
}
