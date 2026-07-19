import { describe, it, expect } from 'vitest';
import { loadAdapterByName } from '../Adapters/adapter.js';

describe('Adapters loader', () => {
  it('loads file adapter', async () => {
    const a = await loadAdapterByName('file', { baseDir: './data/test-vault' });
    expect(a).toBeTruthy();
    expect(typeof a.store).toBe('function');
  });

  it('loads inmemory adapter', async () => {
    const a = await loadAdapterByName('inmemory');
    expect(a).toBeTruthy();
    expect(typeof a.store).toBe('function');
  });
});
