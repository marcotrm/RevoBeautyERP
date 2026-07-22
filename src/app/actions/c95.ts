'use server';

import { getC95Config, saveC95Config, testC95Connection, type C95Config } from '@/lib/c95';

export async function loadC95Config() {
  const cfg = await getC95Config();
  // Non esporre mai il token di sessione al client.
  const { token, tokenExpiresAt, ...safe } = cfg;
  void token; void tokenExpiresAt;
  return safe;
}

export async function saveC95ConfigAction(cfg: Omit<C95Config, 'token' | 'tokenExpiresAt'>) {
  await saveC95Config(cfg);
  return { ok: true };
}

export async function testC95ConnectionAction() {
  return testC95Connection();
}
