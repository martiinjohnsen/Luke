import { isImageSource, isAudioSource } from "./media-reference.ts";
export const THEMES = [
  "advent",
  "forest",
  "berry",
  "night",
  "gingerbread",
  "ice",
  "rose",
  "champagne",
  "aurora",
] as const;
export type Theme = (typeof THEMES)[number];
export type DoorKind =
  | "message"
  | "image"
  | "quiz"
  | "video"
  | "activity"
  | "giftcard";
export const DOOR_EFFECTS = [
  "none",
  "snow",
  "sparkles",
  "confetti",
  "hearts",
  "fireworks",
  "glow",
] as const;
export type DoorEffect = (typeof DOOR_EFFECTS)[number];
export interface SceneSettings {
  house: "classic" | "cabin" | "townhouse" | "park" | "forest" | "village";
  sky: "stars" | "moon" | "clear" | "fullmoon" | "cloudy";
  snowman: boolean;
  reindeer: boolean;
  trees: boolean;
  lights: boolean;
  snowfall: boolean;
  wind?: boolean;
  twinkle?: boolean;
  santa?: boolean;
  sleigh?: boolean;
  skis?: boolean;
  christmasTree?: boolean;
  lanterns?: boolean;
  storm?: boolean;
  shootingStars?: boolean;
  fireworks?: boolean;
  presents?: boolean;
}
export const DEFAULT_SCENE: SceneSettings = {
  house: "classic",
  sky: "stars",
  snowman: false,
  reindeer: false,
  trees: true,
  lights: true,
  snowfall: false,
  wind: false,
  twinkle: false,
};
export interface GiftCard {
  merchant: string;
  amount: number;
  currency: "NOK";
  code: string;
  url: string;
  expiresOn: string;
}
export interface QuizQuestion {
  remote?: { key: string; multiple: boolean };
  type?: "choice" | "text";
  correctAnswers?: number[];
  acceptedAnswers?: string[];
  title: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}
export interface CalendarQuiz {
  title: string;
  description: string;
  questions: QuizQuestion[];
}
export const DOOR_BLOCKS = [
  "giftcard",
  "image",
  "audio",
  "video",
  "link",
  "quiz",
  "activity",
  "effect",
] as const;
export type DoorBlockKind = (typeof DOOR_BLOCKS)[number];
export type RepeatableBlockKind = Exclude<DoorBlockKind,"effect">;
export type ExtraBlockId = `${RepeatableBlockKind}:2` | `${RepeatableBlockKind}:3`;
export type DoorBlockId = DoorBlockKind | ExtraBlockId;
export const blockNames: Record<DoorBlockKind, string> = {
  giftcard: "Gavekort",
  image: "Bilde",
  audio: "Lydhilsen",
  video: "Video",
  link: "Lenke",
  quiz: "Quiz",
  activity: "Opplevelse",
  effect: "Åpningseffekt",
};
export interface QuizResponse {
  result?: {
    correct: boolean;
    correctAnswers?: number[];
    acceptedAnswer?: string;
    explanation?: string;
  };
  answer?: number;
  answers?: number[];
  text?: string;
}
export interface Door {
  day: number;
  kind: DoorKind;
  title: string;
  body: string;
  image?: string;
  audio?: string;
  imageAlt?: string;
  videoUrl?: string;
  quiz?: { options: string[]; answerIndex: number; explanation: string };
  link?: { label: string; url: string };
  effect?: DoorEffect;
  showCalendarQuiz?: boolean;
  questions?: QuizQuestion[];
  giftCard?: GiftCard;
  contentOrder?: DoorBlockId[];
  extra?: Partial<Record<ExtraBlockId,Door>>;
  activity?: { title: string; body: string };
}
export interface AdventCalendar {
  remote?: boolean;
  serverAvailableDay?: number;
  serverQuizCounts?: Record<string, number>;
  quizCounts?: Record<string, number>;
  id: string;
  title: string;
  description: string;
  recipient: string;
  sender: string;
  year: number;
  theme: Theme;
  doors: Door[];
  demo?: boolean;
  quiz?: CalendarQuiz;
  scene?: SceneSettings;
  access?: "owner" | "received";
  receivedSourceId?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Preferences {
  name: string;
  snow: boolean;
}
export interface AppData {
  version: 1;
  calendars: AdventCalendar[];
  preferences: Preferences;
}
export const themeInfo: Record<
  Theme,
  { name: string; description: string; color: string }
> = {
  advent: {
    name: "Advent",
    description: "Dempet lilla og lune vinterlys",
    color: "#655078",
  },
  forest: {
    name: "Granskog",
    description: "Rolig grønt og varme lys",
    color: "#284c3e",
  },
  berry: {
    name: "Vinterbær",
    description: "Dyp rødfarge og lune toner",
    color: "#813e48",
  },
  night: {
    name: "Stjernenatt",
    description: "Midnattsblått og små stjerner",
    color: "#303e64",
  },
  gingerbread: {
    name: "Pepperkake",
    description: "Varmt, gyllent og litt nostalgisk",
    color: "#9b603e",
  },
  ice: { name: "Isblå", description: "Klar vinterhimmel", color: "#718a9e" },
  rose: { name: "Vinterrosa", description: "Myke rosatoner", color: "#a67b8b" },
  champagne: {
    name: "Champagne",
    description: "Lyst og gyllent",
    color: "#9f8a60",
  },
  aurora: {
    name: "Nordlys",
    description: "Grønt, blått og natt",
    color: "#436c70",
  },
};
export const kindInfo: Record<DoorKind, { name: string; description: string }> =
  {
    giftcard: { name: "Gavekort", description: "En gave å bruke senere" },
    message: { name: "Hilsen", description: "Noen ord som varmer" },
    image: { name: "Bilde", description: "Et minne å ta vare på" },
    quiz: { name: "Quiz", description: "Et lite spørsmål" },
    video: { name: "Video", description: "En video fra YouTube" },
    activity: { name: "Opplevelse", description: "Noe hyggelig å gjøre" },
  };
export function emptyDoor(day: number): Door {
  return { day, kind: "message", title: "", body: "" };
}
export function hasDoorContent(door: Door): boolean {
  return Boolean(
    door.title.trim() ||
      door.body.trim() ||
      door.image ||
      door.audio ||
      door.videoUrl?.trim() ||
      door.link?.url ||
      door.showCalendarQuiz ||
      door.giftCard?.merchant ||
      door.contentOrder?.length ||
      Object.keys(door.extra ?? {}).length ||
      door.activity?.title ||
      door.activity?.body ||
      door.questions?.some(
        (question) =>
          question.title.trim() ||
          question.options.some((option) => option.trim()) ||
          question.acceptedAnswers?.some((answer) => answer.trim()),
      ) ||
      (door.effect && door.effect !== "none") ||
      door.quiz?.options.some((option) => option.trim()),
  );
}
export function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function isDoorComplete(door: Door): boolean {
  if (door.contentOrder !== undefined || door.extra) {
    const blocks = doorBlockOrder(door);
    if (!blocks.every((block) => isBlockComplete(door, block))) return false;
    return Boolean(
      door.body.trim() || blocks.some((block) => block !== "effect"),
    );
  }
  if (door.questions?.some((question) => !isQuestionComplete(question)))
    return false;
  if (
    door.giftCard &&
    !(
      door.giftCard.merchant.trim() &&
      door.giftCard.amount > 0 &&
      (door.giftCard.code.trim() || safeLink(door.giftCard.url))
    )
  )
    return false;
  if (door.showCalendarQuiz) return true;
  if (door.kind === "giftcard")
    return Boolean(
      door.giftCard?.merchant.trim() &&
        door.giftCard.amount > 0 &&
        (door.giftCard.code.trim() || safeLink(door.giftCard.url)),
    );
  if (door.kind === "image") return Boolean(door.image);
  if (door.kind === "video") return Boolean(youtubeId(door.videoUrl ?? ""));
  if (door.kind === "quiz")
    return Boolean(
      door.questions?.length
        ? door.questions.every(isQuestionComplete)
        : door.quiz &&
            door.quiz.options.length >= 2 &&
            door.quiz.options.every((o) => o.trim()) &&
            door.quiz.answerIndex >= 0 &&
            door.quiz.answerIndex < door.quiz.options.length,
    );
  return Boolean(
    door.body.trim() ||
      door.image ||
      door.audio ||
      youtubeId(door.videoUrl ?? "") ||
      door.link?.url ||
      (door.questions?.length && door.questions.every(isQuestionComplete)),
  );
}
export function completedCount(calendar: AdventCalendar): number {
  return calendar.doors.filter(isDoorComplete).length;
}
export function calendarContentSummary(calendar: AdventCalendar) {
  const counts = new Map<DoorBlockKind | "message", number>();
  let questionCount = 0;
  for (const door of calendar.doors) {
    if (door.body.trim())
      counts.set("message", (counts.get("message") ?? 0) + 1);
    const blocks = doorBlockOrder(door).filter((block) => block !== "effect");
    if (door.kind === "activity" && !blocks.includes("activity"))
      blocks.push("activity");
    for (const id of blocks) {const block=blockKind(id);counts.set(block, (counts.get(block) ?? 0) + 1);}
    questionCount += questionsForDoor(door, calendar).length;
  }
  return {
    counts: Object.fromEntries(counts) as Partial<
      Record<DoorBlockKind | "message", number>
    >,
    questionCount,
  };
}
export function createCalendar(
  input: {
    title: string;
    recipient: string;
    sender: string;
    year: number;
    theme: Theme;
    scene?: SceneSettings;
  },
  doors?: Door[],
): AdventCalendar {
  const now = new Date().toISOString();
  return {
    ...input,
    scene: input.scene ?? { ...DEFAULT_SCENE },
    access: "owner",
    id: crypto.randomUUID(),
    description: "24 små grunner til å glede seg til jul.",
    doors: doors ?? Array.from({ length: 24 }, (_, i) => emptyDoor(i + 1)),
    createdAt: now,
    updatedAt: now,
  };
}
export function youtubeId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    let id: string | null = null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    ) {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : /^\/(?:shorts|embed)\//.test(url.pathname)
            ? url.pathname.split("/")[2]
            : null;
    } else if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
// Dates are evaluated in the calendar's Norwegian time zone, including around midnight.
export function availableDay(year: number, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const n = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  const currentYear = n("year"),
    month = n("month");
  if (currentYear > year) return 24;
  if (currentYear < year || month < 12) return 0;
  return Math.min(24, n("day"));
}
export function daysUntilAdvent(year: number, now = new Date()): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(`${year}-12-01T00:00:00+01:00`).getTime() - now.getTime()) /
        86400000,
    ),
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function string(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
export function correctChoices(question: QuizQuestion): number[] {
  return [...new Set(question.correctAnswers ?? [question.answerIndex])].sort(
    (a, b) => a - b,
  );
}
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("nb-NO");
}
export function isQuestionComplete(question: QuizQuestion): boolean {
  if (!question.title.trim()) return false;
  if (question.remote) return true;
  if (question.type === "text")
    return Boolean(
      question.acceptedAnswers?.length &&
        question.acceptedAnswers.every((answer) => normalizeAnswer(answer)),
    );
  const correct = correctChoices(question);
  return Boolean(
    question.options.length >= 2 &&
      question.options.every((option) => option.trim()) &&
      correct.length &&
      correct.every(
        (index) =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < question.options.length,
      ),
  );
}
export function validQuizResponse(
  question: QuizQuestion,
  response: QuizResponse,
): boolean {
  if (question.type === "text")
    return (
      typeof response.text === "string" &&
      response.text.length <= 300 &&
      Boolean(normalizeAnswer(response.text))
    );
  const answers =
    response.answers ??
    (response.answer !== undefined ? [response.answer] : []);
  return (
    answers.length > 0 &&
    answers.length <= question.options.length &&
    new Set(answers).size === answers.length &&
    answers.every(
      (index) =>
        Number.isInteger(index) &&
        index >= 0 &&
        index < question.options.length,
    )
  );
}
export function isQuizResponseCorrect(
  question: QuizQuestion,
  response: QuizResponse,
): boolean {
  if (!validQuizResponse(question, response)) return false;
  if (question.remote) return response.result?.correct === true;
  if (question.type === "text")
    return Boolean(
      question.acceptedAnswers?.some(
        (answer) => normalizeAnswer(answer) === normalizeAnswer(response.text!),
      ),
    );
  const selected = [...(response.answers ?? [response.answer!])].sort(
    (a, b) => a - b,
  );
  return JSON.stringify(selected) === JSON.stringify(correctChoices(question));
}
function isQuestion(value: unknown): value is QuizQuestion {
  if (
    !record(value) ||
    !string(value.title, 200) ||
    !string(value.explanation, 1000) ||
    !Array.isArray(value.options) ||
    !value.options.every((option) => string(option, 180)) ||
    !Number.isInteger(value.answerIndex)
  )
    return false;
  if (
    value.remote !== undefined &&
    (!record(value.remote) ||
      !string(value.remote.key, 100) ||
      !/^\d{1,2}-\d{1,2}-[a-z0-9]+$/.test(value.remote.key) ||
      typeof value.remote.multiple !== "boolean")
  )
    return false;
  if (
    value.type !== undefined &&
    !["choice", "text"].includes(String(value.type))
  )
    return false;
  if (value.type === "text")
    return (
      value.options.length === 0 &&
      value.answerIndex === 0 &&
      Array.isArray(value.acceptedAnswers) &&
      value.acceptedAnswers.length <= 20 &&
      value.acceptedAnswers.every((answer) => string(answer, 300)) &&
      value.correctAnswers === undefined
    );
  if (
    value.options.length < 2 ||
    value.options.length > 12 ||
    Number(value.answerIndex) < 0 ||
    Number(value.answerIndex) >= value.options.length
  )
    return false;
  const optionCount = value.options.length;
  return (
    value.acceptedAnswers === undefined &&
    (value.correctAnswers === undefined ||
      (Array.isArray(value.correctAnswers) &&
        value.correctAnswers.length <= value.options.length &&
        new Set(value.correctAnswers).size === value.correctAnswers.length &&
        value.correctAnswers.every(
          (index) =>
            Number.isInteger(index) &&
            Number(index) >= 0 &&
            Number(index) < optionCount,
        )))
  );
}
export function blockKind(id:DoorBlockId):DoorBlockKind {return id.split(":")[0] as DoorBlockKind;}
export function blockDoor(door:Door,id:DoorBlockId):Door {return id.includes(":") ? door.extra?.[id as ExtraBlockId] ?? emptyDoor(door.day) : door;}
export function doorPayloads(door:Door):Door[] {return [door,...Object.values(door.extra ?? {}).filter((value):value is Door=>!!value)];}
export function mapDoorPayloads(door:Door,visit:(value:Door)=>Door):Door {
  const next=visit(door);
  if(door.extra) next.extra=Object.fromEntries(Object.entries(door.extra).map(([id,value])=>[id,visit(value!)]));
  return next;
}
export function blockQuestionOffset(door:Door,id:DoorBlockId,calendar?:AdventCalendar):number {
  if(id==="quiz") return 0;
  let count=questionsForDoor({...door,extra:undefined},calendar).filter(isQuestionComplete).length;
  if(id==="quiz:3" && door.extra?.["quiz:2"]) count+=questionsForDoor(door.extra["quiz:2"],calendar).filter(isQuestionComplete).length;
  return count;
}
export function patchDoorBlock(door:Door,id:DoorBlockId,patch:Partial<Door>):Door {
  return id.includes(":") ? {...door,extra:{...door.extra,[id]:{...blockDoor(door,id),...patch}}} : {...door,...patch};
}
export function remainingBlocks(door:Door,kind:RepeatableBlockKind):number {return 3-doorBlockOrder(door).filter(id=>blockKind(id)===kind).length;}
export function addDoorBlock(door:Door,kind:RepeatableBlockKind,patch:Partial<Door>):{door:Door;id:DoorBlockId}|null {
  const order=doorBlockOrder(door);
  const id=([kind,`${kind}:2`,`${kind}:3`] as DoorBlockId[]).find(id=>!order.includes(id));
  if(!id) return null;
  let next=id.includes(":") ? patchDoorBlock(door,id,{...emptyDoor(door.day),...patch,contentOrder:[kind]}) : {...door,...patch};
  next={...next,contentOrder:[...order,id]};
  return {door:next,id};
}
export function doorBlockOrder(door: Door): DoorBlockId[] {
  const inferred: DoorBlockKind[] = [];
  if (
    door.giftCard ||
    (door.contentOrder === undefined && door.kind === "giftcard")
  )
    inferred.push("giftcard");
  if (
    door.image !== undefined ||
    (door.contentOrder === undefined && door.kind === "image")
  )
    inferred.push("image");
  if (
    door.videoUrl !== undefined ||
    (door.contentOrder === undefined && door.kind === "video")
  )
    inferred.push("video");
  if (door.link) inferred.push("link");
  if (door.audio !== undefined) inferred.push("audio");
  if (
    door.questions?.length ||
    door.quiz ||
    door.showCalendarQuiz ||
    (door.contentOrder === undefined && door.kind === "quiz")
  )
    inferred.push("quiz");
  if (door.activity) inferred.push("activity");
  if (door.effect && door.effect !== "none") inferred.push("effect");
  return [...new Set([...(door.contentOrder ?? []), ...inferred,...Object.keys(door.extra ?? {}) as ExtraBlockId[]])];
}
export function moveDoorBlock(
  order: DoorBlockId[],
  from: number,
  to: number,
): DoorBlockId[] {
  if (from < 0 || from >= order.length || to < 0 || to >= order.length)
    return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function removeDoorBlock(door: Door, block: DoorBlockId): Door {
  const next = {
    ...door,
    kind: "message" as const,
    contentOrder: doorBlockOrder(door).filter((value) => value !== block),
  };
  if(block.includes(":")) {next.extra={...door.extra};delete next.extra[block as ExtraBlockId];return next;}
  if (block === "image") {
    delete next.image;
    delete next.imageAlt;
  }
  if (block === "video") delete next.videoUrl;
  if (block === "audio") delete next.audio;
  if (block === "link") delete next.link;
  if (block === "quiz") {
    delete next.questions;
    delete next.quiz;
    delete next.showCalendarQuiz;
  }
  if (block === "giftcard") delete next.giftCard;
  if (block === "activity") delete next.activity;
  if (block === "effect") delete next.effect;
  return next;
}
function isBlockComplete(root: Door, id: DoorBlockId): boolean {
  const block=blockKind(id),door={...blockDoor(root,id),extra:undefined};
  switch (block) {
    case "image":
      return Boolean(door.image);
    case "audio":
      return Boolean(door.audio && isAudioSource(door.audio));
    case "video":
      return Boolean(youtubeId(door.videoUrl ?? ""));
    case "link":
      return Boolean(door.link && safeLink(door.link.url));
    case "quiz": {
      const questions = questionsForDoor(door);
      return questions.length > 0 && questions.every(isQuestionComplete);
    }
    case "giftcard":
      return Boolean(
        door.giftCard?.merchant.trim() &&
          door.giftCard.amount > 0 &&
          (door.giftCard.code.trim() || safeLink(door.giftCard.url)),
      );
    case "activity":
      return Boolean(door.activity?.title.trim() && door.activity.body.trim());
    case "effect":
      return true;
  }
}
export function isScene(value: unknown): value is SceneSettings {
  return (
    record(value) &&
    ["classic", "cabin", "townhouse", "park", "forest", "village"].includes(
      String(value.house),
    ) &&
    ["stars", "moon", "clear", "fullmoon", "cloudy"].includes(String(value.sky)) &&
    ["snowman", "reindeer", "trees", "lights", "snowfall"].every(
      (key) => typeof value[key] === "boolean",
    ) &&
    ["wind", "twinkle", "santa", "sleigh", "skis", "christmasTree", "lanterns", "storm", "shootingStars", "fireworks", "presents"].every(
      (key) => value[key] === undefined || typeof value[key] === "boolean",
    )
  );
}
export function sceneFor(
  calendar: Pick<AdventCalendar, "scene">,
): SceneSettings {
  return { ...DEFAULT_SCENE, ...calendar.scene };
}
export function questionsForDoor(
  door: Door,
  calendar?: AdventCalendar,
): QuizQuestion[] {
  const questions: QuizQuestion[] = door.questions !== undefined ? [...door.questions] : door.quiz
    ? [{ title: door.title, ...door.quiz, options: [...door.quiz.options] }]
    : [];
  if (door.questions === undefined && door.showCalendarQuiz && calendar?.quiz)
    questions.push(...structuredClone(calendar.quiz.questions));
  for(const id of ["quiz:2","quiz:3"] as const) if(door.extra?.[id]) questions.push(...questionsForDoor(door.extra[id]!,calendar));
  return questions;
}
export function isCalendarQuiz(value: unknown): value is CalendarQuiz {
  return (
    record(value) &&
    string(value.title, 100) &&
    Boolean(value.title.trim()) &&
    string(value.description, 1000) &&
    Array.isArray(value.questions) &&
    value.questions.length >= 1 &&
    value.questions.length <= 30 &&
    value.questions.every((q) => isQuestion(q) && isQuestionComplete(q))
  );
}
export function isCalendar(value: unknown): value is AdventCalendar {
  if (
    !record(value) ||
    !string(value.id, 80) ||
    !/^[a-zA-Z0-9-]+$/.test(value.id) ||
    !string(value.title, 100) ||
    !value.title.trim() ||
    !string(value.description, 1000) ||
    !string(value.recipient, 100) ||
    !string(value.sender, 100) ||
    !Number.isInteger(value.year) ||
    Number(value.year) < 2020 ||
    Number(value.year) > 2100 ||
    !THEMES.includes(value.theme as Theme) ||
    !string(value.createdAt, 50) ||
    !string(value.updatedAt, 50) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    return false;
  if (value.remote !== undefined && typeof value.remote !== "boolean")
    return false;
  if (
    value.serverAvailableDay !== undefined &&
    (!Number.isInteger(value.serverAvailableDay) ||
      Number(value.serverAvailableDay) < 0 ||
      Number(value.serverAvailableDay) > 24)
  )
    return false;
  for (const key of ["quizCounts", "serverQuizCounts"]) {
    const counts = value[key];
    if (
      counts !== undefined &&
      (!record(counts) ||
        Object.entries(counts).some(
          ([day, count]) =>
            !/^([1-9]|1[0-9]|2[0-4])$/.test(day) ||
            !Number.isInteger(count) ||
            Number(count) < 0 ||
            Number(count) > 96,
        ))
    )
      return false;
  }
  if (value.demo !== undefined && typeof value.demo !== "boolean") return false;
  if (value.scene !== undefined && !isScene(value.scene)) return false;
  if (
    value.access !== undefined &&
    !["owner", "received"].includes(String(value.access))
  )
    return false;
  if (
    value.receivedSourceId !== undefined &&
    (!string(value.receivedSourceId, 80) ||
      !/^[a-zA-Z0-9-]+$/.test(value.receivedSourceId))
  )
    return false;
  if (!Array.isArray(value.doors) || value.doors.length !== 24) return false;
  if (value.quiz !== undefined && !isCalendarQuiz(value.quiz)) return false;
  const seen = new Set<number>();
  for (const door of value.doors) {
    if (
      !record(door) ||
      !Number.isInteger(door.day) ||
      Number(door.day) < 1 ||
      Number(door.day) > 24 ||
      seen.has(Number(door.day)) ||
      !Object.hasOwn(kindInfo, String(door.kind)) ||
      !string(door.title, 120) ||
      !string(door.body, 6000)
    )
      return false;
    seen.add(Number(door.day));
    if (
      door.contentOrder !== undefined &&
      (!Array.isArray(door.contentOrder) ||
        door.contentOrder.length > 22 ||
        new Set(door.contentOrder).size !== door.contentOrder.length ||
        !door.contentOrder.every((block) =>
          typeof block==="string" && (/^(giftcard|image|audio|video|link|quiz|activity)(:[23])?$/.test(block) || block==="effect"),
        ))
    )
      return false;
    if(door.extra!==undefined) {
      if(!record(door.extra) || Object.keys(door.extra).length>14) return false;
      for(const [id,payload] of Object.entries(door.extra)) {
        if(!/^(giftcard|image|audio|video|link|quiz|activity):[23]$/.test(id) || !record(payload) || payload.day!==door.day || payload.extra!==undefined ||
          payload.kind!=="message" || payload.title!=="" || payload.body!=="" ||
          !Array.isArray(payload.contentOrder) || payload.contentOrder.length!==1 || payload.contentOrder[0]!==id.split(":")[0]) return false;
        const fields:Record<string,string[]>={giftcard:["giftCard"],image:["image","imageAlt"],audio:["audio"],video:["videoUrl"],link:["link"],quiz:["questions"],activity:["activity"]};
        const allowed=new Set(["day","kind","title","body","contentOrder",...fields[id.split(":")[0]]]);
        if(Object.keys(payload).some(key=>!allowed.has(key))) return false;
        const child={...payload,contentOrder:[id.split(":")[0]]};
        if(!isCalendar({...value,doors:(value.doors as Door[]).map(d=>d.day===door.day ? child : emptyDoor(d.day))})) return false;
        if(doorBlockOrder(child as unknown as Door).some(block=>block!==id.split(":")[0])) return false;
      }
    }
    if(door.contentOrder?.some((id:unknown)=>typeof id==="string" && id.includes(":") && !(record(door.extra) && door.extra[id]))) return false;
    if (
      door.activity !== undefined &&
      (!record(door.activity) ||
        !string(door.activity.title, 120) ||
        !string(door.activity.body, 3000))
    )
      return false;
    if (
      door.questions !== undefined &&
      (!Array.isArray(door.questions) ||
        door.questions.length > 32 ||
        !door.questions.every(isQuestion))
    )
      return false;
    if (door.giftCard !== undefined) {
      const gift = door.giftCard;
      if (
        !record(gift) ||
        !string(gift.merchant, 100) ||
        typeof gift.amount !== "number" ||
        !Number.isFinite(gift.amount) ||
        gift.amount < 0 ||
        gift.amount > 1000000 ||
        gift.currency !== "NOK" ||
        !string(gift.code, 500) ||
        !string(gift.url, 2000) ||
        (gift.url !== "" && !safeLink(gift.url)) ||
        !string(gift.expiresOn, 10) ||
        (gift.expiresOn !== "" &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(gift.expiresOn) ||
            !Number.isFinite(Date.parse(gift.expiresOn)) ||
            new Date(gift.expiresOn).toISOString().slice(0, 10) !==
              gift.expiresOn))
      )
        return false;
    }
    if (door.showCalendarQuiz && !value.quiz) return false;
    if (
      door.showCalendarQuiz !== undefined &&
      typeof door.showCalendarQuiz !== "boolean"
    )
      return false;
    if (
      door.image !== undefined &&
      !isImageSource(door.image)
    )
      return false;
    if (door.audio !== undefined && !isAudioSource(door.audio)) return false;
    if (door.imageAlt !== undefined && !string(door.imageAlt, 300))
      return false;
    if (
      door.videoUrl !== undefined &&
      (!string(door.videoUrl, 500) ||
        (door.videoUrl !== "" && !youtubeId(door.videoUrl)))
    )
      return false;
    if (
      door.link !== undefined &&
      (!record(door.link) ||
        !string(door.link.label, 100) ||
        !string(door.link.url, 2000) ||
        (door.link.url !== "" && !safeLink(door.link.url)))
    )
      return false;
    if (
      door.effect !== undefined &&
      !DOOR_EFFECTS.includes(door.effect as DoorEffect)
    )
      return false;
    if (
      door.quiz !== undefined &&
      (!record(door.quiz) ||
        !Array.isArray(door.quiz.options) ||
        door.quiz.options.length < 2 ||
        door.quiz.options.length > 4 ||
        !door.quiz.options.every((o) => string(o, 180)) ||
        !Number.isInteger(door.quiz.answerIndex) ||
        Number(door.quiz.answerIndex) < 0 ||
        Number(door.quiz.answerIndex) >= door.quiz.options.length ||
        !string(door.quiz.explanation, 1000))
    )
      return false;
  }
  return true;
}
export function parseBackup(text: string): AppData {
  if (text.length > 100000000)
    throw new Error("Filen er for stor. Maksimal størrelse er 100 MB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Filen er ikke en gyldig Luke-sikkerhetskopi.");
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.calendars) ||
    value.calendars.length > 100 ||
    !value.calendars.every(isCalendar) ||
    new Set(value.calendars.map((c) => c.id)).size !== value.calendars.length ||
    !record(value.preferences) ||
    !string(value.preferences.name, 60) ||
    typeof value.preferences.snow !== "boolean"
  )
    throw new Error("Sikkerhetskopien har ugyldig eller ufullstendig innhold.");
  return value as unknown as AppData;
}
