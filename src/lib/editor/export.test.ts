import { describe, expect, it } from "vitest";
import { buildStandaloneHtml } from "./export";
import type { ProjectFile } from "../data/types";

const files: ProjectFile[] = [
  { path: "index.html", name: "index.html", kind: "html", mimeType: "text/html", size: 10 },
  { path: "styles/main.css", name: "main.css", kind: "css", mimeType: "text/css", size: 10 },
  { path: "scripts/main.js", name: "main.js", kind: "js", mimeType: "text/javascript", size: 10 },
  { path: "images/couple.png", name: "couple.png", kind: "image", mimeType: "image/png", size: 3 },
];

describe("standalone HTML export", () => {
  it("inlines CSS, JS and binary assets as data URIs", async () => {
    const html = `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="styles/main.css" />
    </head><body style="background:url('images/couple.png')">
      <img src="images/couple.png" />
      <script src="scripts/main.js"></script>
    </body></html>`;
    const output = await buildStandaloneHtml({
      html,
      mainFilePath: "index.html",
      files,
      texts: {
        "index.html": html,
        "styles/main.css": "body{background:url('../images/couple.png')}",
        "scripts/main.js": "window.ready = true;",
      },
      fetchAsset: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    expect(output).not.toContain('href="styles/main.css"');
    expect(output).not.toContain('src="scripts/main.js"');
    expect(output).toContain("window.ready = true;");
    expect(output).toContain("data:image/png;base64,");
    expect(output.match(/data:image\/png;base64,/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps external URLs untouched", async () => {
    const html = '<!DOCTYPE html><html><body><a href="https://example.com/invite">Details</a></body></html>';
    const output = await buildStandaloneHtml({
      html,
      mainFilePath: "index.html",
      files: [],
      texts: {},
      fetchAsset: async () => null,
    });
    expect(output).toContain('href="https://example.com/invite"');
  });
});
