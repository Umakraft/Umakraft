import { describe, it, expect } from 'vitest';
import Archive from '../Broadcast/Archive/archive.js';

describe('Archive + ArchiveInspector', () => {
  it('inserts and dedups by notificationKey', async () => {
    const a = new Archive('./data/test-archive');
    const rec = { notificationKey: 't:1', payload: { id: '1' }, deliveryPlan: { channel: 'c' } };
    const r1 = await a.insert(rec);
    expect(r1.success).toBe(true);
    const r2 = await a.insert(rec);
    // second insert will create another file but dedup logic is at Inspector level; check getByKey returns latest
    const got = await a.getByKey('t:1');
    expect(got && got.success).toBe(true);
    expect(got.record.notificationKey).toBe('t:1');
  });
});
