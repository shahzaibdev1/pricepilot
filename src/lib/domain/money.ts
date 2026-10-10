import type { PricingRule } from './types';
import Decimal from 'decimal.js';
export function parseMoney(value: string, separator: '.' | ','): number {
  let text = value.trim().replace(/^[$€£₹]\s*/, '');
  if (/\s/.test(text)) {
    if (!/^\d{1,3}(?:[\s\u00a0]\d{3})+(?:[.,]\d{1,2})?$/.test(text))
      throw new Error('Invalid price grouping');
    text = text.replace(/[\s\u00a0]/g, '');
  }
  const valid =
    separator === '.'
      ? /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/
      : /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  if (!valid.test(text)) throw new Error('Enter a positive price with at most two decimal places');
  const canonical =
    separator === '.' ? text.replaceAll(',', '') : text.replaceAll('.', '').replace(',', '.');
  const cents = new Decimal(canonical).mul(100).toNumber();
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10000000000)
    throw new Error('Price must be between 0.01 and 100,000,000');
  return cents;
}
export function sellingPrice(costCents: number, rule: PricingRule): number {
  if (
    !Number.isSafeInteger(costCents) ||
    costCents <= 0 ||
    !Number.isFinite(rule.percent) ||
    rule.percent < 0 ||
    (rule.mode === 'margin' && rule.percent >= 100) ||
    rule.percent > 1000
  )
    throw new Error('Invalid pricing rule');
  const cost = new Decimal(costCents);
  const percent = new Decimal(rule.percent).div(100);
  const amount = (
    rule.mode === 'margin' ? cost.div(new Decimal(1).minus(percent)) : cost.mul(percent.plus(1))
  )
    .ceil()
    .toNumber();
  if (!Number.isSafeInteger(amount) || amount > 10000000000)
    throw new Error('Calculated selling price is too large');
  return amount;
}
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
