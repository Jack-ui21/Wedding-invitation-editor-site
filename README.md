# Wedding Invitation Studio

A multi-tenant wedding website studio: owners manage customers, templates and projects; customers edit only their own invitations. Imported HTML/ZIP templates become editable source files with a sandboxed live preview, cloud persistence, media uploads, export and published public pages.

## Architecture

- **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4**
- **Supabase** Auth, Postgres and Storage in production
- **Local development driver** (`DATA_DRIVER=local`) stores server-side JSON and files under `.data/` so the full app can be tested before credentials exist. It is blocked in production builds.
- **Sessions**: signed, httpOnly cookies shared by both drivers.
- **Authorization**: every API route checks the server session and project ownership; Supabase RLS mirrors the same rules.
- **Preview**: `iframe srcDoc` with `sandbox="allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"` and no `allow-same-origin`.
- **Large imports**: browser reads HTML/ZIP directly; production uploads use short-lived signed URLs issued by the server and go straight to Supabase Storage, bypassing Vercel's function body limit.
- **Single source of truth**: visual edits are written back into the real HTML source; code edits replace file contents; preview and exports render current source.

## Local development

```bash
npm install --no-bin-links   # needed on Termux/Android shared storage
npm run seed-owner owner@example.com 'OwnerPass123!'
npm run seed-templates           # optional: register the two supplied HTML templates
npm run dev
```

Open <http://localhost:3000/login>. The seeded owner can add customers, create projects, import templates, publish and export.

`seed-templates` parses the two supplied HTML files once and stores them as archived source projects plus template records. The Templates page lists them; choosing one in **New project** copies its files, field mappings and events into the customer's new project. You can also use **Save as template** inside any project editor to turn a finished invitation into a reusable template.

Run unit tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

On Android/Termux, Turbopack and several native modules are unsupported. The scripts already force `--webpack`; esbuild, Rollup and LightningCSS native binaries must be copied into Termux internal storage and referenced by the local patches in `node_modules`. Vercel/Linux builds do not need those patches.

## Production setup

1. Create a Supabase project. Apply `supabase/migrations/0001_init.sql` in its SQL editor.
2. Create a GitHub repository and push this project (do not commit `.env.local`).
3. Create a Vercel project and add these environment variables:

   - `DATA_DRIVER=supabase`
   - `NEXT_PUBLIC_DATA_DRIVER=supabase`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OWNER_EMAIL`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://studio.example.com`)
   - `SESSION_SECRET` (32+ random characters, generate with `openssl rand -hex 32`)

4. Deploy, register/sign in the owner email, then run `npm run promote-owner owner@example.com` locally with the production Supabase variables set.
5. Add customers, import the two supplied templates or custom ZIPs, then publish from the project editor.

Never paste secrets into chat or commit them.

## Project structure

- `src/app/api/` — server-authorised auth, project, file, publish and import endpoints
- `src/app/w/[slug]/route.ts` — public published invitation page
- `src/lib/data/` — local and Supabase data drivers
- `src/lib/import/` — HTML/ZIP parsing, field detection, safe extraction
- `src/lib/editor/` — source patching, preview document, sandboxed bridge, export
- `src/components/editor/` — editor tabs and panes

## Security notes

- Customers can only read and edit projects whose `customerId` matches their session.
- Only owners can publish, unpublish, set slugs, delete projects, manage templates and manage roles.
- ZIP imports reject path traversal, executable entries, encrypted files and oversized archives.
- Imported scripts never run in the studio origin; they run only inside the sandbox or on the public published page under a restrictive Content Security Policy.
- Uploaded media is private to the project unless that project is published.
