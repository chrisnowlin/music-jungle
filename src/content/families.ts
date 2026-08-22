/**
 * families.ts — the four instrument families: colors, mascots, teaching content.
 * Safe knobs: tweak explainer text or colors here. Adding a 5th family means
 * touching FAMILIES here + landmarks + minigames — it is deliberately localized.
 */
export type Family = 'strings' | 'woodwinds' | 'brass' | 'percussion';

export const FAMILIES: Family[] = ['strings', 'woodwinds', 'brass', 'percussion'];

/** Okabe-Ito colorblind-safe palette; always paired with a mascot icon. */
export const FAMILY_INFO: Record<Family, {
  label: string;
  color: string;
  softColor: string;
  mascot: string;
  landmark: string;
  howSoundEarly: string;
  howSoundUpper: string;
  steps: { icon: string; textEarly: string; textUpper: string }[];
}> = {
  strings: {
    label: 'Strings',
    color: '#E69F00',
    softColor: '#f7e3bd',
    mascot: '🐒',
    landmark: 'Cave of Strings',
    howSoundEarly: 'String instruments make sound when their strings wiggle!',
    howSoundUpper: 'A string instrument sounds when its strings vibrate. Players bow (rub) or pluck the strings, and the hollow body makes the sound bigger.',
    steps: [
      { icon: '🤏', textEarly: 'Pluck or rub the string', textUpper: 'Energy goes into the string by plucking (pizzicato) or bowing (arco).' },
      { icon: '➰', textEarly: 'The string wiggles super fast', textUpper: 'The string vibrates — tighter and shorter strings wiggle faster and sound higher.' },
      { icon: '📦', textEarly: 'The big box makes it louder', textUpper: 'The hollow body resonates, amplifying the vibration into the air.' },
    ],
  },
  woodwinds: {
    label: 'Woodwinds',
    color: '#009E73',
    softColor: '#c9ead9',
    mascot: '🦜',
    landmark: 'Whispering Grove',
    howSoundEarly: 'Wind instruments make sound with your breath! Air dances inside.',
    howSoundUpper: 'Woodwinds sound when air vibrates inside a tube. The player blows across an edge (flute) or through a reed that splits the air (clarinet, saxophone, bassoon).',
    steps: [
      { icon: '💨', textEarly: 'Blow air into the tube', textUpper: 'The player pushes a stream of air into or across the instrument.' },
      { icon: '🌿', textEarly: 'Air wiggles past a reed or edge', textUpper: 'A reed splits the airflow (or the flute\u2019s edge splits it), making the air inside vibrate.' },
      { icon: '🎵', textEarly: 'Cover holes to change the note', textUpper: 'Opening and closing tone holes changes the length of vibrating air — and the pitch.' },
    ],
  },
  brass: {
    label: 'Brass',
    color: '#CC79A7',
    softColor: '#f2d7e6',
    mascot: '🦁',
    landmark: 'Waterfall Falls',
    howSoundEarly: 'Brass players buzz their lips like a raspberry to play!',
    howSoundUpper: 'Brass instruments sound when the player\u2019s lips buzz against the metal mouthpiece. The buzzing air vibrates inside long coiled tubes.',
    steps: [
      { icon: '👄', textEarly: 'Buzz your lips together', textUpper: 'Tightened lips buzz against the cup-shaped mouthpiece — that buzz is the sound.' },
      { icon: '📯', textEarly: 'The buzz zooms through the tube', textUpper: 'The buzz excites the air column inside the coiled tube.' },
      { icon: '🔺', textEarly: 'Press valves or move the slide to change notes', textUpper: 'Valves (or the trombone slide) add tubing length; longer tubes sound lower.' },
    ],
  },
  percussion: {
    label: 'Percussion',
    color: '#0072B2',
    softColor: '#cde3f4',
    mascot: '🐘',
    landmark: 'Fire Circle',
    howSoundEarly: 'Percussion instruments make sound when you hit, shake, or scrape them!',
    howSoundUpper: 'Percussion instruments sound when you strike, shake, or scrape them. A drumhead or bar vibrates; some, like timpani and xylophone, are tuned to exact pitches.',
    steps: [
      { icon: '🥁', textEarly: 'Hit, shake, or scrape it', textUpper: 'Mallets, sticks, or hands put energy in by striking; shakers by shaking.' },
      { icon: '〰️', textEarly: 'It wiggles and makes sound', textUpper: 'The membrane or bar vibrates, pushing sound waves into the air.' },
      { icon: '🎚️', textEarly: 'Some can even play melodies!', textUpper: 'Tuned percussion (timpani, xylophone) plays definite pitches; snare and shaker keep the rhythm.' },
    ],
  },
};
