// Level definitions. City 1: New York, hot dog cart.

export interface LevelDef {
  id: string;
  city: 'nyc';
  duration: number;       // seconds
  target: number;         // coins for 1 star
  sauces: ('k' | 'm')[];  // sauces that can appear in orders
  soda: boolean;
  spawnEvery: number;     // seconds between customers
  patience: number;       // seconds a customer waits
  maxCustomers: number;   // spots at the counter (1-3)
}

export const LEVELS: LevelDef[] = [
  { id: 'nyc-1', city: 'nyc', duration: 75, target: 45, sauces: ['k'], soda: false, spawnEvery: 8, patience: 32, maxCustomers: 2 },
  { id: 'nyc-2', city: 'nyc', duration: 90, target: 80, sauces: ['k', 'm'], soda: false, spawnEvery: 6.5, patience: 28, maxCustomers: 3 },
  { id: 'nyc-3', city: 'nyc', duration: 90, target: 110, sauces: ['k', 'm'], soda: true, spawnEvery: 6, patience: 26, maxCustomers: 3 },
];

export const PRICE = { dog: 5, sauce: 1, soda: 3, perfect: 1 };

export function starsFor(def: LevelDef, money: number) {
  if (money >= def.target * 1.6) return 3;
  if (money >= def.target * 1.3) return 2;
  if (money >= def.target) return 1;
  return 0;
}
