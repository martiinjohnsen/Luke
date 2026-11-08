import { quizSummary } from "@/lib/quiz-progress";
import { Icon } from "./icons";
export function QuizOverview({
  summary,
}: {
  summary: ReturnType<typeof quizSummary>;
}) {
  const percent = summary.total
    ? Math.round((summary.answered / summary.total) * 100)
    : 0;
  return (
    <div className="quiz-dashboard">
      <dl className="quiz-overview-stats">
        <div>
          <dt>Riktige svar</dt>
          <dd>{summary.correct}<span> / {summary.total}</span></dd>
        </div>
        <div>
          <dt>Besvart</dt>
          <dd>
            {summary.answered}
            <span> / {summary.total}</span>
          </dd>
        </div>
      </dl>
      <div className="quiz-total-progress">
        <span>Fremdrift</span>
        <strong>{percent} %</strong>
        <progress
          max={Math.max(summary.total, 1)}
          value={summary.answered}
          aria-label={`${summary.answered} av ${summary.total} spørsmål besvart`}
        />
      </div>
      <div className="quiz-overview-days">
        {summary.days.map((day) => (
          <div
            className={`quiz-overview-day ${day.locked ? "is-locked" : ""}`}
            key={day.day}
          >
            <span className="quiz-day-number">{day.day}</span>
            <div>
              <strong>{day.day}. desember</strong>
              <span>
                {day.locked
                  ? `Åpner ${day.day}. desember`
                  : `${day.answered} av ${day.total} besvart`}
              </span>
            </div>
            <span className="quiz-day-result">
              {day.locked ? (
                <Icon name="lock" size={16} />
              ) : day.answered ? (
                `${day.correct} / ${day.total} riktige`
              ) : (
                "Ubesvart"
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
