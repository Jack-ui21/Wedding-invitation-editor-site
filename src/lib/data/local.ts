/**
 * LOCAL DEVELOPMENT DRIVER — server-side JSON + files under .data/.
 * This exists so import/editor/persistence can be tested before Supabase credentials exist.
 * It is blocked by config.assertProductionConfig() in production and is never a browser store.
 */
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectFileKind, mimeForPath, safeRelativePath } from "./path";
import type { DataStore } from "./store";
import type {
  CustomerRecord,
  ProjectFile,
  ProjectPatch,
  ProjectRecord,
  Role,
  SessionUser,
  TemplateRecord,
  UserRecord,
} from "./types";
import { createEmptyWedding } from "./types";

interface LocalUser extends UserRecord {
  passwordHash: string;
}
interface PasswordReset {
  token: string;
  userId: string;
  expires: number;
}
interface LocalDb {
  users: LocalUser[];
  customers: CustomerRecord[];
  projects: ProjectRecord[];
  templates: TemplateRecord[];
  resets: PasswordReset[];
}

const root = path.join(process.cwd(), ".data");
const dbFile = path.join(root, "store.json");
const filesRoot = path.join(root, "files");
let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await mkdir(filesRoot, { recursive: true });
      try {
        await readFile(dbFile, "utf8");
      } catch {
        await atomicWrite(dbFile, { users: [], customers: [], projects: [], templates: [], resets: [] });
      }
    })();
  }
  return initPromise;
}

async function atomicWrite(target: string, value: unknown): Promise<void> {
  const tmp = `${target}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, target);
}

async function readDb(): Promise<LocalDb> {
  await ensureInit();
  return JSON.parse(await readFile(dbFile, "utf8")) as LocalDb;
}

async function writeDb(db: LocalDb): Promise<void> {
  await atomicWrite(dbFile, db);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function diskPath(projectId: string, relative: string): string {
  return path.join(filesRoot, projectId, safeRelativePath(relative));
}

function publicUser(user: LocalUser): UserRecord {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const localStore: DataStore = {
  async ready() {
    await ensureInit();
  },

  async getUserByEmail(email) {
    const db = await readDb();
    return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  },

  async getUserById(id) {
    const db = await readDb();
    const user = db.users.find((item) => item.id === id);
    return user ? publicUser(user) : null;
  },

  async createUser({ name, email, password, role }) {
    const db = await readDb();
    const normalized = email.trim().toLowerCase();
    if (db.users.some((user) => user.email.toLowerCase() === normalized)) {
      throw new Error("An account with this email already exists");
    }
    const user: LocalUser = {
      id: randomUUID(),
      name: name.trim(),
      email: normalized,
      role,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    await writeDb(db);
    return publicUser(user);
  },

  async listUsers() {
    const db = await readDb();
    return db.users.map(publicUser);
  },

  async setUserRole(id, role: Role) {
    const db = await readDb();
    const user = db.users.find((item) => item.id === id);
    if (!user) throw new Error("User not found");
    user.role = role;
    await writeDb(db);
  },

  async setPassword(userId, password) {
    const db = await readDb();
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw new Error("User not found");
    user.passwordHash = hashPassword(password);
    await writeDb(db);
  },

  async getCustomerByUserId(userId) {
    const db = await readDb();
    return db.customers.find((customer) => customer.userId === userId) ?? null;
  },

  async getCustomerById(id) {
    const db = await readDb();
    return db.customers.find((customer) => customer.id === id) ?? null;
  },

  async listCustomers() {
    const db = await readDb();
    return [...db.customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createCustomer(input) {
    const db = await readDb();
    const customer: CustomerRecord = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      createdAt: new Date().toISOString(),
    };
    db.customers.push(customer);
    await writeDb(db);
    return customer;
  },

  async updateCustomer(id, patch) {
    const db = await readDb();
    const customer = db.customers.find((item) => item.id === id);
    if (!customer) throw new Error("Customer not found");
    Object.assign(customer, patch);
    await writeDb(db);
    return customer;
  },

  async listProjects(filter) {
    const db = await readDb();
    return db.projects
      .filter((project) => !filter?.customerId || project.customerId === filter.customerId)
      .filter((project) => !filter?.ownerId || project.ownerId === filter.ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getProject(id) {
    const db = await readDb();
    return db.projects.find((project) => project.id === id) ?? null;
  },

  async createProject(input) {
    const db = await readDb();
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: randomUUID(),
      customerId: input.customerId,
      ownerId: input.ownerId,
      name: input.name.trim(),
      templateId: input.templateId ?? null,
      status: "draft",
      slug: null,
      publishedUrl: null,
      mainFilePath: input.mainFilePath ?? "index.html",
      wedding: createEmptyWedding(),
      fieldMappings: {},
      events: [],
      files: [],
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    await writeDb(db);
    return project;
  },

  async updateProject(id, patch: ProjectPatch) {
    const db = await readDb();
    const project = db.projects.find((item) => item.id === id);
    if (!project) throw new Error("Project not found");
    Object.assign(project, patch);
    if (patch.wedding) {
      project.wedding = { ...createEmptyWedding(), ...project.wedding, ...patch.wedding } as ProjectRecord["wedding"];
    }
    if (patch.fieldMappings) project.fieldMappings = { ...patch.fieldMappings };
    project.updatedAt = new Date().toISOString();
    await writeDb(db);
    return project;
  },

  async deleteProject(id) {
    const db = await readDb();
    db.projects = db.projects.filter((project) => project.id !== id);
    await writeDb(db);
    await rm(path.join(filesRoot, id), { recursive: true, force: true });
  },

  async duplicateProject(id, name) {
    const source = await this.getProject(id);
    if (!source) throw new Error("Project not found");
    const copy = await this.createProject({
      customerId: source.customerId,
      ownerId: source.ownerId,
      name,
      templateId: source.templateId,
      mainFilePath: source.mainFilePath,
    });
    for (const file of source.files) {
      const data = await this.getFile(id, file.path);
      if (data) await this.putFile(copy.id, file.path, data, file.mimeType, { isAsset: file.isAsset });
    }
    return this.updateProject(copy.id, {
      wedding: structuredClone(source.wedding),
      fieldMappings: structuredClone(source.fieldMappings),
      events: structuredClone(source.events),
      files: structuredClone(source.files),
    });
  },

  async listTemplates() {
    const db = await readDb();
    return db.templates;
  },

  async createTemplate(input) {
    const db = await readDb();
    const template: TemplateRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    db.templates.push(template);
    await writeDb(db);
    return template;
  },

  async slugTaken(slug, exceptProjectId) {
    const db = await readDb();
    return db.projects.some((project) => project.slug === slug && project.id !== exceptProjectId);
  },

  async getPublishedProject(slug) {
    const db = await readDb();
    return db.projects.find((project) => project.slug === slug && project.status === "published") ?? null;
  },

  async listFiles(projectId) {
    const project = await this.getProject(projectId);
    return project?.files ?? [];
  },

  async getFile(projectId, relative) {
    try {
      return await readFile(diskPath(projectId, relative));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },

  async putFile(projectId, relative, data, mimeType, options) {
    const safe = safeRelativePath(relative);
    const target = diskPath(projectId, safe);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    const db = await readDb();
    const project = db.projects.find((item) => item.id === projectId);
    if (!project) throw new Error("Project not found");
    const file: ProjectFile = {
      path: safe,
      name: safe.split("/").pop() ?? safe,
      kind: detectFileKind(safe),
      mimeType: mimeType || mimeForPath(safe),
      size: data.byteLength,
      isAsset: options?.isAsset ?? false,
    };
    project.files = [...project.files.filter((item) => item.path !== safe), file];
    project.updatedAt = new Date().toISOString();
    await writeDb(db);
    return file;
  },

  async createSignedUploadUrl() {
    throw new Error("Signed upload URLs are only available with the Supabase driver");
  },

  async registerFile(projectId, file) {
    const db = await readDb();
    const project = db.projects.find((item) => item.id === projectId);
    if (!project) throw new Error("Project not found");
    project.files = [...project.files.filter((item) => item.path !== file.path), file];
    project.updatedAt = new Date().toISOString();
    await writeDb(db);
    return file;
  },

  async deleteFile(projectId, relative) {
    const safe = safeRelativePath(relative);
    await unlink(diskPath(projectId, safe)).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
    const db = await readDb();
    const project = db.projects.find((item) => item.id === projectId);
    if (project) {
      project.files = project.files.filter((file) => file.path !== safe);
      project.updatedAt = new Date().toISOString();
      await writeDb(db);
    }
  },

  async getFileUrl(projectId, relative) {
    return `/api/files/${projectId}/${safeRelativePath(relative)
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  },

  async createPasswordReset(userId) {
    const db = await readDb();
    const token = randomBytes(24).toString("hex");
    db.resets = db.resets.filter((item) => item.userId !== userId && item.expires > Date.now());
    db.resets.push({ token, userId, expires: Date.now() + 30 * 60 * 1000 });
    await writeDb(db);
    return token;
  },

  async consumePasswordReset(token) {
    const db = await readDb();
    const reset = db.resets.find((item) => item.token === token && item.expires > Date.now());
    if (!reset) return null;
    db.resets = db.resets.filter((item) => item.token !== token);
    await writeDb(db);
    return reset.userId;
  },

  async sessionUser(user) {
    if (user.role !== "customer") return { ...user, customerId: null };
    const customer = await this.getCustomerByUserId(user.id);
    return { ...user, customerId: customer?.id ?? null };
  },
};

export function verifyLocalPassword(password: string, hash: string): boolean {
  return verifyPassword(password, hash);
}
