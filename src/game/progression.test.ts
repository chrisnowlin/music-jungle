import { describe, it, expect } from 'vitest';
import {
  sortedCount, totalSorted, minigameUnlocked, badgeForStars,
  finaleUnlocked, totalStars, MINIGAME_UNLOCK_COUNT,
} from './progression';

function snap(over: Partial<Parameters<typeof totalSorted>[0]> = {}) {
  return {
    discovered: [], backpack: [], badges: [],
    sorted: {}, minigames: {}, ...over,
  };
}

describe('gates', () => {
  it('count sorted instruments per family and in total', () => {
    const s = snap({ sorted: { strings: ['violin', 'harp'], brass: ['tuba'] } });
    expect(sortedCount(s, 'strings')).toBe(2);
    expect(totalSorted(s)).toBe(3);
  });

  it('unlock mini-games at the threshold only for that family', () => {
    const s = snap({ sorted: { strings: ['violin', 'harp', 'cello'], brass: ['tuba'] } });
    expect(minigameUnlocked(s, 'strings')).toBe(true);
    expect(minigameUnlocked(s, 'brass')).toBe(false);
    expect(MINIGAME_UNLOCK_COUNT).toBe(3);
  });

  it('award badge on >=1 star once', () => {
    const s = snap();
    expect(badgeForStars('strings', 1, s)).toEqual(['strings']);
    const withBadge = snap({ badges: ['strings'] });
    expect(badgeForStars('strings', 3, withBadge)).toEqual([]);
    expect(badgeForStars('strings', 0, s)).toEqual([]);
  });

  it('unlock finale only with all four badges', () => {
    const three = snap({ badges: ['strings', 'woodwinds', 'brass'] });
    expect(finaleUnlocked(three)).toBe(false);
    const four = snap({ badges: ['strings', 'woodwinds', 'brass', 'percussion'] });
    expect(finaleUnlocked(four)).toBe(true);
  });

  it('sums best stars across families', () => {
    const s = snap({ minigames: { strings: { bestStars: 2 }, percussion: { bestStars: 3 } } });
    expect(totalStars(s)).toBe(5);
  });
});
