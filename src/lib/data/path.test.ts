import { describe, expect, it } from "vitest";
import { detectFileKind, mimeForPath, safeRelativePath, slugify } from "./path";

describe("storage paths", () => {
  it("accepts safe nested paths", () => {
    expect(safeRelativePath("images/photo one.png")).toBe("images/photo one.png");
    expect(safeRelativePath("styles\\inline.css")).toBe("styles/inline.css");
  });

  it("rejects traversal, absolute paths and null bytes", () => {
    expect(() => safeRelativePath("../secret.txt")).toThrow();
    expect(() => safeRelativePath("a/../../secret.txt")).toThrow();
    expect(() => safeRelativePath("/etc/passwd")).toThrow();
    expect(() => safeRelativePath("C:\\windows\\file.txt")).toThrow();
    expect(() => safeRelativePath("bad\0name")).toThrow();
  });

  it("slugifies names for public URLs", () => {
    expect(slugify("Rahul & Priya — Wedding!")).toBe("rahul-priya-wedding");
    expect(slugify("   ")).toBe("wedding");
  });

  it("detects code and asset kinds", () => {
    expect(detectFileKind("index.html")).toBe("html");
    expect(detectFileKind("main.CSS")).toBe("css");
    expect(detectFileKind("song.mp3")).toBe("audio");
    expect(mimeForPath("photo.webp")).toBe("image/webp");
  });
});
