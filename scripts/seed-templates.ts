/**
 * Turns the supplied HTML wedding templates into reusable studio templates.
 * Works with the local driver or the Supabase driver, depending on your env vars.
 * Usage: npm run seed-templates [owner@example.com]
 * Existing templates are skipped, so the script is safe to rerun.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import { getStore } from "../src/lib/data/get-store";
import { createEmptyWedding } from "../src/lib/data/types";
import type { FieldMappings, WeddingDetails, WeddingEvent } from "../src/lib/data/types";
import { importHtml } from "../src/lib/import/html";

Object.assign(globalThis, { DOMParser: new JSDOM().window.DOMParser });

const OWNER_EMAIL = process.argv[2] ?? process.env.OWNER_EMAIL ?? "owner@example.com";
const ROOT = process.cwd();
const TEMPLATES = [
  {
    file: "Traditional_Wedding_Website_for_Digital_Wedding_Invitation_FIXED.html",
    name: "Traditional Wedding",
    description: "Classic Indian wedding invitation with event sections, gallery and music.",
  },
  {
    file: "Royal_Purple_Fantasy_Indian_Wedding_Invitation_Website.html",
    name: "Royal Purple Fantasy",
    description: "Royal purple themed Indian wedding invitation with rich imagery and multiple events.",
  },
];

const URL_FIELDS = new Set(["mapsUrl", "musicUrl", "instagramUrl", "mapUrl", "imageUrl"]);

async function main() {
  const store = getStore();
  await store.ready();
  const owner = await store.getUserByEmail(OWNER_EMAIL);
  if (!owner || owner.role !== "owner") throw new Error(`Owner ${OWNER_EMAIL} not found. Register/sign in and promote first.`);
  const customer = await store.getCustomerByUserId(owner.id);
  if (!customer) throw new Error("Owner has no customer profile. Open /owner once in the app, then rerun.");

  const existing = await store.listTemplates();
  for (const spec of TEMPLATES) {
    if (existing.some((template) => template.name === spec.name)) {
      console.log(`SKIP ${spec.name} (already registered)`);
      continue;
    }

    console.log(`IMPORT ${spec.name} from ${spec.file}…`);
    const html = await readFile(path.join(ROOT, spec.file), "utf8");
    const started = Date.now();
    const result = importHtml(spec.file, html);

    const project = await store.createProject({
      customerId: customer.id,
      ownerId: owner.id,
      name: `[Template source] ${spec.name}`,
      mainFilePath: result.mainFilePath,
    });

    for (const file of result.files) {
      const bytes = file.bytes ?? new TextEncoder().encode(file.text ?? "");
      await store.putFile(project.id, file.path, Buffer.from(bytes), file.mimeType, { isAsset: file.isAsset });
    }

    const mappings: FieldMappings = {};
    const wedding: WeddingDetails = createEmptyWedding();
    const events: WeddingEvent[] = [];
    for (const field of result.fields) {
      if (!mappings[field.key]) mappings[field.key] = field.selector;
      const match = field.key.match(/^event\.(\d+)\.(.+)$/);
      if (match) {
        const index = Number(match[1]) - 1;
        while (events.length <= index) {
          events.push({ id: crypto.randomUUID(), name: "", date: "", time: "", location: "", description: "", imageUrl: "", mapUrl: "" });
        }
        const key = match[2] as keyof WeddingEvent;
        if (!events[index][key]) (events[index] as unknown as Record<string, string>)[key] = field.text;
      } else if (!URL_FIELDS.has(field.key) && field.text && field.text.length <= 300 && !wedding[field.key]) {
        wedding[field.key] = field.text;
      }
    }

    await store.updateProject(project.id, {
      wedding,
      events,
      fieldMappings: mappings,
      files: result.files.map((file) => ({
        path: file.path,
        name: file.name,
        kind: file.kind,
        mimeType: file.mimeType,
        size: file.size,
        isAsset: file.isAsset,
      })),
      status: "archived",
    });

    const template = await store.createTemplate({
      name: spec.name,
      description: spec.description,
      thumbnailPath: "",
      sourceProjectId: project.id,
    });
    console.log(
      `READY ${template.name}: ${result.files.length} files, ${result.fields.length} fields, ` +
        `${result.dataUriCount} embedded images, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
