/**
 * quizEngine.ts — question selection with difficulty filtering and
 * per-context anti-repeat. Repeats across sessions are accepted by design.
 * Safe knobs: POOL sizes live in the content JSON files.
 */
import earlyRaw from '../content/quizzes.early.json';
import upperRaw from '../content/quizzes.upper.json';

export type QuizDifficulty = 'early' | 'upper';
export type QuizType = 'listenPick' | 'familyPick' | 'instrumentPick' | 'factMC' | 'oddOneOut';
export type QuizContext = 'micro' | 'ranger' | 'finale';

export interface QuizChoice { id: string; label: string; instrument?: string | null }

export interface QuizQuestion {
  id: string;
  difficulty: QuizDifficulty;
  type: QuizType;
  prompt: string;
  audioInstrument?: string | null;
  choices: QuizChoice[];
  answerId: string;
  explain: string;
  standard?: string;
}

const BANKS: Record<QuizDifficulty, QuizQuestion[]> = {
  early: upperSafe(earlyRaw),
  upper: upperSafe(upperRaw),
};

function upperSafe(raw: unknown): QuizQuestion[] {
  return raw as QuizQuestion[];
}

/** Validate content shape at boot; throws a descriptive error for bad data. */
export function validateBanks(): void {
  for (const [diff, bank] of Object.entries(BANKS)) {
    if (!Array.isArray(bank) || bank.length === 0) throw new Error(`quiz bank ${diff} empty`);
    const ids = new Set<string>();
    for (const q of bank) {
      if (!q.id || ids.has(q.id)) throw new Error(`quiz ${diff}: missing/duplicate id ${q.id}`);
      ids.add(q.id);
      if (!q.prompt || !Array.isArray(q.choices) || q.choices.length < 2) throw new Error(`quiz ${q.id}: bad prompt/choices`);
      if (!q.choices.some((c) => c.id === q.answerId)) throw new Error(`quiz ${q.id}: answer not among choices`);
      if (q.difficulty !== diff) throw new Error(`quiz ${q.id}: wrong difficulty tag`);
    }
  }
}

/** Per-session used-question memory, scoped by context so pools don't collide. */
const usedByContext = new Map<string, Set<string>>();

export function resetQuizSession(): void {
  usedByContext.clear();
}

function nextQuestion(diff: QuizDifficulty, context: QuizContext, types?: QuizType[]): QuizQuestion {
  const key = `${diff}:${context}`;
  let used = usedByContext.get(key);
  if (!used) {
    used = new Set();
    usedByContext.set(key, used);
  }
  let pool = BANKS[diff].filter((q) => (types ? types.includes(q.type) : true));
  let fresh = pool.filter((q) => !used.has(q.id));
  if (fresh.length === 0) {
    // pool exhausted in this session — allow repeats (by design)
    used.clear();
    fresh = pool;
  }
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  used.add(pick.id);
  return pick;
}

/** Shuffled view of choices (never mutates the bank). */
export function shuffledChoices(q: QuizQuestion): QuizChoice[] {
  return [...q.choices].sort(() => Math.random() - 0.5);
}

/* ---------- public API ---------- */

/** Micro-quiz after each discovery: any quick type. */
export function drawMicroQuestion(diff: QuizDifficulty): QuizQuestion {
  return nextQuestion(diff, 'micro');
}

/** Ranger Check at camps: 3 questions, slightly meatier. */
export function drawRangerCheck(diff: QuizDifficulty): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (let i = 0; i < 3; i++) out.push(nextQuestion(diff, 'ranger'));
  return out;
}

export function checkAnswer(q: QuizQuestion, choiceId: string): boolean {
  return q.answerId === choiceId;
}

export function allQuestions(diff: QuizDifficulty): QuizQuestion[] {
  return [...BANKS[diff]];
}
