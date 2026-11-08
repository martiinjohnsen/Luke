-- Additional content slots and shared results. No calendar, invite or attempt is replaced.
begin;
create or replace function public.luke_primary_questions(d jsonb,c jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare qs jsonb:='[]';
begin
  if d ? 'questions' then qs:=d->'questions';
  else
    if d ? 'quiz' then qs:=jsonb_build_array((d->'quiz')||jsonb_build_object('title',d->>'title')); end if;
    if coalesce((d->>'showCalendarQuiz')::boolean,false) then qs:=qs||coalesce(c->'quiz'->'questions','[]'); end if;
  end if;
  return coalesce((select jsonb_agg(q order by n) from jsonb_array_elements(qs) with ordinality t(q,n) where public.luke_question_complete(q)),'[]');
end $$;
create or replace function public.luke_questions(d jsonb,c jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select public.luke_primary_questions(d,c)||public.luke_primary_questions(d->'extra'->'quiz:2',c)||public.luke_primary_questions(d->'extra'->'quiz:3',c)
$$;
-- Question indexes follow stable slots, never the draggable visual order.
create or replace function public.luke_safe_questions(d jsonb,c jsonb,p_day integer,p_offset integer) returns jsonb
language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg((q-'correctAnswers'-'acceptedAnswers'-'remote')||jsonb_build_object('answerIndex',0,'explanation','',
    'remote',jsonb_build_object('key',public.luke_question_key(p_day,p_offset+n::integer-1,q),
    'multiple',jsonb_array_length(coalesce(q->'correctAnswers',jsonb_build_array(q->'answerIndex')))>1))||
    case when q->>'type'='text' then jsonb_build_object('acceptedAnswers','[]'::jsonb) else '{}'::jsonb end order by n),'[]')
  from jsonb_array_elements(public.luke_primary_questions(d,c)) with ordinality t(q,n)
$$;
create or replace function public.luke_public_document(c jsonb,p_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d jsonb; ds jsonb:='[]'; e jsonb; ex jsonb; k text; idx integer; lim integer;
begin
  lim:=public.luke_available_day((c->>'year')::integer);
  for d in select value from jsonb_array_elements(c->'doors') loop
    if (d->>'day')::integer>lim then
      ds:=ds||jsonb_build_array(jsonb_build_object('day',(d->>'day')::integer,'kind','message','title','','body',''));
    else
      ex:='{}';
      for k,e in select * from jsonb_each(coalesce(d->'extra','{}')) loop
        idx:=jsonb_array_length(public.luke_primary_questions(d,c));
        if k='quiz:3' then idx:=idx+jsonb_array_length(public.luke_primary_questions(d->'extra'->'quiz:2',c)); end if;
        if k like 'quiz:%' then e:=(e-'quiz'-'showCalendarQuiz'-'questions')||jsonb_build_object('questions',public.luke_safe_questions(e,c,(d->>'day')::integer,idx)); end if;
        ex:=ex||jsonb_build_object(k,e);
      end loop;
      ds:=ds||jsonb_build_array((d-'quiz'-'showCalendarQuiz'-'questions'-'extra')||
        jsonb_build_object('questions',public.luke_safe_questions(d,c,(d->>'day')::integer,0))||
        case when d ? 'extra' then jsonb_build_object('extra',ex) else '{}'::jsonb end);
    end if;
  end loop;
  return (c-'doors'-'quiz'-'remote'-'receivedSourceId')||jsonb_build_object('id',p_id,'access','received','demo',false,'doors',ds,'remote',true,'serverAvailableDay',lim);
end $$;
create or replace function public.luke_door_media(c jsonb) returns table(source text,day integer)
language sql immutable set search_path='' as $$
  select v.source,(d->>'day')::integer from jsonb_array_elements(c->'doors') d
  cross join lateral (select d as payload union all select value from jsonb_each(coalesce(d->'extra','{}'))) p
  cross join lateral (values(p.payload->>'image'),(p.payload->>'audio')) v(source) where v.source like 'luke-media:%'
$$;
create or replace function public.luke_guard_calendar_media() returns trigger
language plpgsql security definer set search_path='' as $$
declare attachment record; d jsonb; k text; e jsonb; allowed text[];
begin
  for d in select value from jsonb_array_elements(new.document->'doors') loop
    if d ? 'extra' then
      if jsonb_typeof(d->'extra') is distinct from 'object' then raise exception 'Ugyldige innholdsbokser.'; end if;
      for k,e in select * from jsonb_each(d->'extra') loop
        if k !~ '^(giftcard|image|audio|video|link|quiz|activity):[23]$' or jsonb_typeof(e) is distinct from 'object'
          or e ? 'extra' or e->>'day' is distinct from d->>'day' or e->>'kind' is distinct from 'message'
          or e->>'title' is distinct from '' or e->>'body' is distinct from ''
          or e->'contentOrder' is distinct from jsonb_build_array(split_part(k,':',1)) then raise exception 'Opptil tre bokser av hver innholdstype er tillatt.'; end if;
        allowed:=array['day','kind','title','body','contentOrder']||case split_part(k,':',1)
          when 'giftcard' then array['giftCard'] when 'image' then array['image','imageAlt'] when 'audio' then array['audio']
          when 'video' then array['videoUrl'] when 'link' then array['link'] when 'quiz' then array['questions'] when 'activity' then array['activity'] end;
        if exists(select 1 from jsonb_object_keys(e) field where not field=any(allowed)) then raise exception 'Ugyldig innholdsboks.'; end if;
        if e ? 'questions' and (jsonb_typeof(e->'questions') is distinct from 'array' or jsonb_array_length(e->'questions')>32) then raise exception 'For mange spørsmål i quizboksen.'; end if;
      end loop;
    end if;
    if d ? 'contentOrder' then
      if jsonb_typeof(d->'contentOrder') is distinct from 'array' or jsonb_array_length(d->'contentOrder')>22
        or exists(select 1 from jsonb_array_elements_text(d->'contentOrder') id where id !~ '^(giftcard|image|audio|video|link|quiz|activity)(:[23])?$|^effect$'
          or (strpos(id,':')>0 and not coalesce(d->'extra','{}') ? id))
        or (select count(distinct id) from jsonb_array_elements_text(d->'contentOrder') id)<>jsonb_array_length(d->'contentOrder') then raise exception 'Ugyldig rekkefølge på innholdsbokser.'; end if;
    end if;
  end loop;
  perform 1 from public.luke_media where path in (select substring(source from 12) from public.luke_door_media(new.document)) order by path for share;
  for attachment in select * from public.luke_door_media(new.document) loop
    if not exists(select 1 from public.luke_media where path=substring(attachment.source from 12) and calendar_id=new.id
      and day=attachment.day and scope='door' and user_id=new.owner_id and uploaded_at is not null and not deleting) then
      raise exception 'Vedlegget er ikke tilgjengelig for denne luka. Legg det til på nytt.'; end if;
  end loop;
  return new;
end $$;
create or replace function public.luke_media_can_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.luke_media a join public.luke_calendars c on c.id=a.calendar_id
    where a.path=p_path and not a.deleting and ((c.owner_id=auth.uid() and (a.scope='door' or exists(
      select 1 from public.luke_greetings g where g.calendar_id=c.id and g.user_id=a.user_id and g.day=a.day
        and (g.image='luke-media:'||a.path or g.audio='luke-media:'||a.path)))) or
      (exists(select 1 from public.luke_members m where m.calendar_id=c.id and m.user_id=auth.uid()) and
       ((a.scope='door' and a.uploaded_at is not null and a.day<=public.luke_available_day((c.document->>'year')::integer) and exists(
         select 1 from public.luke_door_media(c.document) v where v.day=a.day and v.source='luke-media:'||a.path)) or
        (a.scope='reply' and a.user_id=auth.uid())))))
$$;
create or replace function public.luke_preview_payload(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; response jsonb; answers jsonb := '{}'; opened jsonb; choices integer[]; fields integer;
begin
  if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>1200000
    or coalesce(jsonb_typeof(p->'opened'),'')<>'array'
    or coalesce(jsonb_typeof(p->'answers'),'')<>'object' then
    raise exception 'Ugyldig prøvefremdrift.';
  end if;
  if jsonb_array_length(p->'opened')>24 or (select count(*) from jsonb_object_keys(p->'answers'))>2304 then
    raise exception 'For mye prøvefremdrift.';
  end if;
  if exists(select 1 from jsonb_array_elements(p->'opened') n
    where jsonb_typeof(n)<>'number' or n::text !~ '^([1-9]|1[0-9]|2[0-4])$') then
    raise exception 'Ugyldig lukenummer.';
  end if;
  select coalesce(jsonb_agg(n order by n),'[]') into opened
    from (select distinct value::integer n from jsonb_array_elements_text(p->'opened')) ds;
  for k,v in select * from jsonb_each(p->'answers') loop
    if k !~ '^([1-9]|1[0-9]|2[0-4])-[0-9]{1,2}-[a-z0-9]{1,32}$' or jsonb_typeof(v)<>'object' then
      raise exception 'Ugyldig prøvesvar.';
    end if;
    fields := (v ? 'answer')::integer + (v ? 'answers')::integer + (v ? 'text')::integer;
    if fields<>1 then raise exception 'Ugyldig prøvesvar.'; end if;
    if v ? 'text' then
      if jsonb_typeof(v->'text')<>'string' or length(trim(v->>'text'))=0 or length(v->>'text')>300 then
        raise exception 'Skriv et svar på opptil 300 tegn.';
      end if;
      response := jsonb_build_object('text',v->>'text');
    elsif v ? 'answer' then
      if jsonb_typeof(v->'answer')<>'number' or v->>'answer' !~ '^([0-9]|1[01])$' then raise exception 'Ugyldig svaralternativ.'; end if;
      response := jsonb_build_object('answer',v->'answer');
    else
      if jsonb_typeof(v->'answers')<>'array' then raise exception 'Velg et svar.'; end if;
      if jsonb_array_length(v->'answers') not between 1 and 12 or exists (
        select 1 from jsonb_array_elements(v->'answers') n where jsonb_typeof(n)<>'number' or n::text !~ '^([0-9]|1[01])$'
      ) then raise exception 'Ugyldige svaralternativer.'; end if;
      select array_agg(value::integer order by value::integer) into choices from jsonb_array_elements_text(v->'answers');
      if cardinality(choices)<>(select count(distinct n) from unnest(choices) n) then raise exception 'Ugyldige svaralternativer.'; end if;
      response := jsonb_build_object('answers',to_jsonb(choices));
    end if;
    answers := answers || jsonb_build_object(k,response);
  end loop;
  return jsonb_build_object('opened',opened,'answers',answers);
end $$;

create or replace function public.luke_preview(p_calendar_id text,p_action text default 'load',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid := public.luke_require_user(); c jsonb; r public.luke_preview_progress;
  mode text; incoming jsonb; previous jsonb; merged jsonb; opened jsonb; k text; v jsonb; d jsonb; q jsonb; day_num integer; idx integer;
begin
  select document into c from public.luke_calendars where id=p_calendar_id and owner_id=uid;
  if c is null then raise exception 'Bare eieren kan bruke denne forhåndsvisningen.' using errcode='42501'; end if;
  if p_action is null or p_action not in ('load','enable','merge','import') or p_payload is null
    or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>2400000 then raise exception 'Ugyldig forespørsel.'; end if;
  if p_action<>'load' then
    insert into public.luke_preview_progress(calendar_id,user_id) values(p_calendar_id,uid) on conflict do nothing;
    select * into r from public.luke_preview_progress where calendar_id=p_calendar_id and user_id=uid for update;
    if p_action='enable' then
      if coalesce(jsonb_typeof(p_payload->'enabled'),'')<>'boolean' then raise exception 'Velg om fremdriften skal lagres.'; end if;
      update public.luke_preview_progress set enabled=(p_payload->>'enabled')::boolean where calendar_id=p_calendar_id and user_id=uid;
    else
      if p_action='merge' and not r.enabled then raise exception 'Slå på Lagre fremdrift først.'; end if;
      if p_action='merge' and coalesce(p_payload->>'mode','') not in ('test','date') then raise exception 'Ugyldig prøvemodus.'; end if;
      foreach mode in array array['test','date'] loop
        if p_action='merge' and mode<>p_payload->>'mode' then continue; end if;
        incoming := public.luke_preview_payload(case when p_action='import' then p_payload->mode else p_payload->'progress' end);
        if p_action='merge' then
          -- New answers must refer to existing questions. Imports also retain
          -- historical keys for questions edited since the old trial answer.
          if mode='date' and exists(select 1 from jsonb_array_elements_text(incoming->'opened') a
            where a::integer>public.luke_available_day((c->>'year')::integer)) then
            raise exception 'Luken har ikke åpnet ennå.' using errcode='42501';
          end if;
          for k,v in select * from jsonb_each(incoming->'answers') loop
            day_num := split_part(k,'-',1)::integer; idx := split_part(k,'-',2)::integer;
            if mode='date' and day_num>public.luke_available_day((c->>'year')::integer) then raise exception 'Luken har ikke åpnet ennå.' using errcode='42501'; end if;
            select value into d from jsonb_array_elements(c->'doors') where (value->>'day')::integer=day_num;
            q := public.luke_questions(d,c)->idx;
            if q is null then raise exception 'Spørsmålet finnes ikke.'; end if;
            if q->>'type'='text' then
              if not v ? 'text' then raise exception 'Skriv et svar.'; end if;
            else
              if v ? 'text' then raise exception 'Velg et svar.'; end if;
              if exists(select 1 from jsonb_array_elements_text(coalesce(v->'answers',jsonb_build_array(v->'answer'))) a
                where a::integer>=jsonb_array_length(q->'options')) then raise exception 'Ugyldig svaralternativ.'; end if;
            end if;
          end loop;
        end if;
        previous := case when mode='test' then r.test_progress else r.date_progress end;
        select coalesce(jsonb_agg(n order by n),'[]') into opened from (
          select distinct value::integer n from jsonb_array_elements_text((previous->'opened') || (incoming->'opened'))
        ) ds;
        -- Atomic union, with the first stored attempt winning across devices.
        merged := jsonb_build_object('opened',opened,'answers',(incoming->'answers') || (previous->'answers'));
        if mode='test' then r.test_progress := merged; else r.date_progress := merged; end if;
      end loop;
      update public.luke_preview_progress set test_progress=r.test_progress,date_progress=r.date_progress where calendar_id=p_calendar_id and user_id=uid;
    end if;
    update public.luke_preview_progress set revision=revision+1,updated_at=now() where calendar_id=p_calendar_id and user_id=uid;
  end if;
  select * into r from public.luke_preview_progress where calendar_id=p_calendar_id and user_id=uid;
  return jsonb_build_object('initialized',found,'enabled',coalesce(r.enabled,false),'revision',coalesce(r.revision,0),
    'test',coalesce(r.test_progress,'{"opened":[],"answers":{}}'),'date',coalesce(r.date_progress,'{"opened":[],"answers":{}}'));
end $$;
-- Only aggregates are shared with fellow recipients. Answers, email addresses,
-- greeting contents and private owner previews never appear in this endpoint.
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
  for m in select membership.user_id,membership.joined_at,left(coalesce(nullif(trim(p.name),''),nullif(trim(u.raw_user_meta_data->>'name'),''),'Mottaker'),60) as name
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
      'summary',jsonb_build_object('total',total,'answered',answered,'correct',correct,'unlocked',unlocked,'days',days)));
  end loop;
  return jsonb_build_object('owner',own,'available',lim,'participants',people);
end $$;
create or replace function public.remove_luke_participant(p_calendar_id text,p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=public.luke_require_user();
begin
  perform 1 from public.luke_calendars where id=p_calendar_id and owner_id=uid for update;
  if not found then raise exception 'Bare avsender kan fjerne tilgang.' using errcode='42501';end if;
  -- Membership is intentionally independent of stored first attempts/progress.
  delete from public.luke_members where calendar_id=p_calendar_id and user_id=p_user_id;
end $$;
create or replace function public.luke_signal_participants() returns trigger
language plpgsql security definer set search_path='' as $$
declare ident text:=case when tg_op='DELETE' then old.calendar_id else new.calendar_id end;
begin
  insert into public.luke_updates(calendar_id,owner_id,revision,updated_at)
    select id,owner_id,revision,clock_timestamp() from public.luke_calendars where id=ident
    on conflict(calendar_id) do update set updated_at=excluded.updated_at;
  return null;
end $$;
drop trigger if exists luke_member_signal on public.luke_members;
create trigger luke_member_signal after insert or delete on public.luke_members for each row execute function public.luke_signal_participants();
drop trigger if exists luke_progress_signal on public.luke_progress;
create trigger luke_progress_signal after insert or update on public.luke_progress for each row execute function public.luke_signal_participants();
drop trigger if exists luke_answer_signal on public.luke_answers;
create trigger luke_answer_signal after insert on public.luke_answers for each row execute function public.luke_signal_participants();
create or replace function public.luke_media_ready() returns integer language sql stable set search_path='' as $$ select 4 $$;
revoke all on function public.luke_primary_questions(jsonb,jsonb),public.luke_safe_questions(jsonb,jsonb,integer,integer),public.luke_door_media(jsonb),
  public.luke_signal_participants(),public.get_luke_participants(text),public.remove_luke_participant(text,uuid) from public,anon,authenticated;
grant execute on function public.get_luke_participants(text),public.remove_luke_participant(text,uuid) to authenticated;
commit;
