-- Fixtures created under the paid schema, before restoring free permissions.
insert into auth.users(id,email) values
 ('fc000000-0000-4000-8000-000000000001','owner-free@example.invalid'),
 ('fc000000-0000-4000-8000-000000000002','one-free@example.invalid'),
 ('fc000000-0000-4000-8000-000000000003','two-free@example.invalid'),
 ('fc000000-0000-4000-8000-000000000004','outsider-free@example.invalid');
insert into public.luke_calendars(id,owner_id,document) values('free-calendar','fc000000-0000-4000-8000-000000000001',
 jsonb_build_object('id','free-calendar','title','Eksisterende kalender','year',2020,'doors',
  (select jsonb_agg(jsonb_build_object('day',day,'kind','message','title','','body','God jul!')||case when day=1 then
   jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('title','Riktig?','options',jsonb_build_array('Ja','Nei'),'answerIndex',0))) else '{}' end order by day) from generate_series(1,24)day)));
create temporary table free_vars(k text primary key,v text);
grant all on free_vars to authenticated;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000001',false);
insert into free_vars values
 ('legacy',public.create_luke_personal_invite('free-calendar','one-free@example.invalid')),
 ('old-group',public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid","two-free@example.invalid"]','group','fc100000-0000-4000-8000-000000000001')->>'token'),
 ('paid-order',public.begin_luke_share_order('free-calendar','person')->>'id');
select public.complete_luke_share_order((select v::uuid from free_vars where k='paid-order'),'cs_preserved',
 'fc000000-0000-4000-8000-000000000001','free-calendar','person',1900,'nok',false,'pi_preserved');
insert into free_vars values('paid-token',public.create_luke_paid_invitation((select v::uuid from free_vars where k='paid-order'),'["two-free@example.invalid"]','God jul!')->>'token');
set role authenticated;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000002',false);
select public.accept_luke_invite((select v from free_vars where k='legacy'));
select public.open_luke_door('free-calendar',1);
select public.submit_luke_answer('free-calendar',1,0,'{"answers":[1]}');
reset role;
create temporary view free_upgrade_state as
 select jsonb_build_object(
  'calendars',(select jsonb_agg(to_jsonb(t) order by id) from public.luke_calendars t),
  'members',(select jsonb_agg(to_jsonb(t) order by calendar_id,user_id) from public.luke_members t),
  'progress',(select jsonb_agg(to_jsonb(t) order by calendar_id,user_id) from public.luke_progress t),
  'batches',(select jsonb_agg(to_jsonb(t) order by id) from public.luke_invitation_batches t),
  'recipients',(select jsonb_agg(to_jsonb(t) order by batch_id,email) from public.luke_invitation_recipients t),
  'orders',(select jsonb_agg(to_jsonb(t) order by id) from public.luke_share_orders t)
 ) as snapshot;
create temporary table free_upgrade_before as select snapshot from free_upgrade_state;
