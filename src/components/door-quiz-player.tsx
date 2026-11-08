"use client";
import { useId, useState } from "react";
import {
  correctChoices,
  isQuestionComplete,
  isQuizResponseCorrect,
  questionsForDoor,
  type AdventCalendar,
  type Door,
  type QuizQuestion,
  type QuizResponse,
} from "@/lib/model";
import { questionKey, type QuizProgress } from "@/lib/quiz-progress";
import { Icon } from "./icons";
import { authMessage } from "@/lib/cloud/client";
export function DoorQuizPlayer({
  door,
  calendar,
  answers,
  onAnswer,
  offset=0,
}: {
  door: Door;
  calendar: AdventCalendar;
  answers: QuizProgress;
  offset?:number;
  onAnswer: (
    index: number,
    question: QuizQuestion,
    response: QuizResponse,
  ) => void | Promise<void>;
}) {
  const questions = questionsForDoor(door, calendar).filter(isQuestionComplete);
  if (!questions.length) return null;
  return (
    <section className="door-quiz-player">
      <h3>{questions.length === 1 ? "Dagens spørsmål" : "Dagens quiz"}</h3>
      {questions.map((question, index) => (
        <QuestionPlayer
          key={questionKey(door.day, index+offset, question)}
          question={question}
          attempt={answers[questionKey(door.day, index+offset, question)]}
          sender={calendar.sender}
          onAnswer={(response) => onAnswer(index+offset, question, response)}
        />
      ))}
    </section>
  );
}
function QuestionPlayer({
  question,
  attempt,
  sender,
  onAnswer,
}: {
  question: QuizQuestion;
  attempt?: QuizResponse;
  sender: string;
  onAnswer: (response: QuizResponse) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [text, setText] = useState("");
  const name = useId();
  const [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const textQuestion = question.type === "text",
    correct = question.remote
      ? (attempt?.result?.correctAnswers ?? [])
      : correctChoices(question),
    multiple = question.remote ? question.remote.multiple : correct.length > 1;
  const explanation = question.remote
    ? attempt?.result?.explanation
    : question.explanation;
  const choices =
    attempt?.answers ??
    (attempt?.answer !== undefined ? [attempt.answer] : selected);
  const right = !!attempt && isQuizResponseCorrect(question, attempt);
  return (
    <form
      className="quiz-play-question"
      onSubmit={async (event) => {
        event.preventDefault();
        if (attempt || sending) return;
        setSending(true);
        setError("");
        try {
          if (textQuestion && text.trim())
            await onAnswer({ text: text.trim() });
          else if (!textQuestion && selected.length)
            await onAnswer({ answers: [...selected] });
        } catch (error) {
          setError(authMessage(error));
        } finally {
          setSending(false);
        }
      }}
    >
      <h4>{question.title}</h4>
      {textQuestion ? (
        <label className="written-answer-label">
          Ditt svar
          <input
            maxLength={300}
            autoComplete="off"
            spellCheck={false}
            value={attempt?.text ?? text}
            readOnly={!!attempt}
            placeholder="Skriv svaret her"
            onChange={(event) => setText(event.target.value)}
            required
          />
        </label>
      ) : (
        <>
          <p className="quiz-instruction">
            {multiple
              ? "Velg alle svarene du mener er riktige."
              : "Velg ett svar."}
          </p>
          <div className="quiz-play-options">
            {question.options.map((option, index) => (
              <label
                key={index}
                className={`quiz-play-option ${attempt && correct.includes(index) ? "is-correct" : attempt && choices.includes(index) ? "is-incorrect" : ""} ${choices.includes(index) ? "is-selected" : ""}`}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={name}
                  checked={choices.includes(index)}
                  disabled={!!attempt || sending}
                  onChange={(event) =>
                    setSelected((previous) =>
                      multiple
                        ? event.target.checked
                          ? [...previous, index]
                          : previous.filter((value) => value !== index)
                        : [index],
                    )
                  }
                />
                <span className="answer-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="answer-text">{option}</span>
                {attempt && correct.includes(index) && (
                  <Icon name="check" size={18} />
                )}
              </label>
            ))}
          </div>
        </>
      )}
      {!attempt && (
        <button
          className="button primary quiz-submit"
          type="submit"
          disabled={sending || (textQuestion ? !text.trim() : !selected.length)}
        >
          {sending ? "Sjekker svaret …" : "Send svar"}
          <Icon name="arrow" size={15} />
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {attempt && (
        <div
          className={`quiz-result-message ${right ? "is-right" : "is-wrong"}`}
          role="status"
        >
          <p className="quiz-result-status">
            {right ? "Riktig svar!" : "Ikke helt riktig"}
          </p>
          {textQuestion && !right && (
            <p className="quiz-correct-text">
              Et godkjent svar:{" "}
              <strong>
                {question.remote
                  ? attempt.result?.acceptedAnswer
                  : question.acceptedAnswers?.[0]}
              </strong>
            </p>
          )}
          {explanation && (
            <div className="quiz-author-comment">
              <strong>Kommentar fra {sender || "avsender"}</strong>
              <p>{explanation}</p>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
