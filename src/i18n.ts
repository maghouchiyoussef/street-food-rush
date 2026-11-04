import { save, type Lang } from './save';

// Interface texts in 4 languages (English first).

const T = {
  en: {
    shoo: 'Shoo!',
    world: 'World tour', shop: 'Upgrades', max: 'MAX', streak: 'Day streak', daily: 'Daily reward', claim: 'Collect',
    up_grill: 'Hot grill', upd_grill: 'Food cooks faster', up_patience: 'Comfy queue', upd_patience: 'Customers wait longer',
    up_tips: 'Big tips', upd_tips: 'Happy customers tip more', up_price: 'Gourmet recipe', upd_price: 'Every dish sells for more',
    play: 'Play', levels: 'New York', level: 'Level', target: 'Goal', time: 'Time',
    paused: 'Paused', resume: 'Resume', quit: 'Quit', retry: 'Retry', next: 'Next', menu: 'Menu',
    settings: 'Settings', sound: 'Sound', music: 'Music', haptics: 'Vibration', language: 'Language', back: 'Back',
    timeUp: "Time's up!", earned: 'Earned', served: 'Served', lost: 'Left angry', failed: 'Goal not reached',
    tapStart: 'Tap to start',
    t_sausage: 'Tap the sausages to put one on the grill',
    t_bun: 'Tap the buns to put one on a plate',
    t_wait: 'Wait until the sausage is golden brown',
    t_cooked: 'Tap the cooked sausage to put it in the bun',
    t_sauce: 'This customer wants ketchup: tap the red bottle',
    t_serve: 'Tap the hot dog to serve it!',
    t_burnt: 'Burnt! Tap it to throw it away',
    perfect: 'Perfect!', combo: 'Combo',
  },
  fr: {
    shoo: 'Ouste !',
    world: 'Tour du monde', shop: 'Améliorations', max: 'MAX', streak: 'Jours de suite', daily: 'Cadeau du jour', claim: 'Récupérer',
    up_grill: 'Grill brûlant', upd_grill: 'La cuisson est plus rapide', up_patience: 'File confortable', upd_patience: 'Les clients attendent plus',
    up_tips: 'Gros pourboires', upd_tips: 'Les clients heureux donnent plus', up_price: 'Recette gourmet', upd_price: 'Chaque plat rapporte plus',
    play: 'Jouer', levels: 'New York', level: 'Niveau', target: 'Objectif', time: 'Temps',
    paused: 'Pause', resume: 'Reprendre', quit: 'Quitter', retry: 'Rejouer', next: 'Suivant', menu: 'Menu',
    settings: 'Réglages', sound: 'Son', music: 'Musique', haptics: 'Vibration', language: 'Langue', back: 'Retour',
    timeUp: 'Temps écoulé !', earned: 'Gagné', served: 'Servis', lost: 'Partis fâchés', failed: 'Objectif non atteint',
    tapStart: 'Touchez pour commencer',
    t_sausage: 'Touchez les saucisses pour en griller une',
    t_bun: 'Touchez les pains pour en poser un sur une assiette',
    t_wait: 'Attendez que la saucisse soit dorée',
    t_cooked: 'Touchez la saucisse cuite pour la mettre dans le pain',
    t_sauce: 'Ce client veut du ketchup : touchez la bouteille rouge',
    t_serve: 'Touchez le hot-dog pour le servir !',
    t_burnt: 'Brûlée ! Touchez-la pour la jeter',
    perfect: 'Parfait !', combo: 'Combo',
  },
  es: {
    shoo: '¡Fuera!',
    world: 'Vuelta al mundo', shop: 'Mejoras', max: 'MÁX', streak: 'Días seguidos', daily: 'Regalo diario', claim: 'Recoger',
    up_grill: 'Parrilla potente', upd_grill: 'La comida se cocina más rápido', up_patience: 'Fila cómoda', upd_patience: 'Los clientes esperan más',
    up_tips: 'Buenas propinas', upd_tips: 'Los clientes felices dan más propina', up_price: 'Receta gourmet', upd_price: 'Cada plato se vende más caro',
    play: 'Jugar', levels: 'Nueva York', level: 'Nivel', target: 'Meta', time: 'Tiempo',
    paused: 'Pausa', resume: 'Seguir', quit: 'Salir', retry: 'Repetir', next: 'Siguiente', menu: 'Menú',
    settings: 'Ajustes', sound: 'Sonido', music: 'Música', haptics: 'Vibración', language: 'Idioma', back: 'Volver',
    timeUp: '¡Se acabó el tiempo!', earned: 'Ganado', served: 'Servidos', lost: 'Se fueron enojados', failed: 'Meta no alcanzada',
    tapStart: 'Toca para empezar',
    t_sausage: 'Toca las salchichas para poner una en la parrilla',
    t_bun: 'Toca los panes para poner uno en un plato',
    t_wait: 'Espera a que la salchicha esté dorada',
    t_cooked: 'Toca la salchicha cocida para ponerla en el pan',
    t_sauce: 'Este cliente quiere kétchup: toca la botella roja',
    t_serve: '¡Toca el perrito para servirlo!',
    t_burnt: '¡Quemada! Tócala para tirarla',
    perfect: '¡Perfecto!', combo: 'Combo',
  },
  ar: {
    shoo: 'اذهب!',
    world: 'جولة حول العالم', shop: 'الترقيات', max: 'الأقصى', streak: 'أيام متتالية', daily: 'هدية اليوم', claim: 'خذها',
    up_grill: 'شواية قوية', upd_grill: 'الطبخ أسرع', up_patience: 'طابور مريح', upd_patience: 'الزبائن ينتظرون أكثر',
    up_tips: 'بقشيش كبير', upd_tips: 'الزبائن السعداء يعطون أكثر', up_price: 'وصفة فاخرة', upd_price: 'كل طبق يُباع بثمن أعلى',
    play: 'العب', levels: 'نيويورك', level: 'المستوى', target: 'الهدف', time: 'الوقت',
    paused: 'إيقاف مؤقت', resume: 'تابع', quit: 'خروج', retry: 'أعد', next: 'التالي', menu: 'القائمة',
    settings: 'الإعدادات', sound: 'الأصوات', music: 'الموسيقى', haptics: 'الاهتزاز', language: 'اللغة', back: 'رجوع',
    timeUp: 'انتهى الوقت!', earned: 'الأرباح', served: 'زبائن مخدومون', lost: 'غادروا غاضبين', failed: 'لم تصل إلى الهدف',
    tapStart: 'المس للبدء',
    t_sausage: 'المس النقانق لتضع واحدة على الشواية',
    t_bun: 'المس الخبز لتضع واحدًا في الصحن',
    t_wait: 'انتظر حتى تصبح النقانق ذهبية',
    t_cooked: 'المس النقانق المطهوّة لتضعها في الخبز',
    t_sauce: 'هذا الزبون يريد الكاتشب: المس القارورة الحمراء',
    t_serve: 'المس الهوت دوغ لتقدّمه!',
    t_burnt: 'احترقت! المسها لترميها',
    perfect: 'ممتاز!', combo: 'كومبو',
  },
} as const;

export type Key = keyof typeof T.en;
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' }, { id: 'fr', name: 'Français' }, { id: 'es', name: 'Español' }, { id: 'ar', name: 'العربية' },
];

export const t = (k: Key) => T[save.settings.lang][k] ?? T.en[k];

/** Fills every element that has data-t="key", and sets text direction */
export function applyLang() {
  document.documentElement.lang = save.settings.lang;
  document.documentElement.dir = save.settings.lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll<HTMLElement>('[data-t]').forEach(el => { el.textContent = t(el.dataset.t as Key); });
}
