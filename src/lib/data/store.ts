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

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone: string;
  userId: string;
}

export interface CreateProjectInput {
  customerId: string;
  ownerId: string;
  name: string;
  templateId?: string | null;
  mainFilePath?: string;
}

export interface DataStore {
  ready(): Promise<void>;

  getUserByEmail(email: string): Promise<(UserRecord & { passwordHash?: string }) | null>;
  getUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  listUsers(): Promise<UserRecord[]>;
  setUserRole(id: string, role: Role): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;

  getCustomerByUserId(userId: string): Promise<CustomerRecord | null>;
  getCustomerById(id: string): Promise<CustomerRecord | null>;
  listCustomers(): Promise<CustomerRecord[]>;
  createCustomer(input: CreateCustomerInput): Promise<CustomerRecord>;
  updateCustomer(id: string, patch: Partial<Pick<CustomerRecord, "name" | "email" | "phone">>): Promise<CustomerRecord>;

  listProjects(filter?: { customerId?: string; ownerId?: string }): Promise<ProjectRecord[]>;
  getProject(id: string): Promise<ProjectRecord | null>;
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  updateProject(id: string, patch: ProjectPatch): Promise<ProjectRecord>;
  deleteProject(id: string): Promise<void>;
  duplicateProject(id: string, name: string): Promise<ProjectRecord>;

  listTemplates(): Promise<TemplateRecord[]>;
  createTemplate(input: Omit<TemplateRecord, "id" | "createdAt">): Promise<TemplateRecord>;
  slugTaken(slug: string, exceptProjectId?: string): Promise<boolean>;
  getPublishedProject(slug: string): Promise<ProjectRecord | null>;

  listFiles(projectId: string): Promise<ProjectFile[]>;
  getFile(projectId: string, path: string): Promise<Buffer | null>;
  putFile(
    projectId: string,
    path: string,
    data: Buffer,
    mimeType: string,
    options?: { isAsset?: boolean },
  ): Promise<ProjectFile>;
  /** Creates a short-lived signed upload URL so browsers can upload large files directly. */
  createSignedUploadUrl(projectId: string, path: string): Promise<{ path: string; token: string; signedUrl: string }>;
  /** Registers metadata for a file that was uploaded directly to storage. */
  registerFile(projectId: string, file: ProjectFile): Promise<ProjectFile>;
  deleteFile(projectId: string, path: string): Promise<void>;
  getFileUrl(projectId: string, path: string): Promise<string>;

  createPasswordReset(userId: string): Promise<string>;
  consumePasswordReset(token: string): Promise<string | null>;

  sessionUser(user: UserRecord): Promise<SessionUser>;
}
