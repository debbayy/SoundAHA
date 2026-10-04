import { fmtRemaining } from '../sleep';

describe('fmtRemaining', () => {
  it('formats minutes and seconds', () => {
    expect(fmtRemaining(15 * 60_000)).toBe('15:00');
    expect(fmtRemaining(65_000)).toBe('1:05');
  });

  it('rounds up so it never shows 0:00 while running', () => {
    expect(fmtRemaining(200)).toBe('0:01');
    expect(fmtRemaining(0)).toBe('0:00');
    expect(fmtRemaining(-500)).toBe('0:00');
  });

  it('shows hours when needed', () => {
    expect(fmtRemaining(3_600_000 + 5 * 60_000 + 9_000)).toBe('1:05:09');
  });
});
