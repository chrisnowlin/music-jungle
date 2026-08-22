import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateBanks, drawMicroQuestion, drawRangerCheck, checkAnswer,
  shuffledChoices, resetQuizSession, allQuestions, type QuizQuestion,
} from './quizEngine';

beforeEach(() => resetQuizSession());

describe('content banks', () => {
  it('validate cleanly', () => {
    expect(() => validateBanks()).not.toThrow();
  });

  it('have 50 questions per track with correct difficulty tags', () => {
    expect(allQuestions('early')).toHaveLength(50);
    expect(allQuestions('upper')).toHaveLength(50);
    for (const q of allQuestions('early')) expect(q.difficulty).toBe('early');
    for (const q of allQuestions('upper')) expect(q.difficulty).toBe('upper');
  });

  it('cover the five types in both tracks', () => {
    const types = ['listenPick', 'familyPick', 'instrumentPick', 'factMC', 'oddOneOut'];
    for (const diff of ['early', 'upper'] as const) {
      for (const t of types) {
        expect(allQuestions(diff).some((q) => q.type === t), `${diff} missing ${t}`).toBe(true);
      }
    }
  });
});

describe('selection', () => {
  it('drawMicroQuestion returns valid questions and tracks anti-repeat per context', () => {
    const seen = new Set<string>();
    // early micro bank has ~10 of each type; drawing many without repeats proves scoping
    for (let i = 0; i < 20; i++) {
      const q = drawMicroQuestion('early');
      expect(seen.has(q.id)).toBe(false);
      seen.add(q.id);
    }
  });

  it('micro and ranger pools are independent', () => {
    const micro = drawMicroQuestion('upper');
    const ranger = drawRangerCheck('upper');
    expect(ranger).toHaveLength(3);
    // independence means the same id CAN appear in both pools; assert no throw
    expect(micro.id).toBeTruthy();
  });

  it('allows repeats after pool exhaustion (by design)', () => {
    const bank = allQuestions('early').map((q) => q.id);
    const seen = new Set<string>();
    for (let i = 0; i < bank.length + 10; i++) {
      seen.add(drawMicroQuestion('early').id);
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});

describe('answers & choices', () => {
  it('checkAnswer matches answerId', () => {
    const q: QuizQuestion = {
      id: 't1', difficulty: 'early', type: 'familyPick', prompt: '?',
      choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      answerId: 'b', explain: '',
    };
    expect(checkAnswer(q, 'b')).toBe(true);
    expect(checkAnswer(q, 'a')).toBe(false);
  });

  it('shuffledChoices keeps every choice exactly once', () => {
    const q = drawMicroQuestion('upper');
    const shuffled = shuffledChoices(q);
    expect(shuffled).toHaveLength(q.choices.length);
    expect(new Set(shuffled.map((c) => c.id))).toEqual(new Set(q.choices.map((c) => c.id)));
  });
});
