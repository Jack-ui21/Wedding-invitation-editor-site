/**
 * Checks production deployment variables without printing any values.
 * Usage: node scripts/check-deploy-env.mjs
 */
const required = [
  "DATA_DRIVER",
  "NEXT_PUBLIC_DATA_DRIVER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "NEXT_PUBLIC_SITE_URL",
  "SESSION_SECRET",
];

const problems = [];
const env = process.env;

for (const name of required) {
  const value = (env[name] ?? "").trim();
  if (!value) {
    problems.push(`${name}: missing`);
    continue;
  }
  if (/YOUR_|REPLACE_|example\.com|localhost/i.test(value)) {
    problems.push(`${name}: still looks like a placeholder`);
  }
}

if ((env.DATA_DRIVER ?? "").trim() !== "supabase") {
  problems.push("DATA_DRIVER: must be supabase");
}
if ((env.NEXT_PUBLIC_DATA_DRIVER ?? "").trim() !== "supabase") {
  problems.push("NEXT_PUBLIC_DATA_DRIVER: must be supabase");
}
if ((env.SESSION_SECRET ?? "").length < 32) {
  problems.push("SESSION_SECRET: must be at least 32 characters");
}
if (!/^https?:\/\//.test((env.NEXT_PUBLIC_SITE_URL ?? "").trim())) {
  problems.push("NEXT_PUBLIC_SITE_URL: must start with https:// or http://");
}
if ((env.OWNER_EMAIL ?? "").trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((env.OWNER_EMAIL ?? "").trim())) {
  problems.push("OWNER_EMAIL: not a valid email");
}

if (problems.length) {
  console.error("Deployment config problems:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log("Deployment config OK. No secrets were printed.");
