import type { Lang } from './save';

// The six cities: each one has its own cart colors, dish, sauces and drink.

export type MainKind = 'sausage' | 'strip' | 'skewer' | 'crepe';
export type BaseKind = 'bun' | 'tortilla' | 'plate' | 'pita' | 'leaf';

export interface City {
  id: string;
  name: Record<Lang, string>;
  flag: string;
  bg: string;
  dish: string;            // emoji in the order bubble
  drink: string;           // emoji in the order bubble
  main: MainKind;
  mainColors: [number, number, number];   // raw, cooked, burnt
  base: BaseKind;
  sauces: [number, number];               // colors of sauce A and sauce B
  drinkColor: number;
  cart: { body: number; trim: number; awning: [number, number]; machine: number };
  sky: number;             // fog / clear color
}

export const CITIES: City[] = [
  {
    id: 'nyc', flag: '🗽', bg: 'img/nyc.jpg', dish: '🌭', drink: '🥤',
    name: { en: 'New York', fr: 'New York', es: 'Nueva York', ar: 'نيويورك' },
    main: 'sausage', mainColors: [0xe8909a, 0xb5562a, 0x2a1a14], base: 'bun',
    sauces: [0xd8231b, 0xf2c418], drinkColor: 0x5a2a10,
    cart: { body: 0xd6342c, trim: 0xc8ccd2, awning: [0xd6342c, 0xffffff], machine: 0x1e63c9 }, sky: 0xf4a46a,
  },
  {
    id: 'mex', flag: '🌵', bg: 'img/mex.jpg', dish: '🌮', drink: '🥛',
    name: { en: 'Mexico City', fr: 'Mexico', es: 'Ciudad de México', ar: 'مكسيكو' },
    main: 'strip', mainColors: [0xc8505a, 0x8a4a22, 0x2a1810], base: 'tortilla',
    sauces: [0xc8281e, 0x6cb33a], drinkColor: 0xf3ead8,
    cart: { body: 0x1fa58a, trim: 0xf2b134, awning: [0xe8447a, 0xf7d23a], machine: 0xe86a2a }, sky: 0xf6b980,
  },
  {
    id: 'tyo', flag: '🏮', bg: 'img/tyo.jpg', dish: '🍢', drink: '🍵',
    name: { en: 'Tokyo', fr: 'Tokyo', es: 'Tokio', ar: 'طوكيو' },
    main: 'skewer', mainColors: [0xf0c6b0, 0xc77a32, 0x2a1a12], base: 'plate',
    sauces: [0x4a2412, 0xf4ead0], drinkColor: 0x7aa83a,
    cart: { body: 0x2a2a3a, trim: 0xc89a5a, awning: [0x2a3a6a, 0xf4ecdc], machine: 0xc8302a }, sky: 0x8a7ab8,
  },
  {
    id: 'ist', flag: '🕌', bg: 'img/ist.jpg', dish: '🥙', drink: '🥛',
    name: { en: 'Istanbul', fr: 'Istanbul', es: 'Estambul', ar: 'إسطنبول' },
    main: 'skewer', mainColors: [0xc0605a, 0x7a3e1e, 0x241410], base: 'pita',
    sauces: [0xf6f2e6, 0xd2381e], drinkColor: 0xfafaf2,
    cart: { body: 0x1e5aa8, trim: 0xe8c04a, awning: [0xc8202a, 0xffffff], machine: 0x2a8a5a }, sky: 0xf2a070,
  },
  {
    id: 'par', flag: '🗼', bg: 'img/par.jpg', dish: '🥞', drink: '☕',
    name: { en: 'Paris', fr: 'Paris', es: 'París', ar: 'باريس' },
    main: 'crepe', mainColors: [0xf6e6b0, 0xd9a04a, 0x3a2414], base: 'plate',
    sauces: [0x4a2614, 0xd8304a], drinkColor: 0x3a2214,
    cart: { body: 0x2a4a3a, trim: 0xd8c08a, awning: [0x1f3a7a, 0xffffff], machine: 0x8a2a3a }, sky: 0xc8d8ec,
  },
  {
    id: 'bkk', flag: '🛺', bg: 'img/bkk.jpg', dish: '🍢', drink: '🧃',
    name: { en: 'Bangkok', fr: 'Bangkok', es: 'Bangkok', ar: 'بانكوك' },
    main: 'skewer', mainColors: [0xf2c8a8, 0xb8722a, 0x2a1a10], base: 'leaf',
    sauces: [0xc8904a, 0xe8502a], drinkColor: 0xf6a22a,
    cart: { body: 0xe8a020, trim: 0x2a8a6a, awning: [0x8a2ab8, 0xf6d23a], machine: 0xe84a6a }, sky: 0xb87ab0,
  },
];

export const cityOf = (id: string) => CITIES.find(c => c.id === id) ?? CITIES[0];
