import { describe, it, expect } from 'vitest';
import { callMiner, endpointIsApproved } from '../umamoe/Miner/miner.js';

// NOTE: these tests are designed to be run with Vitest and a fetch mock (e.g., global.fetch polyfilled).

describe('Miner', () => {
  it('approves known endpoints and rejects unknown', () => {
    expect(endpointIsApproved('/v4/rankings/monthly')).toBe(true);
    expect(endpointIsApproved('/not/allowed')).toBe(false);
  });

  it('returns error envelope for missing endpoint', async () => {
    const res = await callMiner({});
    expect(res.success).toBe(false);
    expect(res.error).toBe('MINER_INVALID_INPUT');
  });

  it('retries transient failures and reports attempts', async () => {
    // Simulate fetch: temporarily replace global.fetch with a failing then success sequence
    let calls = 0;
    global.fetch = async (url, opts) => {
      calls++;
      if(calls < 3){
        const err = new Error('ECONNREFUSED');
        err.code = 'ECONNREFUSED';
        throw err;
      }
      return {
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        headers: { forEach: ()=>{} }
      };
    };

    const res = await callMiner({ endpoint: '/ver' });
    expect(res.success).toBe(true);
    // attempts field was added to miner result metadata so this should exist
    expect(res.metadata && res.metadata.attempts >= 1).toBe(true);
  });
});
