/** Production driver: Supabase Postgres/Auth/Storage. Server-only. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL, STORAGE_BUCKET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../config";
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
  WeddingEvent,
} from "./types";
import { createEmptyWedding } from "./types";

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

function rowToUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: row.role as Role,
    createdAt: String(row.created_at),
  };
}

function rowToCustomer(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone ?? ""),
    createdAt: String(row.created_at),
  };
}

function rowToProject(
  row: Record<string, unknown>,
  wedding: Record<string, string> | null,
  events: WeddingEvent[],
  files: ProjectFile[],
  fieldMappings: Record<string, string> = {},
): ProjectRecord {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    ownerId: String(row.owner_id),
    name: String(row.project_name),
    templateId: row.template_id ? String(row.template_id) : null,
    status: row.status as ProjectRecord["status"],
    slug: row.slug ? String(row.slug) : null,
    publishedUrl: row.published_url ? String(row.published_url) : null,
    mainFilePath: String(row.main_file_path ?? "index.html"),
    wedding: { ...createEmptyWedding(), ...(wedding ?? {}) },
    fieldMappings,
    events,
    files,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToFile(row: Record<string, unknown>): ProjectFile {
  return {
    path: String(row.file_path),
    name: String(row.file_name),
    kind: row.file_type as ProjectFile["kind"],
    mimeType: String(row.mime_type ?? ""),
    size: Number(row.file_size ?? 0),
    isAsset: Boolean(row.is_asset),
  };
}

function rowToTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    thumbnailPath: String(row.thumbnail_path ?? ""),
    sourceProjectId: row.source_project_id ? String(row.source_project_id) : null,
    createdAt: String(row.created_at),
  };
}

async function loadRelated(projectId: string) {
  const [weddingRes, eventsRes, filesRes] = await Promise.all([
    sb().from("wedding_details").select("data").eq("project_id", projectId).maybeSingle(),
    sb().from("events").select("*").eq("project_id", projectId).order("sort_order"),
    sb().from("project_files").select("*").eq("project_id", projectId),
  ]);
  if (weddingRes.error) throw weddingRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (filesRes.error) throw filesRes.error;
  const events: WeddingEvent[] = (eventsRes.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    date: String(row.event_date ?? ""),
    time: String(row.event_time ?? ""),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
    mapUrl: String(row.map_url ?? ""),
  }));
  return {
    wedding: (weddingRes.data?.data as Record<string, string> | undefined) ?? {},
    events,
    files: (filesRes.data ?? []).map(rowToFile),
  };
}

export const supabaseStore: DataStore = {
  async ready() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials are missing");
  },

  async getUserByEmail(email) {
    const { data, error } = await sb().from("users").select("*").ilike("email", email).maybeSingle();
    if (error) throw error;
    return data ? rowToUser(data) : null;
  },

  async getUserById(id) {
    const { data, error } = await sb().from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToUser(data) : null;
  },

  async createUser({ name, email, password, role }) {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await sb().auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });
    if (error) throw error;
    const { error: insertError } = await sb()
      .from("users")
      .insert({ id: data.user.id, email: normalized, name: name.trim(), role });
    if (insertError) throw insertError;
    return { id: data.user.id, name: name.trim(), email: normalized, role, createdAt: new Date().toISOString() };
  },

  async listUsers() {
    const { data, error } = await sb().from("users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToUser);
  },

  async setUserRole(id, role) {
    const { error } = await sb().from("users").update({ role }).eq("id", id);
    if (error) throw error;
  },

  async setPassword(userId, password) {
    const { error } = await sb().auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  },

  async getCustomerByUserId(userId) {
    const { data, error } = await sb().from("customers").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? rowToCustomer(data) : null;
  },

  async getCustomerById(id) {
    const { data, error } = await sb().from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToCustomer(data) : null;
  },

  async listCustomers() {
    const { data, error } = await sb().from("customers").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToCustomer);
  },

  async createCustomer(input) {
    const { data, error } = await sb()
      .from("customers")
      .insert({
        user_id: input.userId,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToCustomer(data);
  },

  async updateCustomer(id, patch) {
    const { data, error } = await sb().from("customers").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return rowToCustomer(data);
  },

  async listProjects(filter) {
    let query = sb().from("projects").select("*");
    if (filter?.customerId) query = query.eq("customer_id", filter.customerId);
    if (filter?.ownerId) query = query.eq("owner_id", filter.ownerId);
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (!rows.length) return [];
    const ids = rows.map((row) => String(row.id));
    const [weddingsRes, eventsRes, filesRes] = await Promise.all([
      sb().from("wedding_details").select("project_id,data").in("project_id", ids),
      sb().from("events").select("*").in("project_id", ids).order("sort_order"),
      sb().from("project_files").select("*").in("project_id", ids),
    ]);
    if (weddingsRes.error) throw weddingsRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (filesRes.error) throw filesRes.error;
    const weddings = new Map((weddingsRes.data ?? []).map((row) => [String(row.project_id), row.data as Record<string, string>]));
    const eventsByProject = new Map<string, WeddingEvent[]>();
    for (const row of eventsRes.data ?? []) {
      const projectId = String(row.project_id);
      const list = eventsByProject.get(projectId) ?? [];
      list.push({
        id: String(row.id),
        name: String(row.name ?? ""),
        date: String(row.event_date ?? ""),
        time: String(row.event_time ?? ""),
        location: String(row.location ?? ""),
        description: String(row.description ?? ""),
        imageUrl: String(row.image_url ?? ""),
        mapUrl: String(row.map_url ?? ""),
      });
      eventsByProject.set(projectId, list);
    }
    const filesByProject = new Map<string, ProjectFile[]>();
    for (const row of filesRes.data ?? []) {
      const projectId = String(row.project_id);
      const list = filesByProject.get(projectId) ?? [];
      list.push(rowToFile(row));
      filesByProject.set(projectId, list);
    }
    return rows.map((row) => {
      const projectId = String(row.id);
      return rowToProject(
        row,
        weddings.get(projectId) ?? {},
        eventsByProject.get(projectId) ?? [],
        filesByProject.get(projectId) ?? [],
        (row.field_mappings as Record<string, string> | undefined) ?? {},
      );
    });
  },

  async getProject(id) {
    const { data, error } = await sb().from("projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const related = await loadRelated(String(data.id));
    return rowToProject(data, related.wedding, related.events, related.files, (data.field_mappings as Record<string, string> | undefined) ?? {});
  },

  async createProject(input) {
    const { data, error } = await sb()
      .from("projects")
      .insert({
        customer_id: input.customerId,
        owner_id: input.ownerId,
        project_name: input.name.trim(),
        template_id: input.templateId ?? null,
        main_file_path: input.mainFilePath ?? "index.html",
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToProject(data, {}, [], []);
  },

  async updateProject(id, patch: ProjectPatch) {
    const projectRow: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ["name", "customerId", "ownerId", "status", "templateId", "slug", "publishedUrl", "mainFilePath", "fieldMappings"] as const) {
      if (patch[key] !== undefined) {
        const column: Record<typeof key, string> = {
          name: "project_name",
          customerId: "customer_id",
          ownerId: "owner_id",
          status: "status",
          templateId: "template_id",
          slug: "slug",
          publishedUrl: "published_url",
          mainFilePath: "main_file_path",
          fieldMappings: "field_mappings",
        };
        projectRow[column[key]] = patch[key];
      }
    }
    const { error } = await sb().from("projects").update(projectRow).eq("id", id);
    if (error) throw error;
    if (patch.wedding) {
      const current = await sb().from("wedding_details").select("data").eq("project_id", id).maybeSingle();
      const merged = { ...(current.data?.data ?? {}), ...patch.wedding };
      const { error: weddingError } = await sb()
        .from("wedding_details")
        .upsert({ project_id: id, data: merged, updated_at: new Date().toISOString() });
      if (weddingError) throw weddingError;
    }
    if (patch.events) {
      const { error: deleteError } = await sb().from("events").delete().eq("project_id", id);
      if (deleteError) throw deleteError;
      if (patch.events.length) {
        const { error: eventError } = await sb().from("events").insert(
          patch.events.map((event, index) => ({
            id: event.id,
            project_id: id,
            name: event.name,
            event_date: event.date,
            event_time: event.time,
            location: event.location,
            description: event.description,
            image_url: event.imageUrl,
            map_url: event.mapUrl,
            sort_order: index,
          })),
        );
        if (eventError) throw eventError;
      }
    }
    if (patch.files) {
      const { error: fileError } = await sb().from("project_files").delete().eq("project_id", id);
      if (fileError) throw fileError;
      if (patch.files.length) {
        const { error: insertError } = await sb().from("project_files").insert(
          patch.files.map((file) => ({
            project_id: id,
            file_path: file.path,
            file_name: file.name,
            file_type: file.kind,
            mime_type: file.mimeType,
            file_size: file.size,
            is_asset: file.isAsset ?? false,
          })),
        );
        if (insertError) throw insertError;
      }
    }
    const project = await this.getProject(id);
    if (!project) throw new Error("Project not found after update");
    return project;
  },

  async deleteProject(id) {
    const files = await this.listFiles(id);
    await Promise.all(files.map((file) => sb().storage.from(STORAGE_BUCKET).remove([`${id}/${file.path}`])));
    const { error } = await sb().from("projects").delete().eq("id", id);
    if (error) throw error;
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
    return this.updateProject(copy.id, { wedding: source.wedding, fieldMappings: source.fieldMappings, events: source.events });
  },

  async listTemplates() {
    const { data, error } = await sb().from("templates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTemplate);
  },

  async createTemplate(input) {
    const { data, error } = await sb()
      .from("templates")
      .insert({
        name: input.name,
        description: input.description,
        thumbnail_path: input.thumbnailPath,
        source_project_id: input.sourceProjectId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToTemplate(data);
  },

  async slugTaken(slug, exceptProjectId) {
    let query = sb().from("projects").select("id").eq("slug", slug);
    if (exceptProjectId) query = query.neq("id", exceptProjectId);
    const { data, error } = await query;
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  async getPublishedProject(slug) {
    const { data, error } = await sb()
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const related = await loadRelated(String(data.id));
    return rowToProject(data, related.wedding, related.events, related.files, (data.field_mappings as Record<string, string> | undefined) ?? {});
  },

  async listFiles(projectId) {
    const project = await this.getProject(projectId);
    return project?.files ?? [];
  },

  async getFile(projectId, relative) {
    const safe = safeRelativePath(relative);
    const { data, error } = await sb().storage.from(STORAGE_BUCKET).download(`${projectId}/${safe}`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  },

  async putFile(projectId, relative, data, mimeType, options) {
    const safe = safeRelativePath(relative);
    const storagePath = `${projectId}/${safe}`;
    const { error } = await sb()
      .storage.from(STORAGE_BUCKET)
      .upload(storagePath, new Uint8Array(data), {
        contentType: mimeType || mimeForPath(safe),
        upsert: true,
        cacheControl: "3600",
      });
    if (error) throw error;
    const file: ProjectFile = {
      path: safe,
      name: safe.split("/").pop() ?? safe,
      kind: detectFileKind(safe),
      mimeType: mimeType || mimeForPath(safe),
      size: data.byteLength,
      isAsset: options?.isAsset ?? false,
    };
    const { error: metaError } = await sb()
      .from("project_files")
      .upsert(
        {
          project_id: projectId,
          file_path: safe,
          file_name: file.name,
          file_type: file.kind,
          mime_type: file.mimeType,
          file_size: file.size,
          is_asset: file.isAsset,
        },
        { onConflict: "project_id,file_path" },
      );
    if (metaError) throw metaError;
    await sb().from("projects").update({ updated_at: new Date().toISOString() }).eq("id", projectId);
    return file;
  },

  async createSignedUploadUrl(projectId, relative) {
    const safe = safeRelativePath(relative);
    const { data, error } = await sb()
      .storage.from(STORAGE_BUCKET)
      .createSignedUploadUrl(`${projectId}/${safe}`, { upsert: true });
    if (error || !data) throw error ?? new Error("Could not create upload URL");
    return { path: data.path, token: data.token, signedUrl: data.signedUrl };
  },

  async registerFile(projectId, file) {
    const { error } = await sb().from("project_files").upsert(
      {
        project_id: projectId,
        file_path: file.path,
        file_name: file.name,
        file_type: file.kind,
        mime_type: file.mimeType,
        file_size: file.size,
        is_asset: file.isAsset ?? false,
      },
      { onConflict: "project_id,file_path" },
    );
    if (error) throw error;
    return file;
  },

  async deleteFile(projectId, relative) {
    const safe = safeRelativePath(relative);
    await sb().storage.from(STORAGE_BUCKET).remove([`${projectId}/${safe}`]);
    await sb().from("project_files").delete().eq("project_id", projectId).eq("file_path", safe);
  },

  async getFileUrl(projectId, relative) {
    const safe = safeRelativePath(relative);
    const { data, error } = await sb()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrl(`${projectId}/${safe}`, 60 * 60 * 24 * 30);
    if (error || !data) throw error ?? new Error("Could not create file URL");
    return data.signedUrl;
  },

  async createPasswordReset(userId) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error("User not found");
    const { error } = await sb().auth.resetPasswordForEmail(user.email, {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    if (error) throw error;
    return "";
  },

  async consumePasswordReset() {
    return null;
  },

  async sessionUser(user) {
    if (user.role !== "customer") return { ...user, customerId: null };
    const customer = await this.getCustomerByUserId(user.id);
    return { ...user, customerId: customer?.id ?? null };
  },
};
