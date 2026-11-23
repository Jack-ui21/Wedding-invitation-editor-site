"use client";

import { Plus, Trash2 } from "lucide-react";
import type { FieldMappings, WeddingEvent } from "@/lib/data/types";

const FIELDS: Array<[keyof WeddingEvent, string, string]> = [
  ["name", "Event name", "e.g. Mehendi"],
  ["date", "Date", "Thursday, 25 January"],
  ["time", "Time", "6pm onwards"],
  ["location", "Venue", "JW Marriott, Mussoorie"],
  ["description", "Description", "Dress code and details"],
  ["mapUrl", "Map URL", "https://maps.google.com/?q=..."],
  ["imageUrl", "Image URL", ""],
];

export function EventsPanel({
  events,
  mappings,
  onChange,
  onAdd,
  onRemove,
  onPick,
}: {
  events: WeddingEvent[];
  mappings: FieldMappings;
  onChange: (index: number, field: keyof WeddingEvent, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onPick?: (key: string) => void;
}) {
  return (
    <div className="space-y-5">
      {events.length === 0 && (
        <p className="rounded-xl bg-black/5 p-4 text-sm text-black/55">
          No events were detected in this template. Add one to create an event card in the preview.
        </p>
      )}
      {events.map((event, index) => (
        <section key={event.id} className="ws-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg text-plum">Event {index + 1}</h3>
            <button className="ws-btn-ghost min-h-9 px-2.5 text-red-700" onClick={() => onRemove(index)}><Trash2 size={15} /> Remove</button>
          </div>
          <div className="space-y-3">
            {FIELDS.map(([key, label, placeholder]) => {
              const mappingKey = `event.${index + 1}.${key === "location" ? "location" : key === "mapUrl" ? "mapUrl" : key === "imageUrl" ? "imageUrl" : key}`;
              return (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="ws-label mb-0" htmlFor={`event-${index}-${key}`}>
                      {label}{mappings[mappingKey] ? " · mapped" : ""}
                    </label>
                    {onPick && (
                      <button
                        className="shrink-0 text-[11px] font-semibold text-plum underline-offset-2 hover:underline"
                        onClick={() => onPick(mappingKey)}
                        title="Select this field, then tap its text in the preview"
                      >
                        {mappings[mappingKey] ? "Re-map" : "Map"}
                      </button>
                    )}
                  </div>
                  {key === "description" ? (
                    <textarea
                      id={`event-${index}-${key}`}
                      className="ws-input min-h-20"
                      value={event[key] ?? ""}
                      placeholder={placeholder}
                      onChange={(eventInput) => onChange(index, key, eventInput.target.value)}
                    />
                  ) : (
                    <input
                      id={`event-${index}-${key}`}
                      className="ws-input"
                      value={event[key] ?? ""}
                      placeholder={placeholder}
                      onChange={(eventInput) => onChange(index, key, eventInput.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <button className="ws-btn-ghost w-full" onClick={onAdd}><Plus size={16} /> Add event</button>
    </div>
  );
}
