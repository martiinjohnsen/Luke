import {
  correctChoices,
  isQuestionComplete,
  isQuizResponseCorrect,
  questionsForDoor,
  validQuizResponse,
  type AdventCalendar,
  type QuizQuestion,
  type QuizResponse,
} from "./model.ts";
export type QuizAttempt = QuizResponse;
export type QuizProgress = Record<string, QuizAttempt>;
export function questionKey(
  day: number,
  index: number,
  question: QuizQuestion,
): string {
  if (question.remote) return question.remote.key;
  // Keep the original key for unchanged, single-answer questions in existing calendars.
  const definition: unknown[] = [
    day,
    index,
    question.title,
    question.options,
    question.answerIndex,
  ];
  if (question.type === "text")
    definition.push("text", question.acceptedAnswers);
  else if (
    JSON.stringify(correctChoices(question)) !==
    JSON.stringify([question.answerIndex])
  )
    definition.push(correctChoices(question));
  const value = JSON.stringify(definition);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${day}-${index}-${(hash >>> 0).toString(36)}`;
}
export function parseQuizProgress(raw: string | null): QuizProgress {
  if (!raw || raw.length > 1200000) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([key, value]) => {
        if (
          !/^\d{1,2}-\d{1,2}-[a-z0-9]+$/.test(key) ||
          !value ||
          typeof value !== "object"
        )
          return false;
        const attempt = value as QuizResponse;
        const fields = [
          attempt.answer !== undefined,
          attempt.answers !== undefined,
          attempt.text !== undefined,
        ].filter(Boolean).length;
        if (fields !== 1) return false;
        if (attempt.text !== undefined)
          return (
            typeof attempt.text === "string" &&
            attempt.text.trim().length > 0 &&
            attempt.text.length <= 300
          );
        if (attempt.answers !== undefined)
          return (
            Array.isArray(attempt.answers) &&
            attempt.answers.length > 0 &&
            attempt.answers.length <= 12 &&
            new Set(attempt.answers).size === attempt.answers.length &&
            attempt.answers.every(
              (answer) =>
                Number.isInteger(answer) && answer >= 0 && answer < 12,
            )
          );
        return (
          Number.isInteger(attempt.answer) &&
          attempt.answer! >= 0 &&
          attempt.answer! < 12
        );
      }),
    );
  } catch {
    return {};
  }
}
export function quizSummary(
  calendar: AdventCalendar,
  progress: QuizProgress,
  available = 24,
) {
  let total = 0,
    answered = 0,
    correct = 0,
    unlocked = 0;
  const days = calendar.doors
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((door) => {
      const questions = questionsForDoor(door, calendar).filter(
        isQuestionComplete,
      );
      let dayAnswered = 0,
        dayCorrect = 0;
      const hiddenCount =
        calendar.remote && door.day > available
          ? ((calendar.serverQuizCounts ?? calendar.quizCounts)?.[
              String(door.day)
            ] ?? 0)
          : 0;
      total += hiddenCount;
      questions.forEach((question, index) => {
        total++;
        if (door.day > available) return;
        unlocked++;
        const attempt = progress[questionKey(door.day, index, question)];
        if (!attempt || !validQuizResponse(question, attempt)) return;
        answered++;
        dayAnswered++;
        if (isQuizResponseCorrect(question, attempt)) {
          correct++;
          dayCorrect++;
        }
      });
      return {
        day: door.day,
        total: questions.length + hiddenCount,
        answered: dayAnswered,
        correct: dayCorrect,
        locked: door.day > available,
      };
    })
    .filter((day) => day.total > 0);
  return { total, answered, correct, unlocked, days };
}
