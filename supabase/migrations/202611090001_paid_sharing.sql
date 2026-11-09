-- Paid invitations are durable purchases, separate from email delivery and progress.
begin;
create table if not exists public.luke_billing_config (
  singleton boolean primary key default true check(singleton),
  livemode boolean not null default false
);
insert into public.luke_billing_config(singleton) values(true) on conflict do nothing;
alter table public.luke_billing_config enable row level security;
revoke all on public.luke_billing_config from public,anon,authenticated;
grant all on public.luke_billing_config to service_role;
create table if not exists public.luke_share_refunds(payment_intent text primary key,received_at timestamptz not null default now());
alter table public.luke_share_refunds enable row level security;
revoke all on public.luke_share_refunds from public,anon,authenticated;
grant all on public.luke_share_refunds to service_role;
create table if not exists public.luke_share_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null references public.luke_calendars(id) on delete cascade,
  kind text not null check(kind in ('person','group')),
  amount integer not null,
  currency text not null default 'nok' check(currency='nok'),
  status text not null default 'pending' check(status in ('pending','paid','expired','refunded')),
  stripe_session_id text unique,
  stripe_payment_intent text unique,
  livemode boolean not null default false,
  emails jsonb,
  message text not null default '' check(length(message)<=1000),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check((kind='person' and amount=1900) or (kind='group' and amount=2900)),
  check(emails is null or jsonb_typeof(emails)='array')
);
create unique index if not exists luke_one_pending_share on public.luke_share_orders(owner_id,calendar_id,kind,livemode) where status='pending';
alter table public.luke_share_orders enable row level security;
revoke all on public.luke_share_orders from public,anon,authenticated;
grant select on public.luke_share_orders to authenticated;
grant all on public.luke_share_orders to service_role;
drop policy if exists luke_own_share_orders on public.luke_share_orders;
create policy luke_own_share_orders on public.luke_share_orders for select to authenticated using(owner_id=auth.uid());

create or replace function public.luke_share_order_json(o public.luke_share_orders) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('id',o.id,'calendarId',o.calendar_id,'kind',o.kind,'amount',o.amount,'status',o.status,
    'sessionId',o.stripe_session_id,'emails',o.emails,'message',o.message,'createdAt',o.created_at);
$$;
create or replace function public.get_luke_share_orders(p_calendar_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); result jsonb;
begin
  if not exists(select 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid) then
    raise exception 'Bare avsender kan se delingskjøp.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(public.luke_share_order_json(o) order by created_at desc),'[]') into result
    from public.luke_share_orders o where calendar_id=p_calendar_id and owner_id=uid
      and livemode=(select b.livemode from public.luke_billing_config b where singleton);
  return result;
end $$;
create or replace function public.begin_luke_share_order(p_calendar_id text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); o public.luke_share_orders;
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan kjøpe deling.' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('person','group') then raise exception 'Velg enkeltperson eller gruppe.'; end if;
  -- Reopening a purchase or two simultaneous clicks must not create another bill.
  select * into o from public.luke_share_orders where calendar_id=p_calendar_id and owner_id=uid and kind=p_kind
    and livemode=(select b.livemode from public.luke_billing_config b where singleton)
    and (status='pending' or (status='paid' and emails is null)) order by (status='paid') desc,created_at limit 1;
  if not found then
    insert into public.luke_share_orders(owner_id,calendar_id,kind,amount,livemode)
      values(uid,p_calendar_id,p_kind,case when p_kind='person' then 1900 else 2900 end,
        (select b.livemode from public.luke_billing_config b where singleton)) returning * into o;
  end if;
  return public.luke_share_order_json(o);
end $$;

-- Only the backend, after talking to Stripe, can attach or settle a checkout.
create or replace function public.configure_luke_billing(p_livemode boolean) returns void
language sql security definer set search_path='' as $$
  update public.luke_billing_config set livemode=p_livemode where singleton;
$$;
create or replace function public.attach_luke_share_checkout(p_order_id uuid,p_session_id text,p_livemode boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.luke_share_orders set stripe_session_id=p_session_id,livemode=p_livemode
    where id=p_order_id and status in ('pending','paid') and (stripe_session_id is null or stripe_session_id=p_session_id)
      and (livemode is null or livemode=p_livemode);
  if not found then raise exception 'Betalingsøkten er endret.'; end if;
end $$;
create or replace function public.complete_luke_share_order(p_order_id uuid,p_session_id text,p_owner_id uuid,p_calendar_id text,
  p_kind text,p_amount integer,p_currency text,p_livemode boolean,p_payment_intent text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.luke_share_orders;
begin
  select * into o from public.luke_share_orders where id=p_order_id for update;
  if not found then raise exception 'Kjøpet finnes ikke.'; end if;
  if o.status not in ('pending','paid','refunded') or o.owner_id is distinct from p_owner_id or o.calendar_id is distinct from p_calendar_id
    or o.kind is distinct from p_kind or o.amount is distinct from p_amount or o.currency is distinct from p_currency
    or p_livemode is null or (o.livemode is not null and o.livemode<>p_livemode)
    or (o.stripe_session_id is not null and o.stripe_session_id<>p_session_id)
    or (o.stripe_payment_intent is not null and o.stripe_payment_intent<>p_payment_intent)
    or p_session_id is null or p_payment_intent is null then raise exception 'Betalingen stemmer ikke med kjøpet.'; end if;
  if o.status='refunded' then return; end if;
  update public.luke_share_orders set status='paid',stripe_session_id=p_session_id,stripe_payment_intent=p_payment_intent,
    livemode=p_livemode,paid_at=coalesce(paid_at,now()) where id=o.id;
  if exists(select 1 from public.luke_share_refunds where payment_intent=p_payment_intent) then
    update public.luke_share_orders set status='refunded' where id=o.id;
  end if;
end $$;
create or replace function public.refund_luke_share_payment(p_payment_intent text) returns void
language plpgsql security definer set search_path='' as $$
begin
  insert into public.luke_share_refunds(payment_intent) values(p_payment_intent) on conflict do nothing;
  update public.luke_share_orders set status='refunded' where stripe_payment_intent=p_payment_intent;
end $$;
create or replace function public.expire_luke_share_order(p_order_id uuid,p_session_id text) returns void
language sql security definer set search_path='' as $$
  update public.luke_share_orders set status='expired' where id=p_order_id and status='pending' and stripe_session_id=p_session_id;
$$;

create or replace function public.create_luke_paid_invitation(p_order_id uuid,p_emails jsonb,p_message text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); o public.luke_share_orders; addresses jsonb; result jsonb;
begin
  -- Match the calendar-first lock order used by invite revocation and deletion.
  perform 1 from public.luke_calendars c join public.luke_share_orders s on s.calendar_id=c.id
    where s.id=p_order_id and c.owner_id=uid and s.owner_id=uid for update of c;
  if not found then raise exception 'Ingen tilgang til dette kjøpet.' using errcode='42501'; end if;
  select * into o from public.luke_share_orders where id=p_order_id for update;
  if o.status<>'paid' then raise exception 'Delingen må betales først.' using errcode='42501'; end if;
  if o.livemode is distinct from (select b.livemode from public.luke_billing_config b where singleton) then
    raise exception 'Dette kjøpet gjelder en annen betalingsmodus.' using errcode='42501'; end if;
  if length(coalesce(p_message,''))>1000 then raise exception 'Hilsenen er for lang.'; end if;
  if jsonb_typeof(p_emails) is distinct from 'array' or jsonb_array_length(p_emails) not between 1 and 50
    or exists(select 1 from jsonb_array_elements(p_emails) e where jsonb_typeof(e)<>'string') then raise exception 'Skriv gyldige e-postadresser.'; end if;
  select jsonb_agg(a order by a) into addresses from (select distinct lower(trim(value)) a from jsonb_array_elements_text(p_emails)) s;
  if o.emails is not null and o.emails<>addresses then
    raise exception 'Dette kjøpet er allerede brukt til andre mottakere. Du kan sende den samme invitasjonen på nytt.' using errcode='42501'; end if;
  -- The order ID is also the invitation request ID: retries reuse the same token.
  result:=public.create_luke_invitation_batch(o.calendar_id,addresses,o.kind,o.id);
  update public.luke_share_orders set emails=addresses,message=trim(coalesce(p_message,'')) where id=o.id;
  return result;
end $$;

-- Keep old tokens readable, but close every old route that created free invites.
revoke execute on function public.create_luke_invite(text),public.create_luke_personal_invite(text,text),
  public.create_luke_invitation_batch(text,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.luke_share_order_json(public.luke_share_orders),public.get_luke_share_orders(text),
  public.begin_luke_share_order(text,text),public.create_luke_paid_invitation(uuid,jsonb,text),
  public.configure_luke_billing(boolean),
  public.refund_luke_share_payment(text),
  public.attach_luke_share_checkout(uuid,text,boolean),
  public.complete_luke_share_order(uuid,text,uuid,text,text,integer,text,boolean,text),
  public.expire_luke_share_order(uuid,text) from public,anon,authenticated;
grant execute on function public.get_luke_share_orders(text),public.begin_luke_share_order(text,text),
  public.create_luke_paid_invitation(uuid,jsonb,text) to authenticated;
grant execute on function public.attach_luke_share_checkout(uuid,text,boolean),
  public.configure_luke_billing(boolean),
  public.refund_luke_share_payment(text),
  public.complete_luke_share_order(uuid,text,uuid,text,text,integer,text,boolean,text),
  public.expire_luke_share_order(uuid,text) to service_role;
create or replace function public.luke_billing_ready() returns integer language sql stable set search_path='' as $$ select 1 $$;
grant execute on function public.luke_billing_ready() to anon,authenticated;
commit;
