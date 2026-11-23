import type { ProjectRecord, SessionUser } from "./data/types";

export function canAccessProject(user: SessionUser, project: ProjectRecord): boolean {
  if (user.role === "owner") return true;
  return Boolean(user.customerId && user.customerId === project.customerId);
}

export function canEditProject(user: SessionUser, project: ProjectRecord): boolean {
  if (!canAccessProject(user, project)) return false;
  if (project.status === "archived") return user.role === "owner";
  return true;
}

/** Customers may edit wedding content, never status, publishing, ownership or slug. */
export function allowedProjectPatch(user: SessionUser, patch: Record<string, unknown>): Record<string, unknown> {
  if (user.role === "owner") return patch;
  const safe: Record<string, unknown> = {};
  if (patch.wedding && typeof patch.wedding === "object") safe.wedding = patch.wedding;
  if (Array.isArray(patch.events)) safe.events = patch.events;
  if (patch.fieldMappings && typeof patch.fieldMappings === "object") safe.fieldMappings = patch.fieldMappings;
  if (Array.isArray(patch.files)) safe.files = patch.files;
  if (typeof patch.mainFilePath === "string") safe.mainFilePath = patch.mainFilePath;
  if (patch.name && typeof patch.name === "string") safe.name = patch.name.slice(0, 120);
  return safe;
}
