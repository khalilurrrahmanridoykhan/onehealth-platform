import { typhoidFever } from './typhoidFever';

describe('typhoid fever', () => {
  it('suspected: met with the fever pattern + one accompanying sign', () => {
    const r = typhoidFever.suspected({ gradualOnsetPersistentHighFever: true, abdominalPain: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with sudden-onset fever (source requires gradual onset)', () => {
    const r = typhoidFever.suspected({ abdominalPain: true, headache: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via stool isolation', () => {
    expect(typhoidFever.confirmed?.({ salmonellaTyphiIsolated: true }).met).toBe(true);
  });
});
