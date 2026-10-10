import { describe, it, expect } from 'vitest';
import { parseMoney, sellingPrice } from '../../src/lib/domain/money';
describe('money parsing', () => {
  it.each([
    ['$1,234.56', '.', 123456],
    ['€ 1.234,56', ',', 123456],
    ['0.01', '.', 1],
    ['12', '.', 1200],
    ['1 234,50', ',', 123450],
  ] as const)('parses %s explicitly', (text, locale, cents) =>
    expect(parseMoney(text, locale)).toBe(cents),
  );
  it.each([
    '',
    '-10',
    '(10)',
    '10abc',
    '1e3',
    'Infinity',
    '=SUM(1)',
    '1,23.45',
    '1.234',
    '0',
    '10.999',
    '9007199254740991',
  ])('rejects invalid cost %s', (text) => expect(() => parseMoney(text, '.')).toThrow());
});
describe('selling prices', () => {
  it('distinguishes markup from gross margin', () => {
    expect(sellingPrice(10000, { mode: 'markup', percent: 25, warningPercent: 20 })).toBe(12500);
    expect(sellingPrice(10000, { mode: 'margin', percent: 25, warningPercent: 20 })).toBe(13334);
  });
  it('rounds upward to keep the target margin', () =>
    expect(sellingPrice(101, { mode: 'margin', percent: 30, warningPercent: 20 })).toBe(145));
  it.each([100, -1, NaN])('rejects invalid margin %s', (percent) =>
    expect(() => sellingPrice(100, { mode: 'margin', percent, warningPercent: 20 })).toThrow(),
  );
});
