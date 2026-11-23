import type { FileKind } from "../data/types";

export type FieldKey =
  | "brideName"
  | "groomName"
  | "coupleNames"
  | "weddingDate"
  | "weddingTime"
  | "venue"
  | "venueAddress"
  | "mapsUrl"
  | "welcomeMessage"
  | "invitationMessage"
  | "brideFamily"
  | "groomFamily"
  | "parentsNames"
  | "countdownHeading"
  | "musicUrl"
  | "instagramUrl"
  | "rsvpPhone"
  | string;

export interface ImportedFile {
  path: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  text?: string;
  bytes?: Uint8Array;
  isAsset?: boolean;
}

export interface DetectedField {
  key: FieldKey;
  selector: string;
  text: string;
  confidence: number;
  source: "id" | "class" | "structure" | "link" | "manual";
}

export interface ImportResult {
  mainFilePath: string;
  html: string;
  files: ImportedFile[];
  fields: DetectedField[];
  htmlCandidates: string[];
  warnings: string[];
  dataUriCount: number;
}

export interface AssetReference {
  path: string;
  kind: FileKind;
  external: boolean;
  dataUri: boolean;
}
