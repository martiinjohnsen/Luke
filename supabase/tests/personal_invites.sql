begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('8b000000-0000-4000-8000-000000000001','owner@example.invalid','{"name":"Eier"}'),
 ('8b000000-0000-4000-8000-000000000002','friend@example.invalid','{"name":"Mottaker"}'),
 ('8b000000-0000-4000-8000-000000000003','wrong@example.invalid','{"name":"Annen","email":"friend@example.invalid","email_verified":true}'),
 ('8b000000-0000-4000-8000-000000000004','friend@example.invalid','{"name":"Ny konto"}');
insert into public.luke_calendars(id,owner_id,document) values('personal-calendar','8b000000-0000-4000-8000-000000000001',
 jsonb_build_object('id','personal-calendar','title','Privat julekalender','year',2020,'doors',
  (select jsonb_agg(jsonb_build_object('day',day,'kind','message','title','','body','Hei')||case when day=1 then
   jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('title','Riktig?','options',jsonb_build_array('Ja','Nei'),'answerIndex',0,'explanation','Forklaring'))) else '{}' end order by day) from generate_series(1,24)day)));
create temporary table invite_vars(k text primary key,v text);grant all on invite_vars to authenticated;
set local role anon;
do $$ begin
 assert not has_function_privilege('anon','public.create_luke_personal_invite(text,text)','EXECUTE');
 assert not has_table_privilege('anon','public.luke_personal_invites','SELECT');
 begin perform public.accept_luke_invite(repeat('a',64));raise exception 'Anonymous acceptance allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);
insert into invite_vars values('personal',public.create_luke_personal_invite('personal-calendar',' Friend@Example.invalid ')),('legacy',public.create_luke_invite('personal-calendar'));
do $$ begin
 assert public.luke_media_ready()>=5;
 assert public.create_luke_personal_invite('personal-calendar','friend@example.invalid')=(select v from invite_vars where k='personal'),'Retry replaced a valid invitation';
 assert (select email from public.luke_personal_invites where calendar_id='personal-calendar')='friend@example.invalid';
 assert not has_table_privilege('authenticated','public.luke_personal_invites','UPDATE');
 begin perform public.create_luke_personal_invite('personal-calendar','one@example.invalid,two@example.invalid');raise exception 'Multiple recipients allowed';exception when raise_exception then if sqlerrm='Multiple recipients allowed' then raise;end if;end;
 begin perform public.create_luke_personal_invite('personal-calendar',E'one@example.invalid\nBcc: two@example.invalid');raise exception 'Header injection allowed';exception when raise_exception then if sqlerrm='Header injection allowed' then raise;end if;end;
 begin perform public.create_luke_personal_invite('personal-calendar','one@example.invalid?cc=two');raise exception 'Invalid email domain accepted';exception when raise_exception then if sqlerrm='Invalid email domain accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000003',true);
do $$ begin
 assert (select count(*) from public.luke_personal_invites)=0,'Recipients can list private invitations';
 begin perform public.create_luke_personal_invite('personal-calendar','friend@example.invalid');raise exception 'Nonowner created invitation';exception when insufficient_privilege then null;end;
 begin perform public.accept_luke_invite((select v from invite_vars where k='personal'));raise exception 'Forwarded invitation accepted by wrong email';exception when insufficient_privilege then null;end;
 assert jsonb_array_length(public.get_luke_workspace()->'data'->'calendars')=0;
 -- Existing invitations deliberately keep their prior behavior and exact token.
 perform public.accept_luke_invite((select v from invite_vars where k='legacy'));
end $$;
reset role;
update auth.users set email_confirmed_at=null where id='8b000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.accept_luke_invite((select v from invite_vars where k='personal'));raise exception 'Unverified email claimed calendar';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='8b000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 assert public.accept_luke_invite((select v from invite_vars where k='personal'))='personal-calendar';
 assert public.accept_luke_invite((select v from invite_vars where k='personal'))='personal-calendar','Repeat acceptance failed';
 perform public.open_luke_door('personal-calendar',1);
 r:=public.submit_luke_answer('personal-calendar',1,0,'{"answers":[1]}');assert r->'attempt'->'result'->>'correct'='false';
 r:=public.get_luke_participants('personal-calendar');assert jsonb_array_length(r->'participants')=2;
 assert not r::text like '%@%' and not (r->'participants'->0 ? 'email'),'Contact details exposed to peer recipients';
 assert (select count(*) from public.luke_personal_invites)=0;
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.accept_luke_invite((select v from invite_vars where k='personal'));raise exception 'Second account took a claimed invitation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb;begin
 r:=public.get_luke_participants('personal-calendar');
 assert r::text like '%friend@example.invalid%' and r::text like '%wrong@example.invalid%','Owner missing recipient contact details';
 perform public.remove_luke_participant('personal-calendar','8b000000-0000-4000-8000-000000000002');
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 assert public.accept_luke_invite((select v from invite_vars where k='personal'))='personal-calendar';
 assert public.get_luke_workspace()->'progress'->'personal-calendar'->'opened'='[1]','Personal rejoin reset progress';
 r:=public.submit_luke_answer('personal-calendar',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','Personal rejoin reset first attempt';
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);
select public.stop_luke_sharing('personal-calendar');
do $$ begin assert (select count(*) from public.luke_personal_invites)=0;end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000002',true);
do $$ begin
 assert jsonb_array_length(public.get_luke_workspace()->'data'->'calendars')=0;
 begin perform public.accept_luke_invite((select v from invite_vars where k='personal'));raise exception 'Stopped personal invitation accepted';exception when raise_exception then if sqlerrm='Stopped personal invitation accepted' then raise;end if;end;
 begin perform public.accept_luke_invite((select v from invite_vars where k='legacy'));raise exception 'Stopped legacy invitation accepted';exception when raise_exception then if sqlerrm='Stopped legacy invitation accepted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);
insert into invite_vars values('new-personal',public.create_luke_personal_invite('personal-calendar','friend@example.invalid'));
do $$ begin assert (select v from invite_vars where k='new-personal')<>(select v from invite_vars where k='personal');end $$;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 perform public.accept_luke_invite((select v from invite_vars where k='new-personal'));
 assert public.get_luke_workspace()->'progress'->'personal-calendar'->'opened'='[1]';
 r:=public.submit_luke_answer('personal-calendar',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','A new token reset quiz attempts';
end $$;
reset role;
rollback;
select 'PASS: email-bound invitations, verified account checks, one-account claims, owner-only contacts, legacy token compatibility, revocation, and unchanged progress/first attempts after new invitations.' as result;
