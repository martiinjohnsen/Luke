begin;
insert into auth.users(id,email) values
 ('bc000000-0000-4000-8000-000000000001','owner-pay@example.invalid'),
 ('bc000000-0000-4000-8000-000000000002','receiver-pay@example.invalid'),
 ('bc000000-0000-4000-8000-000000000003','other-pay@example.invalid');
insert into public.luke_calendars(id,owner_id,document) values('paid-calendar','bc000000-0000-4000-8000-000000000001',
 jsonb_build_object('id','paid-calendar','title','Betalt kalender','year',2020,'doors',
  (select jsonb_agg(jsonb_build_object('day',day,'kind','message','title','','body','God jul!') order by day) from generate_series(1,24)day)));
create temporary table billing_vars(k text primary key,v text);
grant all on billing_vars to authenticated,service_role;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000001',true);
-- A token from the earlier sharing implementation must keep working after upgrade.
insert into billing_vars values('legacy',public.create_luke_personal_invite('paid-calendar','receiver-pay@example.invalid'));
set local role authenticated;
insert into billing_vars values('single',public.begin_luke_share_order('paid-calendar','person')->>'id');
do $$ declare o jsonb; begin
  assert not has_function_privilege('authenticated','public.create_luke_invite(text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.create_luke_personal_invite(text,text)','EXECUTE');
  assert not has_function_privilege('authenticated','public.create_luke_invitation_batch(text,jsonb,text,uuid)','EXECUTE');
  assert not has_table_privilege('authenticated','public.luke_share_orders','UPDATE');
  assert not has_table_privilege('authenticated','public.luke_share_orders','INSERT');
  assert not has_function_privilege('authenticated','public.attach_luke_share_checkout(uuid,text,boolean)','EXECUTE');
  assert not has_function_privilege('authenticated','public.complete_luke_share_order(uuid,text,uuid,text,text,integer,text,boolean,text)','EXECUTE');
  assert not has_function_privilege('anon','public.begin_luke_share_order(text,text)','EXECUTE');
  assert not has_function_privilege('anon','public.create_luke_paid_invitation(uuid,jsonb,text)','EXECUTE');
  o:=public.begin_luke_share_order('paid-calendar','person');
  assert o->>'id'=(select v from billing_vars where k='single'),'Reopening checkout created another bill';
  assert o->>'amount'='1900' and o->>'status'='pending';
  begin perform public.create_luke_paid_invitation((o->>'id')::uuid,'["receiver-pay@example.invalid"]','Hei');raise exception 'Unpaid invitation accepted';
    exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000003',true);
do $$ begin
  assert (select count(*)=0 from public.luke_share_orders),'Other account could read payment data';
  begin perform public.get_luke_share_orders('paid-calendar');raise exception 'Other account could read purchases';exception when insufficient_privilege then null;end;
  begin perform public.begin_luke_share_order('paid-calendar','person');raise exception 'Other account could purchase on owner calendar';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
select public.attach_luke_share_checkout((select v::uuid from billing_vars where k='single'),'cs_fixture_single',false);
do $$ begin
  begin perform public.complete_luke_share_order((select v::uuid from billing_vars where k='single'),'cs_fixture_single',
    'bc000000-0000-4000-8000-000000000001','paid-calendar','person',2900,'nok',false,'pi_fixture_single');
    raise exception 'Wrong amount settled';exception when raise_exception then if sqlerrm='Wrong amount settled' then raise;end if;end;
end $$;
select public.complete_luke_share_order((select v::uuid from billing_vars where k='single'),'cs_fixture_single',
  'bc000000-0000-4000-8000-000000000001','paid-calendar','person',1900,'nok',false,'pi_fixture_single');
select public.complete_luke_share_order((select v::uuid from billing_vars where k='single'),'cs_fixture_single',
  'bc000000-0000-4000-8000-000000000001','paid-calendar','person',1900,'nok',false,'pi_fixture_single');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000001',true);
do $$ declare o jsonb; begin
  o:=public.begin_luke_share_order('paid-calendar','person');
  assert o->>'id'=(select v from billing_vars where k='single') and o->>'status'='paid','Paid unused purchase was charged again';
  assert o->'emails'='null'::jsonb,'Payment consumed a share before recipients were chosen';
  begin perform public.create_luke_paid_invitation((o->>'id')::uuid,'["bad-address"]','Hi');raise exception 'Bad email consumed purchase';
    exception when raise_exception then if sqlerrm='Bad email consumed purchase' then raise;end if;end;
  begin perform public.create_luke_paid_invitation((o->>'id')::uuid,'["receiver-pay@example.invalid","other-pay@example.invalid"]','Hi');raise exception 'Person purchase allowed group';
    exception when raise_exception then if sqlerrm='Person purchase allowed group' then raise;end if;end;
  assert (public.get_luke_share_orders('paid-calendar')->0->'emails')='null'::jsonb;
end $$;
insert into billing_vars values('token',public.create_luke_paid_invitation((select v::uuid from billing_vars where k='single'),'[" Receiver-Pay@Example.invalid "]',' Hilsen! ')->>'token');
do $$ declare o jsonb; begin
  assert public.create_luke_paid_invitation((select v::uuid from billing_vars where k='single'),'["receiver-pay@example.invalid"]','Ny hilsen')->>'token'=(select v from billing_vars where k='token'),'Retry changed invitation';
  o:=public.get_luke_share_orders('paid-calendar')->0;
  assert o->>'message'='Ny hilsen' and o->'emails'='["receiver-pay@example.invalid"]'::jsonb,'Unsent email could not be recovered';
  begin perform public.create_luke_paid_invitation((o->>'id')::uuid,'["other-pay@example.invalid"]','');raise exception 'Purchase recycled for new recipient';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000002',true);
select public.accept_luke_invite((select v from billing_vars where k='legacy'));
select public.open_luke_door('paid-calendar',1);
do $$ begin
  begin perform public.create_luke_paid_invitation((select v::uuid from billing_vars where k='single'),'["receiver-pay@example.invalid"]','');raise exception 'Recipient spent owner purchase';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000001',true);
select public.remove_luke_participant('paid-calendar','bc000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000002',true);
select public.accept_luke_invite((select v from billing_vars where k='token'));
do $$ begin
  assert public.get_luke_workspace()::text like '%paid-calendar%','Existing calendar was lost';
end $$;
reset role;
do $$ begin
  assert (select 1=any(opened) from public.luke_progress where calendar_id='paid-calendar' and user_id='bc000000-0000-4000-8000-000000000002'),'Progress was reset by payment upgrade';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','bc000000-0000-4000-8000-000000000001',true);
insert into billing_vars values('group',public.begin_luke_share_order('paid-calendar','group')->>'id');
reset role;
set local role service_role;
select public.complete_luke_share_order((select v::uuid from billing_vars where k='group'),'cs_fixture_group',
  'bc000000-0000-4000-8000-000000000001','paid-calendar','group',2900,'nok',false,'pi_fixture_group');
reset role;
set local role authenticated;
do $$ begin
  begin perform public.create_luke_paid_invitation((select v::uuid from billing_vars where k='group'),(select jsonb_agg('person'||n||'@example.invalid') from generate_series(1,51)n),'');raise exception 'Group allowed 51 people';exception when raise_exception then if sqlerrm='Group allowed 51 people' then raise;end if;end;
end $$;
select public.create_luke_paid_invitation((select v::uuid from billing_vars where k='group'),'["receiver-pay@example.invalid","other-pay@example.invalid"]','Hei alle!');
select public.revoke_luke_invitation('paid-calendar','receiver-pay@example.invalid');
do $$ begin
  begin perform public.create_luke_paid_invitation((select v::uuid from billing_vars where k='single'),'["receiver-pay@example.invalid"]','');raise exception 'Retry restored revoked recipient';
    exception when sqlstate '22023' then null; end;
end $$;
reset role;
set local role service_role;
select public.configure_luke_billing(true);
reset role;
set local role authenticated;
do $$ declare o jsonb; begin
  assert not has_function_privilege('authenticated','public.configure_luke_billing(boolean)','EXECUTE');
  assert jsonb_array_length(public.get_luke_share_orders('paid-calendar'))=0,'Test orders were offered as live purchases';
  begin perform public.create_luke_paid_invitation((select v::uuid from billing_vars where k='group'),'["receiver-pay@example.invalid","other-pay@example.invalid"]','');raise exception 'Test order unlocked live sharing';exception when insufficient_privilege then null;end;
  o:=public.begin_luke_share_order('paid-calendar','person');
  assert o->>'status'='pending' and o->>'id'<>(select v from billing_vars where k='single'),'Live mode reused a test purchase';
end $$;
reset role;
set local role service_role;
select public.refund_luke_share_payment('pi_fixture_single');
do $$ begin
  assert (select status='refunded' from public.luke_share_orders where stripe_payment_intent='pi_fixture_single'),'Full refund did not block sharing';
end $$;
select public.refund_luke_share_payment('pi_before_complete');
select public.complete_luke_share_order((select id from public.luke_share_orders where status='pending' and livemode limit 1),'cs_live_fixture',
  'bc000000-0000-4000-8000-000000000001','paid-calendar','person',1900,'nok',true,'pi_before_complete');
select public.complete_luke_share_order((select id from public.luke_share_orders where stripe_payment_intent='pi_before_complete'),'cs_live_fixture',
  'bc000000-0000-4000-8000-000000000001','paid-calendar','person',1900,'nok',true,'pi_before_complete');
do $$ begin
  assert (select status='refunded' from public.luke_share_orders where stripe_payment_intent='pi_before_complete'),'Late paid webhook restored a refunded purchase';
end $$;
reset role;
rollback;
select 'Paid sharing: permissions, exact prices, durable purchases, retries, recipient limits and old progress OK' as result;
