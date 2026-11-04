import { save } from './save';

// Cart upgrades bought with coins. Each has 3 levels.

export interface Upgrade { id: 'grill' | 'patience' | 'tips' | 'price'; icon: string; cost: number[] }

export const UPGRADES: Upgrade[] = [
  { id: 'grill', icon: '🔥', cost: [120, 320, 700] },     // cooks faster
  { id: 'patience', icon: '⏳', cost: [100, 280, 620] },  // customers wait longer
  { id: 'tips', icon: '💰', cost: [150, 380, 800] },      // bigger tips
  { id: 'price', icon: '⭐', cost: [200, 480, 1000] },    // every dish sells for more
];

export const level = (id: Upgrade['id']) => save.upgrades[id] ?? 0;

export const effects = () => ({
  cookSpeed: 1 + 0.12 * level('grill'),
  patience: 1 + 0.12 * level('patience'),
  tips: 1 + 0.25 * level('tips'),
  bonus: level('price'),
});

export function buy(u: Upgrade): boolean {
  const lv = level(u.id);
  if (lv >= u.cost.length || save.coins < u.cost[lv]) return false;
  save.coins -= u.cost[lv];
  save.upgrades[u.id] = lv + 1;
  return true;
}

/** Daily reward: returns the coins given today (0 if already claimed) */
export function claimDaily(now = new Date()): { coins: number; streak: number } {
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = day(now);
  if (save.daily.last === today) return { coins: 0, streak: save.daily.streak };
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const streak = save.daily.last === day(y) ? save.daily.streak + 1 : 1;
  save.daily = { last: today, streak };
  const coins = 20 * Math.min(streak, 7);
  save.coins += coins;
  return { coins, streak };
}
