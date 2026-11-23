import { describe, expect, it } from "vitest";
import { allowedProjectPatch, canAccessProject, canEditProject } from "./permissions";
import type { ProjectRecord, SessionUser } from "./data/types";

const project: ProjectRecord = {
  id: "p1",
  customerId: "c1",
  ownerId: "o1",
  name: "Wedding",
  templateId: null,
  status: "draft",
  slug: null,
  publishedUrl: null,
  mainFilePath: "index.html",
  wedding: { brideName: "Priya" } as ProjectRecord["wedding"],
  fieldMappings: {},
  events: [],
  files: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const customer: SessionUser = { id: "u1", name: "Priya", email: "priya@example.com", role: "customer", customerId: "c1" };
const otherCustomer: SessionUser = { id: "u2", name: "Other", email: "other@example.com", role: "customer", customerId: "c2" };
const owner: SessionUser = { id: "o1", name: "Owner", email: "owner@example.com", role: "owner", customerId: null };

describe("project permissions", () => {
  it("isolates customers from each other's projects", () => {
    expect(canAccessProject(customer, project)).toBe(true);
    expect(canAccessProject(otherCustomer, project)).toBe(false);
    expect(canAccessProject(owner, project)).toBe(true);
  });

  it("blocks customers from editing archived projects", () => {
    expect(canEditProject(customer, { ...project, status: "archived" })).toBe(false);
    expect(canEditProject(owner, { ...project, status: "archived" })).toBe(true);
  });

  it("strips owner-only fields from customer patches", () => {
    const patch = allowedProjectPatch(customer, {
      wedding: { brideName: "Anya" },
      events: [],
      fieldMappings: { brideName: "#name" },
      files: [],
      mainFilePath: "index.html",
      status: "published",
      slug: "hacked",
      publishedUrl: "https://evil.test",
      ownerId: "someone-else",
      name: "Mine",
    });
    expect(patch).toMatchObject({ wedding: { brideName: "Anya" }, events: [], fieldMappings: { brideName: "#name" }, files: [], mainFilePath: "index.html", name: "Mine" });
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("slug");
    expect(patch).not.toHaveProperty("publishedUrl");
    expect(patch).not.toHaveProperty("ownerId");
  });

  it("leaves owner patches untouched", () => {
    const patch = allowedProjectPatch(owner, { status: "published", slug: "wedding" });
    expect(patch).toEqual({ status: "published", slug: "wedding" });
  });
});
