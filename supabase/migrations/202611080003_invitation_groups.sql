-- Invitation groups, owner invitation list and independent revocation. Progress is retained.
begin;
create table if not exists public.luke_invitation_batches (
  id uuid primary key,
  calendar_id text not null references public.luke_calendars(id) on delete cascade,
  kind text not null check(kind in ('person','group')),
  token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),
  original_emails jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.luke_invitation_recipients (
  batch_id uuid not null references public.luke_invitation_batches(id) on delete cascade,
  email text not null check(length(email) between 3 and 254),
  claimed_by uuid references auth.users(id) on delete cascade,
  primary key(batch_id,email)
);
create table if not exists public.luke_invite_revocations (
  calendar_id text not null references public.luke_calendars(id) on delete cascade,
  email text not null,
  user_ids uuid[] not null default '{}',
  primary key(calendar_id,email)
);
alter table public.luke_invitation_batches enable row level security;
alter table public.luke_invitation_recipients enable row level security;
alter table public.luke_invite_revocations enable row level security;
revoke all on public.luke_invitation_batches,public.luke_invitation_recipients,public.luke_invite_revocations from public,anon,authenticated;

create or replace function public.luke_invitation_changed(p_calendar_id text) returns void
language sql security definer set search_path='' as $$
  insert into public.luke_updates(calendar_id,owner_id,revision,updated_at)
    select id,owner_id,revision,clock_timestamp() from public.luke_calendars where id=p_calendar_id
    on conflict(calendar_id) do update set updated_at=excluded.updated_at;
$$;
-- Only an explicit new invitation lifts a previous revocation. Removing a
-- participant does not create a revocation or change any invitation token.
create or replace function public.luke_allow_invitation(p_calendar_id text,p_email text) returns void
language sql security definer set search_path='' as $$
  delete from public.luke_invite_revocations r where r.calendar_id=p_calendar_id and
    (r.email=p_email or r.user_ids && array(select u.id from auth.users u where lower(trim(u.email))=p_email));
$$;
create or replace function public.create_luke_personal_invite(p_calendar_id text,p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); address text:=lower(trim(p_email)); result text;
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan invitere mottakere.' using errcode='42501'; end if;
  if address is null or length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
    or split_part(address,'@',2) !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'Skriv én gyldig e-postadresse.'; end if;
  perform public.luke_allow_invitation(p_calendar_id,address);
  insert into public.luke_personal_invites(calendar_id,email) values(p_calendar_id,address) on conflict do nothing;
  select token into result from public.luke_personal_invites where calendar_id=p_calendar_id and email=address;
  perform public.luke_invitation_changed(p_calendar_id);
  return result;
end $$;
create or replace function public.create_luke_invitation_batch(p_calendar_id text,p_emails jsonb,p_kind text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); addresses jsonb; address text; batch public.luke_invitation_batches; current_emails jsonb;
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan invitere mottakere.' using errcode='42501'; end if;
  if p_request_id is null or p_kind is null or p_kind not in ('person','group') or jsonb_typeof(p_emails) is distinct from 'array'
    or jsonb_array_length(p_emails) not between 1 and 50 then raise exception 'Velg mellom 1 og 50 gyldige e-postadresser.'; end if;
  if exists(select 1 from jsonb_array_elements(p_emails) e where jsonb_typeof(e)<>'string') then raise exception 'Ugyldig e-postadresse.'; end if;
  select jsonb_agg(a order by a) into addresses from (select distinct lower(trim(value)) a from jsonb_array_elements_text(p_emails)) s;
  if (p_kind='person' and jsonb_array_length(addresses)<>1) or (p_kind='group' and jsonb_array_length(addresses)<2) then
    raise exception 'Enkeltperson krever én adresse. Gruppe krever minst to.'; end if;
  for address in select value from jsonb_array_elements_text(addresses) loop
    if length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
      or split_part(address,'@',2) !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then raise exception 'Skriv gyldige e-postadresser.'; end if;
  end loop;
  select * into batch from public.luke_invitation_batches where id=p_request_id for update;
  if found then
    if batch.calendar_id<>p_calendar_id or batch.kind<>p_kind or batch.original_emails<>addresses then
      raise exception 'Invitasjonen er endret. Åpne delingen på nytt.' using errcode='22023'; end if;
    select coalesce(jsonb_agg(email order by email),'[]') into current_emails from public.luke_invitation_recipients where batch_id=batch.id;
    if current_emails<>addresses then raise exception 'En invitasjon er trukket tilbake. Åpne delingen på nytt.' using errcode='22023'; end if;
  else
    insert into public.luke_invitation_batches(id,calendar_id,kind,original_emails) values(p_request_id,p_calendar_id,p_kind,addresses) returning * into batch;
    for address in select value from jsonb_array_elements_text(addresses) loop
      perform public.luke_allow_invitation(p_calendar_id,address);
      insert into public.luke_invitation_recipients(batch_id,email) values(batch.id,address);
    end loop;
    perform public.luke_invitation_changed(p_calendar_id);
  end if;
  return jsonb_build_object('token',batch.token,'emails',addresses,'kind',batch.kind);
end $$;
create or replace function public.get_luke_invitations(p_calendar_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); result jsonb;
begin
  if not exists(select 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid) then
    raise exception 'Bare avsender kan se invitasjonene.' using errcode='42501'; end if;
  with invitations as (
    select email,claimed_by,created_at,'person'::text kind from public.luke_personal_invites where calendar_id=p_calendar_id
    union all
    select r.email,r.claimed_by,b.created_at,b.kind from public.luke_invitation_recipients r join public.luke_invitation_batches b on b.id=r.batch_id where b.calendar_id=p_calendar_id
  ), grouped as (
    select i.email,min(i.created_at) created_at,jsonb_agg(distinct i.kind) kinds,bool_or(i.claimed_by is not null) accepted,
      bool_or(exists(select 1 from public.luke_members m join auth.users u on u.id=m.user_id where m.calendar_id=p_calendar_id
        and (m.user_id=i.claimed_by or lower(trim(u.email))=i.email))) has_access
    from invitations i group by i.email
  ) select coalesce(jsonb_agg(jsonb_build_object('email',email,'createdAt',created_at,'kinds',kinds,'accepted',accepted,'hasAccess',has_access) order by created_at,email),'[]') into result from grouped;
  return result;
end $$;
create or replace function public.revoke_luke_invitation(p_calendar_id text,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); address text:=lower(trim(p_email)); ids uuid[];
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan trekke tilbake invitasjoner.' using errcode='42501'; end if;
  if address is null or length(address) not between 3 and 254 then raise exception 'Ugyldig e-postadresse.'; end if;
  select array_agg(distinct id) filter(where id is not null) into ids from (
    select claimed_by id from public.luke_personal_invites where calendar_id=p_calendar_id and email=address
    union all select r.claimed_by from public.luke_invitation_recipients r join public.luke_invitation_batches b on b.id=r.batch_id where b.calendar_id=p_calendar_id and r.email=address
    union all select id from auth.users where lower(trim(email))=address
    union all select unnest(user_ids) from public.luke_invite_revocations where calendar_id=p_calendar_id and email=address
  ) s;
  insert into public.luke_invite_revocations(calendar_id,email,user_ids) values(p_calendar_id,address,coalesce(ids,'{}'))
    on conflict(calendar_id,email) do update set user_ids=excluded.user_ids;
  delete from public.luke_personal_invites where calendar_id=p_calendar_id and email=address;
  delete from public.luke_invitation_recipients r using public.luke_invitation_batches b where r.batch_id=b.id and b.calendar_id=p_calendar_id and r.email=address;
  -- Retain empty batch IDs as retry tombstones: a delayed retry must not restore
  -- a revoked recipient. Stop sharing removes the batches, not progress.
  delete from public.luke_members where calendar_id=p_calendar_id and user_id=any(coalesce(ids,'{}'));
  perform public.luke_invitation_changed(p_calendar_id);
end $$;
create or replace function public.accept_luke_invite(p_token text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); ident text; owner uuid; invitation public.luke_personal_invites;
  batch public.luke_invitation_batches; recipient public.luke_invitation_recipients; account_email text; verified boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
  select calendar_id into ident from public.luke_personal_invites where token=p_token
    union all select calendar_id from public.luke_invitation_batches where token=p_token
    union all select calendar_id from public.luke_invites where token=p_token limit 1;
  if ident is null then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
  select owner_id into owner from public.luke_calendars where id=ident for update;
  select lower(trim(email)),email_confirmed_at is not null into account_email,verified from auth.users where id=uid;
  if exists(select 1 from public.luke_invite_revocations where calendar_id=ident and (email=account_email or uid=any(user_ids))) then
    raise exception 'Invitasjonen din er trukket tilbake. Be avsenderen om en ny invitasjon.' using errcode='42501'; end if;
  select * into invitation from public.luke_personal_invites where token=p_token for update;
  if found then
    if not coalesce(verified,false) or account_email is distinct from invitation.email then
      raise exception 'Invitasjonen gjelder en annen e-postadresse. Logg inn med kontoen den ble sendt til.' using errcode='42501'; end if;
    if invitation.claimed_by is not null and invitation.claimed_by<>uid then
      raise exception 'Invitasjonen er allerede knyttet til en annen konto.' using errcode='42501'; end if;
    update public.luke_personal_invites set claimed_by=uid where token=p_token;
  else
    select * into batch from public.luke_invitation_batches where token=p_token and calendar_id=ident for update;
    if found then
      select * into recipient from public.luke_invitation_recipients where batch_id=batch.id and email=account_email for update;
      if not found or not coalesce(verified,false) then
        raise exception 'Invitasjonen gjelder en annen e-postadresse, eller er trukket tilbake.' using errcode='42501'; end if;
      if recipient.claimed_by is not null and recipient.claimed_by<>uid then
        raise exception 'Invitasjonen er allerede knyttet til en annen konto.' using errcode='42501'; end if;
      update public.luke_invitation_recipients set claimed_by=uid where batch_id=batch.id and email=account_email;
    else
      perform 1 from public.luke_invites where token=p_token and calendar_id=ident for update;
      if not found then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
    end if;
  end if;
  if owner<>uid then insert into public.luke_members(calendar_id,user_id) values(ident,uid) on conflict do nothing; end if;
  perform public.luke_invitation_changed(ident);
  return ident;
end $$;
create or replace function public.stop_luke_sharing(p_calendar_id text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user();
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
  delete from public.luke_invitation_batches where calendar_id=p_calendar_id;
  delete from public.luke_personal_invites where calendar_id=p_calendar_id;
  delete from public.luke_invites where calendar_id=p_calendar_id;
  delete from public.luke_members where calendar_id=p_calendar_id;
  perform public.luke_invitation_changed(p_calendar_id);
end $$;
revoke all on function public.luke_invitation_changed(text),public.luke_allow_invitation(text,text),
  public.create_luke_invitation_batch(text,jsonb,text,uuid),public.get_luke_invitations(text),public.revoke_luke_invitation(text,text) from public,anon,authenticated;
grant execute on function public.create_luke_invitation_batch(text,jsonb,text,uuid),public.get_luke_invitations(text),public.revoke_luke_invitation(text,text) to authenticated;
create or replace function public.luke_media_ready() returns integer language sql stable set search_path='' as $$ select 6 $$;
commit;
