export type Role = "owner" | "customer";

export const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "awaiting_customer",
  "ready_for_review",
  "published",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type FileKind = "html" | "css" | "js" | "image" | "audio" | "font" | "other";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

/** Flat, template-agnostic wedding data. Text values keep template originals when empty. */
export interface WeddingDetails {
  brideName: string;
  groomName: string;
  coupleNames: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  mapsUrl: string;
  welcomeMessage: string;
  invitationMessage: string;
  brideFamily: string;
  groomFamily: string;
  parentsNames: string;
  countdownHeading: string;
  accentColor: string;
  musicUrl: string;
  brideImageUrl: string;
  groomImageUrl: string;
  coupleImageUrl: string;
  galleryImageUrl: string;
  backgroundImageUrl: string;
  instagramUrl: string;
  rsvpPhone: string;
  [key: string]: string;
}

export function createEmptyWedding(): WeddingDetails {
  return {
    brideName: "",
    groomName: "",
    coupleNames: "",
    weddingDate: "",
    weddingTime: "",
    venue: "",
    venueAddress: "",
    mapsUrl: "",
    welcomeMessage: "",
    invitationMessage: "",
    brideFamily: "",
    groomFamily: "",
    parentsNames: "",
    countdownHeading: "",
    accentColor: "",
    musicUrl: "",
    brideImageUrl: "",
    groomImageUrl: "",
    coupleImageUrl: "",
    galleryImageUrl: "",
    backgroundImageUrl: "",
    instagramUrl: "",
    rsvpPhone: "",
  };
}

export interface WeddingEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  imageUrl: string;
  mapUrl: string;
}

export interface ProjectFile {
  path: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  /** Data URIs are kept as content in source files; uploaded assets reference a stored path. */
  isAsset?: boolean;
}

/** Maps a logical wedding field to a CSS selector inside this template. */
export type FieldMappings = Record<string, string>;

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  thumbnailPath: string;
  sourceProjectId: string | null;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  customerId: string;
  ownerId: string;
  name: string;
  templateId: string | null;
  status: ProjectStatus;
  slug: string | null;
  publishedUrl: string | null;
  mainFilePath: string;
  wedding: WeddingDetails;
  fieldMappings: FieldMappings;
  events: WeddingEvent[];
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  customerId: string | null;
}

export interface ProjectPatch {
  name?: string;
  status?: ProjectStatus;
  templateId?: string | null;
  slug?: string | null;
  publishedUrl?: string | null;
  mainFilePath?: string;
  wedding?: Partial<WeddingDetails>;
  fieldMappings?: FieldMappings;
  events?: WeddingEvent[];
  files?: ProjectFile[];
}
