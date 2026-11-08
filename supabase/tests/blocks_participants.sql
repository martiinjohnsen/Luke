begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('8a000000-0000-4000-8000-000000000001','owner@example.invalid','{"name":"Avsender"}'),
 ('8a000000-0000-4000-8000-000000000002','first@example.invalid','{"name":"Gammelt navn"}'),
 ('8a000000-0000-4000-8000-000000000003','second@example.invalid','{"name":"Mottaker to"}'),
 ('8a000000-0000-4000-8000-000000000004','stranger@example.invalid','{}');
insert into public.luke_profiles(user_id,name) values('8a000000-0000-4000-8000-000000000002','Mottaker en');
create temporary table block_vars(k text primary key,v text);grant all on block_vars to authenticated;
insert into public.luke_calendars(id,owner_id,document)
select id,'8a000000-0000-4000-8000-000000000001',jsonb_build_object('id',id,'title','Kalender','year',year,'doors',
 (select jsonb_agg(jsonb_build_object('day',n,'kind','message','title','','body','Hei')||case when n=1 then
 jsonb_build_object('contentOrder',jsonb_build_array('quiz','image:2','quiz:2','quiz:3'),'questions',jsonb_build_array(jsonb_build_object('title','Opprinnelig','options',jsonb_build_array('Ja','Nei'),'answerIndex',0,'explanation','Root solution')),
 'extra',jsonb_build_object(
 'image:2',jsonb_build_object('day',1,'kind','message','title','','body','','contentOrder',jsonb_build_array('image'),'image',''),
 'quiz:2',jsonb_build_object('day',1,'kind','message','title','','body','','contentOrder',jsonb_build_array('quiz'),'questions',jsonb_build_array(jsonb_build_object('title','Ny flervalg','options',jsonb_build_array('A','B','C'),'answerIndex',1,'correctAnswers',jsonb_build_array(1,2),'explanation','EXTRA-SOLUTION'))),
 'quiz:3',jsonb_build_object('day',1,'kind','message','title','','body','','contentOrder',jsonb_build_array('quiz'),'questions',jsonb_build_array(jsonb_build_object('title','Nytt tekstsvar','type','text','options','[]'::jsonb,'answerIndex',0,'acceptedAnswers',jsonb_build_array('EXTRA-SECRET'),'explanation','TEXT-SOLUTION'))))) else '{}' end order by n) from generate_series(1,24)n))
from (values('blocks-past',2020),('blocks-future',2100)) calendars(id,year);
insert into block_vars select 'original-key',public.luke_question_key(1,0,document->'doors'->0->'questions'->0) from public.luke_calendars where id='blocks-past';
insert into block_vars select 'original-document',document::text from public.luke_calendars where id='blocks-past';
-- Fixtures are private, finalized files in second image slots; one is still in a future door.
insert into public.luke_media(path,calendar_id,user_id,day,scope,mime_type,bytes,uploaded_at)
 select id||'/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg',id,'8a000000-0000-4000-8000-000000000001',1,'door','image/jpeg',500,now() from public.luke_calendars where id like 'blocks-%';
update public.luke_calendars set document=jsonb_set(document,'{doors,0,extra,image:2,image}',to_jsonb('luke-media:'||id||'/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg')) where id like 'blocks-%';
set local role authenticated;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000001',true);
insert into block_vars values('token',public.create_luke_invite('blocks-past')),('future-token',public.create_luke_invite('blocks-future'));
do $$ begin
 assert public.luke_media_ready()>=4;
 assert not has_function_privilege('anon','public.get_luke_participants(text)','EXECUTE');
 assert not has_function_privilege('anon','public.remove_luke_participant(text,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','public.luke_primary_questions(jsonb,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.luke_safe_questions(jsonb,jsonb,integer,integer)','EXECUTE');
 assert not has_function_privilege('authenticated','public.luke_door_media(jsonb)','EXECUTE');
end $$;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000002',true);
select public.accept_luke_invite((select v from block_vars where k='token'));
select public.accept_luke_invite((select v from block_vars where k='future-token'));
do $$ declare w jsonb;c jsonb;r jsonb;begin
 w:=public.get_luke_workspace();select value into c from jsonb_array_elements(w->'data'->'calendars') where value->>'id'='blocks-past';
 assert c->'doors'->0->'questions'->0->'remote'->>'key'=(select v from block_vars where k='original-key'),'Old key changed';
 assert c->'doors'->0->'extra'->'quiz:2'->'questions'->0->'remote'->>'multiple'='true';
 assert c->'doors'->0->'extra'->'quiz:2'->'questions'->0->'remote'->>'key' like '1-1-%';
 assert c->'doors'->0->'extra'->'quiz:3'->'questions'->0->'remote'->>'key' like '1-2-%';
 assert w::text not like '%EXTRA-SOLUTION%' and w::text not like '%EXTRA-SECRET%' and w::text not like '%TEXT-SOLUTION%' and w::text not like '%Root solution%','Extra quiz solution leaked';
 select value into c from jsonb_array_elements(w->'data'->'calendars') where value->>'id'='blocks-future';
 assert not c->'doors'->0 ? 'extra' and not c->'doors'->0 ? 'questions','Future extras leaked';
 assert public.luke_media_can_read('blocks-past/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg'),'Second slot media denied';
 assert not public.luke_media_can_read('blocks-future/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg'),'Future extra media exposed';
 perform public.open_luke_door('blocks-past',1);
 r:=public.submit_luke_answer('blocks-past',1,0,'{"answers":[1]}');assert r->'attempt'->'result'->>'correct'='false';
 r:=public.submit_luke_answer('blocks-past',1,1,'{"answers":[1,2]}');assert r->'attempt'->'result'->>'correct'='true','Second quiz box grading failed';
 perform public.save_luke_greeting('blocks-past',1,'PRIVATE-REPLY',null,null,0);
 begin perform public.remove_luke_participant('blocks-past','8a000000-0000-4000-8000-000000000003');raise exception 'Recipient revoked a peer';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000003',true);
select public.accept_luke_invite((select v from block_vars where k='token'));
do $$ declare r jsonb;begin
 r:=public.get_luke_participants('blocks-past');
 assert jsonb_array_length(r->'participants')=2 and r->>'owner'='false';
 assert r::text like '%Mottaker en%' and r::text like '%Mottaker to%','Profile names missing';
 assert r::text not like '%@%' and r::text not like '%response%' and r::text not like '%EXTRA-SECRET%' and r::text not like '%correctAnswers%' and r::text not like '%PRIVATE-REPLY%';
 assert r->'participants'->0->'summary'->>'total'='3';
 assert r->'participants'->0->'summary'->>'answered'='2';
 assert r->'participants'->0->'summary'->>'correct'='1';
 assert r->'participants'->0->'summary'->'days'='[]' and r->'participants'->0->'opened'='[]','Detailed peer progress exposed';
 assert r::text not like '%8a000000-0000-4000-8000-000000000002%','Peer auth UID exposed';
 assert public.get_luke_greetings()='[]','Peer greeting exposed';
 assert (select count(*) from public.luke_answers)=0,'Raw peer answers exposed';
end $$;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.get_luke_participants('blocks-past');raise exception 'Stranger sees leaderboard';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb;doc jsonb;begin
 r:=public.get_luke_participants('blocks-past');assert r->>'owner'='true';
 assert r->'participants'->0->'opened'='[1]' and r->'participants'->0->'summary'->'days'->0->>'correct'='1','Owner overview lost detail';
 assert (select revision from public.luke_calendars where id='blocks-past')=1,'Participant events changed document revision';
 select document into doc from public.luke_calendars where id='blocks-past';
 doc:=jsonb_set(doc,'{doors,0,contentOrder}','["quiz:3","image:2","quiz:2","quiz"]');
 perform public.save_luke_workspace(jsonb_build_array(jsonb_build_object('document',doc,'expectedRevision',1)),'[]','[]','{"name":"Avsender","snow":true}');
 r:=public.get_luke_participants('blocks-past');assert r->'participants'->0->'summary'->>'correct'='1','Reorder reset score';
 perform public.remove_luke_participant('blocks-past','8a000000-0000-4000-8000-000000000002');
 assert jsonb_array_length(public.get_luke_participants('blocks-past')->'participants')=1,'Removal affected another person';
 assert public.get_luke_greetings()::text like '%PRIVATE-REPLY%','Owner lost historical reply';
end $$;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 assert not public.get_luke_workspace()::text like '%blocks-past%','Removed member keeps calendar';
 begin perform public.get_luke_participants('blocks-past');raise exception 'Removed member sees results';exception when insufficient_privilege then null;end;
 begin perform public.submit_luke_answer('blocks-past',1,0,'{"answers":[0]}');raise exception 'Removed member answers';exception when insufficient_privilege then null;end;
 assert not public.luke_media_can_read('blocks-past/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg');
 perform public.accept_luke_invite((select v from block_vars where k='token'));
 assert public.get_luke_workspace()->'progress'->'blocks-past'->'opened'='[1]','Rejoining lost opened doors';
 r:=public.submit_luke_answer('blocks-past',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','Rejoin allowed retry';
 perform public.save_luke_workspace('[]','[]','["blocks-past"]','{"name":"Mottaker en","snow":true}');
 perform public.accept_luke_invite((select v from block_vars where k='token'));
 r:=public.submit_luke_answer('blocks-past',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','Unfollow/rejoin allowed retry';
 assert public.get_luke_workspace()->'progress'->'blocks-past'->'opened'='[1]';
end $$;
reset role;
do $$ declare doc jsonb;bad jsonb;p jsonb;begin
 select document into doc from public.luke_calendars where id='blocks-past';
 bad:=jsonb_set(doc,'{doors,0,extra,quiz:4}',doc->'doors'->0->'extra'->'quiz:2');
 begin update public.luke_calendars set document=bad where id='blocks-past';raise exception 'Fourth box accepted';exception when raise_exception then if sqlerrm='Fourth box accepted' then raise;end if;end;
 bad:=jsonb_set(doc,'{doors,0,extra,image:2,questions}',doc->'doors'->0->'questions');
 begin update public.luke_calendars set document=bad where id='blocks-past';raise exception 'Hidden quiz accepted';exception when raise_exception then if sqlerrm='Hidden quiz accepted' then raise;end if;end;
 bad:=jsonb_set(doc,'{doors,0,extra,quiz:2,extra}','{}');
 begin update public.luke_calendars set document=bad where id='blocks-past';raise exception 'Nested boxes accepted';exception when raise_exception then if sqlerrm='Nested boxes accepted' then raise;end if;end;
 bad:=jsonb_set(doc,'{doors,0,extra,image:2,image}',to_jsonb('luke-media:blocks-future/door/1/8a000000-0000-4000-8000-000000000001/'||repeat('a',64)||'.jpg'));
 begin update public.luke_calendars set document=bad where id='blocks-past';raise exception 'Cross-calendar media accepted';exception when raise_exception then if sqlerrm='Cross-calendar media accepted' then raise;end if;end;
 p:=jsonb_build_object('opened','[]'::jsonb,'answers',(select jsonb_object_agg(day||'-'||idx||'-abc',jsonb_build_object('answer',0)) from generate_series(1,24)day cross join generate_series(0,95)idx));
 assert (select count(*) from jsonb_object_keys(public.luke_preview_payload(p)->'answers'))=2304,'Expanded preview cannot retain all attempts';
end $$;
rollback;
select 'PASS: independent content slots, unchanged quiz keys, extra-media scoping, future secrecy, permissioned participant summaries, peer privacy, owner revocation and preserved first attempts after removal and unfollow/rejoin.' as result;
