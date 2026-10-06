export const DAY = 86400;
export const YEAR = 365 * DAY;
export function estimate(coin, settings) {
  const rate = coin.available && coin.difficulty > 0 ? settings.hashrate * 1e12 * settings.uptime / 100 / (coin.difficulty * 2 ** 32) : null;
  const chance = seconds => rate === null ? null : -Math.expm1(-rate * seconds) * 100;
  const blocks = rate === null ? null : rate * DAY;
  const yieldDay = blocks === null || !(coin.reward > 0) ? null : blocks * coin.reward * (1 - settings.fee / 100);
  const revenue = yieldDay === null || !(coin.price > 0) ? null : yieldDay * coin.price;
  const electricity = settings.power / 1000 * 24 * settings.uptime / 100 * settings.electricity;
  return { day: chance(DAY), week: chance(7 * DAY), month: chance(30 * DAY), year: chance(YEAR), wait: rate === null || rate === 0 ? Infinity : 1 / rate / YEAR, yieldDay, revenue, profit: revenue === null ? null : revenue - electricity, electricity, rate };
}
