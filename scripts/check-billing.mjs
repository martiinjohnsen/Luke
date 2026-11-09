import { readFile } from 'node:fs/promises';
import { publicCloudConfig } from '../src/lib/cloud/public-config.ts';
const local={};
try {for(const line of (await readFile('.env.local','utf8')).split(/\r?\n/)) {
  const m=line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)=(.*)$/);
  if(m) local[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}} catch {}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL || publicCloudConfig.url;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicCloudConfig.publishableKey;
if(process.argv.includes('--editor-url')) {
  const project=new URL(url).hostname.split('.')[0];
  console.log(`https://supabase.com/dashboard/project/${project}/sql/new`);process.exit(0);
}
try {
  const response=await fetch(`${url}/rest/v1/rpc/luke_billing_ready`,{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ') ? {Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(response.ok && Number(data)>=1) process.exit(0);
  if(response.status===404 || data?.code==='PGRST202') process.exit(3);
  process.exit(2);
} catch {process.exit(2);}
