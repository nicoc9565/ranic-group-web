import { Fragment } from "react";
import { FOLLOWUP_DAYS } from "@/lib/followup";
import { addDaysISO, formatShort } from "@/lib/format";

type FollowUpState = "overdue" | "today" | "ontrack" | "none";

// Color del nodo "próximo" según urgencia (semáforo logístico).
const NEXT_DOT: Record<Exclude<FollowUpState, "none">, string> = {
  overdue: "bg-status-overdue ring-2 ring-status-overdue/30",
  today: "bg-status-today ring-2 ring-status-today/30",
  ontrack: "bg-status-ontrack ring-2 ring-status-ontrack/30",
};

/**
 * Elemento de firma: mini-timeline de tracking de la secuencia Day 1 → 4 → 7 → 12.
 * Pasos enviados rellenos en olive; el próximo paso resaltado con el color del semáforo.
 */
export function FollowUpTrack({
  followUpStep,
  status,
  firstContactDate,
  showDates = false,
}: {
  followUpStep: number;
  status: FollowUpState;
  firstContactDate?: string | null;
  showDates?: boolean;
}) {
  const nextIndex = followUpStep + 1;

  return (
    <div className="flex items-start" role="img" aria-label="Secuencia de follow-up">
      {FOLLOWUP_DAYS.map((day, i) => {
        const sent = i <= followUpStep;
        const isNext = i === nextIndex && status !== "none";

        let dot = "bg-surface border border-line";
        if (sent) dot = "bg-olive border border-olive";
        else if (isNext) dot = NEXT_DOT[status as Exclude<FollowUpState, "none">];

        return (
          <Fragment key={day}>
            {i > 0 && (
              <span
                className={`mt-[5px] h-px w-5 sm:w-7 ${
                  sent ? "bg-olive" : "bg-line"
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <span className={`h-3 w-3 rounded-full ${dot}`} aria-hidden />
              <span className="mt-1 font-mono text-[9px] leading-none text-ink-soft">
                D{day}
              </span>
              {showDates && firstContactDate && (
                <span className="mt-0.5 font-mono text-[9px] leading-none text-ink-soft">
                  {formatShort(addDaysISO(firstContactDate, day))}
                </span>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
