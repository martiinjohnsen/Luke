import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
const db = new PGlite({ extensions: { pgcrypto } });
try {
  // Reproduce Supabase's database roles and verified JWT identity for RLS tests.
  // This does not simulate GoTrue, SMTP delivery, or the realtime transport.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create publication supabase_realtime;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);
  for (const name of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  ).sort()) {
    if (name.endsWith(".sql")) {
      const migration=await readFile(new URL("../supabase/migrations/"+name,import.meta.url),"utf8");
      await db.exec(migration);
      if((name.startsWith("20261107") || name.startsWith("20261108"))) await db.exec(migration);
    }
  }
  for (const name of (await readdir(new URL("../supabase/tests/", import.meta.url))).sort()) {
    if (!name.endsWith(".sql")) continue;
    const result = await db.exec(await readFile(new URL("../supabase/tests/" + name, import.meta.url), "utf8"));
    console.log(result.at(-1).rows[0].result);
  }
} catch (error) {
  console.error(error.message);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
