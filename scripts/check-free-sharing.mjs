// Read-only deployment check. Never creates an invitation or changes account data.
import { readFile } from 'node:fs/promises';
import { publicCloudConfig } from '../src/lib/cloud/public-config.ts';

const local = {};
try {
  for (const line of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=(.*)$/);
    if (match) local[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL || publicCloudConfig.url;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicCloudConfig.publishableKey;
if (process.argv.includes('--editor-url')) {
  console.log(`https://supabase.com/dashboard/project/${new URL(url).hostname.split('.')[0]}/sql/new`);
  process.exit(0);
}
async function readiness(name) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (response.ok && typeof data === 'number') return data;
  if (response.status === 404 && data?.code === 'PGRST202') return null;
  throw new Error('Kunne ikke kontrollere delingstilgangen.');
}
try {
  const free = await readiness('luke_free_sharing_ready');
  if (free !== null) process.exit(free === 1 ? 0 : 3);
  // Older free installations have no billing migration or restoration marker.
  const billing = await readiness('luke_billing_ready');
  if (billing !== null) process.exit(3);
  const version = await readiness('luke_media_ready');
  process.exit(version !== null && version >= 6 ? 0 : 3);
} catch {
  process.exit(2);
}
