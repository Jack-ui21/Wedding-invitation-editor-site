# Wedding Invitation Studio — deployment kit

This is the "do it in order" guide. You need two mandatory accounts:

1. **Supabase** — database, login and file storage. <https://supabase.com/dashboard>
2. **Vercel** — runs the Next.js app. <https://vercel.com/new>

**GitHub is optional.** It gives automatic redeploys and version history, but you can deploy straight from your device with the Vercel CLI — see **Step 2B**.

You can use another host instead of Vercel, but it **must support Node.js 20+ / Next.js**. Ordinary shared PHP/cPanel hosting will not work.

> Never paste keys, passwords or secrets into chat. Enter them only in Supabase/Vercel/GitHub or your own `.env` files.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Choose a name, database password and region. Save the database password somewhere safe.
3. When it finishes, open **SQL Editor** → **New query**.
4. Paste the entire contents of `supabase/migrations/0001_init.sql` and click **Run**.
5. Create a second query, paste `supabase/migrations/0002_owner_helpers.sql`, and click **Run**.

What this creates:

- all tables and indexes
- Row Level Security so customers only see their own work
- the private `project-files` storage bucket
- a helper function to promote your owner account

If a query says a type/table already exists, you have already run it. Continue.

---

## 2A. Push the code to GitHub (recommended)

Create an empty repository at <https://github.com/new>. Do not initialize it with a README.

In Termux, inside the project folder:

```bash
cd /storage/emulated/0/venter/hopweb/projects/wit

git remote add origin https://github.com/YOUR_USERNAME/wedding-invitation-studio.git
git add .env.example .env.production.example DEPLOYMENT.md README.md package.json scripts/check-deploy-env.mjs scripts/seed-templates.ts supabase
git commit -m "Add deployment kit and production seed support"
git push -u origin HEAD
```

If `git add` says a file is missing, skip that file name. Do **not** add `.env.local`.

## 2B. Deploy without GitHub

GitHub is **not mandatory**. Use this path if you want fewer accounts:

```bash
cd /storage/emulated/0/venter/hopweb/projects/wit

npm install -g vercel
vercel login                         # completes in your browser/email
vercel project create wedding-invitation-studio
vercel link                          # choose the project you just created
```

Then add the environment variables from Step 3 in the Vercel Dashboard, and deploy:

```bash
vercel --prod
```

Trade-off: with CLI deploys, future code changes require running `vercel --prod` again. GitHub gives automatic deployments and rollback history. Other hosts also support Git-free upload/CLI deployment.

---

## 3. Set environment variables and deploy

1. If you used GitHub: go to <https://vercel.com/new> → **Import** the repository. If you used the CLI: your project already exists; open it in the Vercel Dashboard.
2. Framework should be detected as **Next.js**. Do not change the build command.
3. Add these environment variables before clicking Deploy:

| Name | Value |
| --- | --- |
| `DATA_DRIVER` | `supabase` |
| `NEXT_PUBLIC_DATA_DRIVER` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key |
| `OWNER_EMAIL` | The email you will use as the studio owner |
| `NEXT_PUBLIC_SITE_URL` | `https://your-vercel-app.vercel.app` or your custom domain |
| `SESSION_SECRET` | 32+ random characters. Generate on your device with `openssl rand -hex 32` |

A ready-to-copy list is in `.env.production.example`.

4. Click **Deploy** in the dashboard, or run `vercel --prod` if you used the CLI.
5. Wait for the build to finish, then open the Vercel URL. You should see the login page.

If you use another host, set the same variables and run:

```bash
npm install --no-bin-links
npm run build
npm run start
```

---

## 4. Create and promote the owner

1. Open `https://your-vercel-app.vercel.app/register`.
2. Register using exactly the email you put in `OWNER_EMAIL`.
3. Go to Supabase SQL Editor and run:

```sql
select public.promote_studio_owner('you@example.com');
```

Replace the email with yours. Then refresh the app and open `/owner`. You should see the owner dashboard.

Alternative if you prefer a terminal command (with production env vars loaded):

```bash
npm run promote-owner you@example.com
```

On Termux, prefix it with `ESBUILD_BINARY_PATH=$HOME/.local/esbuild/esbuild-0.25.12` if you get an `EACCES` error.

---

## 5. Add the two supplied templates

The two large HTML files are already in the project folder. To register them in the hosted database, run the seeder **from your own device** with production variables loaded:

```bash
cd /storage/emulated/0/venter/hopweb/projects/wit

set -a
. ./.env.production.local
set +a

npm run seed-templates
```

Create `.env.production.local` first by copying `.env.production.example` and filling in the real values. This file is git-ignored; never commit it.

The two HTML files are also git-ignored, so keep them on the device where you run the seeder. If you deploy from a fresh machine without them, use the owner UI import option below.

On Termux, if you see an `EACCES` error for `esbuild`, run the seeder like this instead:

```bash
ESBUILD_BINARY_PATH=$HOME/.local/esbuild/esbuild-0.25.12 npm run seed-templates
```

The seeder is safe to run again: existing templates are skipped.

Alternatively, inside `/owner/templates` you can import each HTML file and use **Save as template** from the editor.

---

## 6. Verify everything works

Run locally before deploying, with production variables loaded:

```bash
npm run check:deploy-env
```

It prints only missing/invalid variable names, never the values.

Then in the live app:

- Owner can open `/owner`, `/owner/customers`, `/owner/projects`, `/owner/templates`.
- Create a customer, create a project from a template, edit it, save it.
- Publish it and open `/w/your-slug`.
- Export a standalone HTML file and open it in a browser.
- Sign in as a customer: they should only see their own projects.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails: `DATA_DRIVER=local is not allowed in production` | Add `DATA_DRIVER=supabase` and `NEXT_PUBLIC_DATA_DRIVER=supabase` in Vercel, then redeploy. |
| Build fails: `SESSION_SECRET must be at least 32...` | Generate a new one with `openssl rand -hex 32` and set it in Vercel. |
| `relation "public.users" does not exist` | Run `supabase/migrations/0001_init.sql` in Supabase SQL Editor. |
| `function public.promote_studio_owner does not exist` | Run `supabase/migrations/0002_owner_helpers.sql`. |
| `No studio user found for ...` | Register/sign in once in the live app first, then promote again. |
| Customer cannot see a project | Check the project's customer is linked to that customer's login, and that RLS migration 0001 was applied. |
| Published link shows 404 | Open the editor, click Publish again, confirm status is `published`, and make sure `NEXT_PUBLIC_SITE_URL` is correct. |
| Large upload fails | Use the **Import** flow (it uploads directly to Supabase Storage) or run `npm run seed-templates` locally with production env vars. |
| Local app still uses old data | Local development uses `.data/`; production uses Supabase. They are separate by design. |

---

## Official references

- Supabase SQL editor: <https://supabase.com/docs/guides/database/using-sql-editor>
- Supabase API keys: <https://supabase.com/docs/guides/api/api-keys>
- Vercel environment variables: <https://vercel.com/docs/environment-variables>
- Next.js deployment: <https://nextjs.org/docs/app/guides/deploying>
- GitHub adding a remote: <https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories>
