import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

process.env.DATA_DIR = process.env.DATA_DIR || './tmp_refinery_data';
const TMP = path.resolve(process.env.DATA_DIR);

import Refinery from '../umamoe/Refinery/refinery.js';

beforeEach(async () => {
  try { await fs.rm(TMP, { recursive: true, force: true }); } catch (e) {}
  await fs.mkdir(TMP, { recursive: true });
});

afterEach(async () => {
  try { await fs.rm(TMP, { recursive: true, force: true }); } catch (e) {}
});

describe('Refinery', () => {
  it('processes a trusted envelope and writes refined json', async () => {
    const r = new Refinery();
    const env = { trustedData: { id: 't-1', name: 'TestTrainer', fans: 12345 }, metadata: { source: 'unit-test' } };
    const res = await r.processTrusted(env);
    expect(res.success).toBe(true);
    expect(res.refined).toBeTruthy();
    expect(res.refined.id).toBe('t-1');
    expect(res.storage).toBeTruthy();
    const file = res.storage.path;
    const body = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(body);
    expect(parsed.id).toBe('t-1');
    expect(parsed.summary.fans).toBe(12345);
  });
});
