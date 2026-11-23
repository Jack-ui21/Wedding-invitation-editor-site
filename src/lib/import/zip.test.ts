import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importZip } from "./zip";

describe("ZIP import safety", () => {
  it("extracts a valid project and rejects traversal and executable entries", async () => {
    const zip = new JSZip();
    zip.file("index.html", "<!DOCTYPE html><html><body><h1 id='hero-bride-name'>Priya</h1></body></html>");
    zip.file("styles/site.css", "body { color: purple; }");
    zip.file("../escape.txt", "should never be written");
    zip.file("scripts/install.exe", "MZ");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([bytes.slice().buffer as ArrayBuffer], "site.zip", { type: "application/zip" });

    const result = await importZip(file);
    const paths = result.files.map((item) => item.path);

    expect(result.mainFilePath).toBe("index.html");
    expect(paths).toContain("index.html");
    expect(paths).toContain("styles/site.css");
    expect(paths).not.toContain("../escape.txt");
    expect(paths).not.toContain("scripts/install.exe");
    expect(result.warnings.join(" ")).toMatch(/unsafe path|executable/i);
    expect(result.fields.some((field) => field.key === "brideName")).toBe(true);
  });

  it("rejects a ZIP with no HTML document", async () => {
    const zip = new JSZip();
    zip.file("notes.txt", "no website here");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([bytes.slice().buffer as ArrayBuffer], "notes.zip", { type: "application/zip" });
    await expect(importZip(file)).rejects.toThrow(/No HTML file/i);
  });
});
