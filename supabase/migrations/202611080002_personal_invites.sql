-- Personal invitations and owner-only contact details. Existing links and progress remain valid.
begin;
create table if not exists public.luke_personal_invites (
  calendar_id text not null references public.luke_calendars(id) on delete cascade,
  email text not null check(length(email) between 3 and 254),
  token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),
  claimed_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(calendar_id,email)
);
alter table public.luke_personal_invites enable row level security;
revoke all on public.luke_personal_invites from public,anon,authenticated;
grant select on public.luke_personal_invites to authenticated;
do $$ begin
if not exists(select 1 from pg_policies where schemaname='public' and tablename='luke_personal_invites' and policyname='owner_personal_invites') then
create policy owner_personal_invites on public.luke_personal_invites for select to authenticated using (
  exists(select 1 from public.luke_calendars c where c.id=calendar_id and c.owner_id=(select auth.uid()))
);
end if;
end $$;
create or replace function public.create_luke_personal_invite(p_calendar_id text,p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); address text:=lower(trim(p_email)); result text;
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan invitere mottakere.' using errcode='42501'; end if;
  if address is null or length(address)>254 or address !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$'
    or split_part(address,'@',2) !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'Skriv én gyldig e-postadresse.'; end if;
  insert into public.luke_personal_invites(calendar_id,email) values(p_calendar_id,address) on conflict(calendar_id,email) do nothing;
  select token into result from public.luke_personal_invites where calendar_id=p_calendar_id and email=address;
  return result;
end $$;
-- Older installed clients retain their existing link, with the same lock order.
create or replace function public.create_luke_invite(p_calendar_id text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); result text;
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Ingen tilgang.' using errcode='42501';end if;
  insert into public.luke_invites(calendar_id) values(p_calendar_id) on conflict do nothing;
  select token into result from public.luke_invites where calendar_id=p_calendar_id;
  return result;
end $$;
create or replace function public.accept_luke_invite(p_token text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); ident text; owner uuid; invitation public.luke_personal_invites;
  account_email text; verified boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
  -- Lock the calendar before its invite, matching create/stop and preventing a
  -- concurrent acceptance from restoring membership after sharing is stopped.
  select calendar_id into ident from public.luke_personal_invites where token=p_token
    union all select calendar_id from public.luke_invites where token=p_token limit 1;
  if ident is null then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
  select owner_id into owner from public.luke_calendars where id=ident for update;
  select * into invitation from public.luke_personal_invites where token=p_token for update;
  if found then
    select lower(trim(email)),email_confirmed_at is not null into account_email,verified from auth.users where id=uid;
    if not coalesce(verified,false) or account_email is distinct from invitation.email then
      raise exception 'Invitasjonen gjelder en annen e-postadresse. Logg inn med kontoen den ble sendt til.' using errcode='42501'; end if;
    if invitation.claimed_by is not null and invitation.claimed_by<>uid then
      raise exception 'Invitasjonen er allerede knyttet til en annen konto.' using errcode='42501'; end if;
    update public.luke_personal_invites set claimed_by=uid where token=p_token;
  else
    -- Preserve pre-existing invitations, without silently changing their tokens.
    perform 1 from public.luke_invites where token=p_token and calendar_id=ident for update;
    if not found then raise exception 'Invitasjonen er ugyldig eller avsluttet.'; end if;
  end if;
  if owner<>uid then insert into public.luke_members(calendar_id,user_id) values(ident,uid) on conflict do nothing; end if;
  return ident;
end $$;
create or replace function public.stop_luke_sharing(p_calendar_id text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user();
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
  delete from public.luke_personal_invites where calendar_id=p_calendar_id;
  delete from public.luke_invites where calendar_id=p_calendar_id;
  delete from public.luke_members where calendar_id=p_calendar_id;
end $$;
create or replace function public.get_luke_participants(p_calendar_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user(); c public.luke_calendars; m record;
  people jsonb:='[]'; days jsonb; total integer; answered integer; correct integer; unlocked integer;
  lim integer; own boolean; opened jsonb;
begin
  select * into c from public.luke_calendars where id=p_calendar_id;
  own:=c.owner_id=uid;
  if c.id is null or not (own or exists(select 1 from public.luke_members where calendar_id=p_calendar_id and user_id=uid)) then
    raise exception 'Ingen tilgang til kalenderen.' using errcode='42501'; end if;
  lim:=public.luke_available_day((c.document->>'year')::integer);
  for m in select membership.user_id,membership.joined_at,u.email,left(coalesce(nullif(trim(p.name),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Mottaker'),60) as name
    from public.luke_members membership join auth.users u on u.id=membership.user_id
    left join public.luke_profiles p on p.user_id=membership.user_id
    where membership.calendar_id=p_calendar_id order by membership.joined_at,membership.user_id loop
    with questions as materialized (
      select (d->>'day')::integer as day,public.luke_question_key((d->>'day')::integer,n::integer-1,q) as key
      from jsonb_array_elements(c.document->'doors') d
      cross join lateral jsonb_array_elements(public.luke_questions(d,c.document)) with ordinality t(q,n)
    ), per_day as (
      select q.day,count(*)::integer as total,count(a.question_key)::integer as answered,
        count(*) filter(where coalesce((a.result->>'correct')::boolean,false))::integer as correct
      from questions q left join public.luke_answers a on a.calendar_id=p_calendar_id and a.user_id=m.user_id
        and a.question_key=q.key and q.day<=lim group by q.day
    ) select coalesce(sum(p.total),0),coalesce(sum(p.answered),0),coalesce(sum(p.correct),0),
      coalesce(sum(p.total) filter(where p.day<=lim),0),
      case when own then coalesce(jsonb_agg(jsonb_build_object('day',p.day,'total',p.total,'answered',p.answered,'correct',p.correct,'locked',p.day>lim) order by p.day),'[]') else '[]'::jsonb end
      into total,answered,correct,unlocked,days from per_day p;
    select coalesce(to_jsonb(p.opened),'[]') into opened from public.luke_progress p where p.calendar_id=p_calendar_id and p.user_id=m.user_id;
    opened:=coalesce(opened,'[]');
    people:=people||jsonb_build_array(jsonb_build_object(
      'id',case when own then m.user_id::text else md5(p_calendar_id||':'||m.user_id::text) end,
      'name',m.name,'self',m.user_id=uid,'joinedAt',m.joined_at,'openedCount',jsonb_array_length(opened),
      'opened',case when own then opened else '[]'::jsonb end,
      'summary',jsonb_build_object('total',total,'answered',answered,'correct',correct,'unlocked',unlocked,'days',days)) || case when own then jsonb_build_object('email',m.email) else '{}'::jsonb end);
  end loop;
  return jsonb_build_object('owner',own,'available',lim,'participants',people);
end $$;
create or replace function public.luke_media_ready() returns integer language sql stable set search_path='' as $$ select 5 $$;
revoke all on function public.create_luke_personal_invite(text,text) from public,anon,authenticated;
grant execute on function public.create_luke_personal_invite(text,text) to authenticated;
commit;
