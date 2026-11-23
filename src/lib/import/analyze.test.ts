import { describe, expect, it } from "vitest";
import { countDataUris, detectFields, normalizePath, selectorFor } from "./analyze";

const html = `<!DOCTYPE html><html><body>
  <h1 id="hero-bride-name">Priya Sharma</h1>
  <h2 id="hero-groom-name">Rahul Verma</h2>
  <p id="event_1_name">Mehendi</p>
  <span id="event_1_date">25 January</span>
  <a id="event_1_map" href="https://maps.google.com/?q=venue">Map</a>
  <a id="venue_map" href="https://maps.google.com/?q=hotel">Venue</a>
  <p class="footer_message">We eagerly await your presence at our wedding celebration.</p>
  <img src="../images/couple.jpg" />
  <img src="data:image/png;base64,iVBORw0KGgo=" />
</body></html>`;

describe("HTML field detection", () => {
  it("finds named and event fields with stable selectors", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fields = detectFields(doc);
    const byKey = new Map(fields.map((field) => [field.key, field]));
    expect(byKey.get("brideName")?.selector).toBe("#hero-bride-name");
    expect(byKey.get("groomName")?.text).toBe("Rahul Verma");
    expect(byKey.get("event.1.name")?.text).toBe("Mehendi");
    expect(byKey.get("event.1.date")?.text).toBe("25 January");
    expect(byKey.get("event.1.mapUrl")?.source).toBe("id");
    expect(byKey.get("mapsUrl")?.text).toContain("maps.google.com");
  });

  it("creates CSS selectors with nth-of-type when ids are absent", () => {
    const doc = new DOMParser().parseFromString("<div><span>A</span><span>B</span></div>", "text/html");
    expect(selectorFor(doc.querySelectorAll("span")[1])).toContain("span:nth-of-type(2)");
  });

  it("normalises relative asset paths", () => {
    expect(normalizePath("index.html", "../images/couple.jpg")).toBe("images/couple.jpg");
    expect(normalizePath("pages/invite.html", "../css/main.css?v=2")).toBe("css/main.css");
    expect(normalizePath("index.html", "https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("counts embedded images without treating them as files", () => {
    expect(countDataUris(html)).toBe(1);
  });
});
