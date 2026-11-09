// Run by the account owner. Keys are entered without echo and never printed.
import Stripe from 'stripe';
import { PAID_SHARING_ENABLED } from '../src/lib/sharing-mode.ts';
import { createClient } from '@supabase/supabase-js';
import { publicCloudConfig } from '../src/lib/cloud/public-config.ts';
import { readFile, writeFile, chmod, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (!PAID_SHARING_ENABLED) {
  console.error('Betaling er satt på pause. Kalenderdeling er gratis. Betalingskoden er bevart; se BETALING.md før en senere aktivering.');
  process.exit(1);
}

const useVercel=process.argv.includes('--vercel');
const deploy=process.argv.includes('--deploy');
const cliEnv={...process.env,npm_config_cache:path.join(tmpdir(),'luke-npm-cache')};
function vercel(args,options={}) {
  return spawnSync('npx',['--yes','vercel',...args],{env:cliEnv,stdio:'inherit',...options});
}
if(useVercel) {
  const who=vercel(['whoami'],{stdio:'ignore'});
  if(who.status!==0 && vercel(['login']).status!==0) throw new Error('Logg inn på Vercel og kjør oppsettet igjen.');
  try {await access('.vercel/project.json');}
  catch {
    console.log('Velg det eksisterende Luke-prosjektet på Vercel. Ikke opprett et nytt prosjekt.');
    if(vercel(['link']).status!==0) throw new Error('Prosjektet kunne ikke kobles til Vercel.');
  }
}
let envText='';
try {envText=await readFile('.env.local','utf8');} catch {}
const saved=Object.fromEntries(envText.split(/\r?\n/).flatMap(line=>{
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);return m ? [[m[1],m[2].replace(/^['"]|['"]$/g,'')]] : [];
}));
let hidden=false;
const output=new Writable({write(chunk,encoding,done){if(!hidden) process.stdout.write(chunk);done();}});
const terminal=createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
async function ask(name,prompt,secret=false) {
  if(process.env[name] || saved[name]) {console.log(`${name}: bruker nøkkelen som allerede er lagret.`);return process.env[name] || saved[name];}
  process.stdout.write(prompt+' ');hidden=secret;
  try {return (await terminal.question('')).trim();}
  finally {hidden=false;if(secret) process.stdout.write('\n');}
}
function save(values) {
  for(const [name,value] of Object.entries(values)) {
    const line=`${name}=${JSON.stringify(value)}`;
    const pattern=new RegExp(`^${name}=.*$`,'gm');
    envText=pattern.test(envText) ? envText.replace(pattern,()=>line) : envText.trimEnd()+'\n'+line+'\n';
    saved[name]=value;
  }
  return writeFile('.env.local',envText,{mode:0o600}).then(()=>chmod('.env.local',0o600));
}
try {
  console.log('Bruk testnøkler først hvis Stripe-oppsettet ikke er prøvd ennå. Ingen betaling gjennomføres av dette oppsettet.');
  const sk=await ask('STRIPE_SECRET_KEY','Stripe secret/restricted key (sk_/rk_ test eller live):',true);
  const pk=await ask('STRIPE_PUBLISHABLE_KEY','Stripe publishable key (pk_test_… eller pk_live_…):');
  const mode=sk.match(/^(?:sk|rk)_(test|live)_/)?.[1];
  if(!mode || !pk.startsWith(`pk_${mode}_`)) throw new Error('Stripe-nøklene må komme fra samme modus: test eller live.');
  const serviceKey=await ask('SUPABASE_SERVICE_ROLE_KEY','Supabase secret/service_role key (skjult):',true);
  let serviceRole=serviceKey.startsWith('sb_secret_');
  if(!serviceRole) {try {serviceRole=JSON.parse(Buffer.from(serviceKey.split('.')[1],'base64url').toString()).role==='service_role';} catch {}}
  if(!serviceRole) throw new Error('Bruk Supabase secret key eller service_role-nøkkelen, ikke publishable/anon-nøkkelen.');
  const origin=new URL(process.env.LUKE_APP_URL || saved.LUKE_APP_URL || 'https://luke-kalender.vercel.app').origin;
  if(!origin.startsWith('https://')) throw new Error('Betalingsadressen må bruke HTTPS.');
  const stripe=new Stripe(sk,{maxNetworkRetries:2,timeout:15000});
  const account=await stripe.accounts.retrieve();
  console.log(`Stripe-nøkkelen er kontrollert (${mode==='test' ? 'testmodus' : 'live'}).`);
  if(mode==='live' && !account.charges_enabled) console.log('Stripe-kontoen er ikke åpnet for ekte betalinger ennå. Fullfør kontoopplysningene i Stripe før lansering.');
  const endpointUrl=`${origin}/api/stripe/webhook`;
  const events=['checkout.session.completed','checkout.session.async_payment_succeeded','charge.refunded'];
  const endpoints=await stripe.webhookEndpoints.list({limit:100});
  const existing=endpoints.data.find(endpoint=>endpoint.url===endpointUrl);
  let signingSecret;
  if(existing) {
    signingSecret=await ask('STRIPE_WEBHOOK_SECRET','Eksisterende webhook signing secret (whsec_…, skjult):',true);
    if(!signingSecret.startsWith('whsec_')) throw new Error('Webhook-nøkkelen mangler. Finn den på Stripe-endepunktet for Luke.');
    await stripe.webhookEndpoints.update(existing.id,{enabled_events:events});
  } else {
    const endpoint=await stripe.webhookEndpoints.create({url:endpointUrl,enabled_events:events,api_version:Stripe.API_VERSION,description:'Luke: betalt kalenderdeling'});
    signingSecret=endpoint.secret;
    if(!signingSecret) throw new Error('Stripe returnerte ingen webhook-nøkkel.');
  }
  // Save immediately, so retries do not lose the one-time webhook signing secret.
  const values={STRIPE_SECRET_KEY:sk,STRIPE_PUBLISHABLE_KEY:pk,STRIPE_WEBHOOK_SECRET:signingSecret,SUPABASE_SERVICE_ROLE_KEY:serviceKey,LUKE_APP_URL:origin};
  await save(values);
  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || saved.NEXT_PUBLIC_SUPABASE_URL || publicCloudConfig.url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error:modeError}=await supabase.rpc('configure_luke_billing',{p_livemode:mode==='live'});
  if(modeError) throw new Error('Supabase kunne ikke velge betalingsmodus. Kjør betalings-SQL-filen i prosjektet og prøv igjen.');
  console.log('Betalingsvarsler er koblet til Luke. Nøklene er lagret lokalt i den ignorerte .env.local-filen.');
  const hostname=new URL(origin).hostname;
  const domains=await stripe.paymentMethodDomains.list({domain_name:hostname,limit:10});
  if(!domains.data.length) await stripe.paymentMethodDomains.create({domain_name:hostname});
  console.log('Betalingsdomenet er registrert hos Stripe.');
  terminal.close();
  if(useVercel) {
    for(const [name,value] of Object.entries(values)) {
      const secret=name==='STRIPE_SECRET_KEY' || name==='STRIPE_WEBHOOK_SECRET' || name==='SUPABASE_SERVICE_ROLE_KEY';
      const result=vercel(['env','add',name,'production','--force',...(secret ? ['--sensitive'] : [])],{input:value+'\n',stdio:['pipe','ignore','pipe']});
      if(result.status!==0) throw new Error(`Vercel kunne ikke lagre ${name}. Nøklene er bevart lokalt; kjør oppsettet på nytt.`);
      console.log(`${name} er lagret på Vercel.`);
    }
    if(deploy && vercel(['deploy','--prod','--yes']).status!==0) throw new Error('Vercel kunne ikke publisere. Innstillingene er lagret; prøv publiseringen igjen.');
  }
  console.log(mode==='test' ? 'Testoppsettet er klart. Bruk Stripe-testkort 4242 4242 4242 4242 i appen; ingen ekte penger trekkes.' : 'Live-nøklene er konfigurert. Testkjøp kan ikke brukes til ny deling i live-modus. Kontroller én ekte betaling og at kjøpet blir stående etter at delingsvinduet lukkes.');
} catch(error) {
  // Never echo an API error object; it can include request headers or key data.
  console.error(error instanceof Stripe.errors.StripeError ? 'Stripe avviste oppsettet. Kontroller nøkkel, konto og tilgang, og prøv igjen.' : error.message);
  process.exitCode=1;
} finally {terminal.close();}
