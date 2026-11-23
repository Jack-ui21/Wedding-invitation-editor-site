"use client";

import type { FieldMappings, WeddingDetails } from "@/lib/data/types";

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}

const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Couple",
    fields: [
      { key: "brideName", label: "Bride's name", placeholder: "e.g. Priya" },
      { key: "groomName", label: "Groom's name", placeholder: "e.g. Rahul" },
      { key: "coupleNames", label: "Couple's full names", placeholder: "Rahul & Priya" },
    ],
  },
  {
    title: "Wedding details",
    fields: [
      { key: "weddingDate", label: "Wedding date", placeholder: "YYYY-MM-DD", type: "date" },
      { key: "weddingTime", label: "Wedding time", placeholder: "18:00", type: "time" },
      { key: "venue", label: "Venue", placeholder: "The Oberoi Udaivilas" },
      { key: "venueAddress", label: "Venue address", placeholder: "Udaipur, Rajasthan" },
      { key: "mapsUrl", label: "Google Maps URL", placeholder: "https://maps.google.com/?q=..." },
      { key: "countdownHeading", label: "Countdown heading", placeholder: "The countdown begins" },
    ],
  },
  {
    title: "Messages",
    fields: [
      { key: "welcomeMessage", label: "Welcome message", multiline: true },
      { key: "invitationMessage", label: "Invitation message", multiline: true },
    ],
  },
  {
    title: "Family",
    fields: [
      { key: "brideFamily", label: "Bride's family" },
      { key: "groomFamily", label: "Groom's family" },
      { key: "parentsNames", label: "Parents' names" },
    ],
  },
  {
    title: "Contact & social",
    fields: [
      { key: "rsvpPhone", label: "RSVP WhatsApp number", placeholder: "919876543210 (with country code)" },
      { key: "instagramUrl", label: "Instagram URL", placeholder: "https://instagram.com/..." },
    ],
  },
];

export function ContentPanel({
  details,
  mappings,
  onChange,
  onPick,
}: {
  details: WeddingDetails;
  mappings: FieldMappings;
  onChange: (key: string, value: string) => void;
  onPick: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="mb-3 text-xs font-bold tracking-[0.18em] text-gold uppercase">{group.title}</h3>
          <div className="space-y-3">
            {group.fields.map((field) => (
              <div key={field.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-black/60" htmlFor={`field-${field.key}`}>{field.label}</label>
                  <button
                    className="text-[11px] font-semibold text-plum underline-offset-2 hover:underline"
                    onClick={() => onPick(field.key)}
                    title="Select this field, then tap its text in the preview"
                  >
                    {mappings[field.key] ? "Re-map" : "Map element"}
                  </button>
                </div>
                {field.multiline ? (
                  <textarea
                    id={`field-${field.key}`}
                    className="ws-input min-h-24 resize-y"
                    value={details[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => onChange(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    id={`field-${field.key}`}
                    className="ws-input"
                    type={field.type ?? "text"}
                    value={details[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => onChange(field.key, event.target.value)}
                  />
                )}
                {mappings[field.key] && <p className="mt-1 truncate text-[10px] text-black/40">↳ {mappings[field.key]}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
