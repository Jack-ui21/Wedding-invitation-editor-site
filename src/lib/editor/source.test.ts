import { describe, expect, it } from "vitest";
import { applyFieldToSource, applyMappingsToSource, buildPreviewDocument } from "./source";

const html = `<!DOCTYPE html><html><head>
  <link rel="stylesheet" href="styles/main.css" />
</head><body>
  <h1 id="bride">Original Bride</h1>
  <p id="event-name">Original Event</p>
  <script src="scripts/main.js"></script>
</body></html>`;

const details = {
  brideName: "Anya",
} as Parameters<typeof applyMappingsToSource>[1];

describe("editor source", () => {
  it("patches a mapped field directly into HTML", () => {
    const patched = applyFieldToSource(html, "brideName", "Anya", "#bride");
    expect(patched).toContain("Anya");
    expect(patched).not.toContain("Original Bride");
  });

  it("reapplies details and event values through mappings", () => {
    const patched = applyMappingsToSource(
      html,
      details,
      { brideName: "#bride", "event.1.name": "#event-name" },
      [{ id: "e1", name: "Sangeet", date: "", time: "", location: "", description: "", imageUrl: "", mapUrl: "" }],
    );
    expect(patched).toContain("Anya");
    expect(patched).toContain("Sangeet");
  });

  it("inlines local CSS and JS into the preview document", () => {
    const doc = buildPreviewDocument({
      html,
      mainFilePath: "index.html",
      files: [
        { path: "styles/main.css", text: "body{color:red}", url: "/api/files/p1/styles/main.css" },
        { path: "scripts/main.js", text: "console.log('hi')", url: "/api/files/p1/scripts/main.js" },
      ],
      details,
      mappings: {},
      events: [],
      token: "secret",
      selectMode: false,
    });
    expect(doc).toContain("body{color:red}");
    expect(doc).toContain("console.log('hi')");
    expect(doc).not.toContain('href="styles/main.css"');
    expect(doc).toContain("data-wis-bridge");
  });

  it("omits the editor bridge on public published pages", () => {
    const doc = buildPreviewDocument({
      html,
      mainFilePath: "index.html",
      files: [],
      details,
      mappings: {},
      events: [],
      token: "",
      selectMode: false,
      publicMode: true,
    });
    expect(doc).not.toContain("data-wis-bridge");
    expect(doc).toContain("data-wis-public");
    expect(doc).toContain("__wisTarget");
    expect(doc).not.toContain("postMessage");
  });
});
