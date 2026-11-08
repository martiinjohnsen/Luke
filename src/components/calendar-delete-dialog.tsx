"use client";
import type { AdventCalendar } from "@/lib/model";
import { isReceived } from "@/lib/calendar-library";
import { useStore } from "./provider";
import { Dialog } from "./dialog";

export function CalendarDeleteDialog({ calendar, onClose, onDeleted }: {
  calendar: AdventCalendar;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { remove, toast, cloud } = useStore();
  const received = isReceived(calendar);
  return (
    <Dialog title={received ? "Fjerne kalenderen?" : "Slette kalenderen?"} onClose={onClose}>
      <div className="dialog-content">
        <p>
          {received
            ? `«${calendar.title}» blir fjernet fra listen din. Avsenderen beholder kalenderen.`
            : cloud
              ? `«${calendar.title}» blir slettet fra kontoen din. Mottakerne mister også tilgangen. Last ned en sikkerhetskopi hvis du vil beholde innholdet.`
              : `«${calendar.title}» blir fjernet fra denne enheten. Last gjerne ned en sikkerhetskopi først.`}
        </p>
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>Behold kalenderen</button>
          <button type="button" className="button danger" onClick={() => {
            if (!remove(calendar.id)) return;
            onClose();
            toast(received ? "Kalenderen er fjernet fra dine kalendere." : "Kalenderen er slettet.");
            onDeleted?.();
          }}>{received ? "Fjern kalender" : "Slett kalender"}</button>
        </div>
      </div>
    </Dialog>
  );
}
