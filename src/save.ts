import { Preferences } from '@capacitor/preferences';

// Progress saved on the phone (Capacitor Preferences; localStorage in the browser).

export type Lang = 'en' | 'fr' | 'es' | 'ar';

export interface SaveData {
  coins: number;
  stars: Record<string, number>;   // best stars per level
  best: Record<string, number>;    // best money per level
  tutorialDone: boolean;
  settings: { sound: boolean; music: boolean; haptics: boolean; lang: Lang };
}

const KEY = 'street-food-rush-save-v1';

export const save: SaveData = {
  coins: 0,
  stars: {},
  best: {},
  tutorialDone: false,
  settings: { sound: true, music: true, haptics: true, lang: 'en' },
};

export async function loadSave() {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      const d = JSON.parse(value) as Partial<SaveData>;
      Object.assign(save, d, { settings: { ...save.settings, ...(d.settings ?? {}) } });
    } else {
      const l = (navigator.language || 'en').slice(0, 2);
      save.settings.lang = (['fr', 'es', 'ar'].includes(l) ? l : 'en') as Lang;
    }
  } catch { /* start fresh */ }
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => { Preferences.set({ key: KEY, value: JSON.stringify(save) }).catch(() => {}); }, 150);
}
