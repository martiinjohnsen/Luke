begin;
do $$ begin
 assert (select snapshot from free_upgrade_state)=(select snapshot from free_upgrade_before),'Free restoration changed saved calendars, invitations, progress or purchases';
 assert public.luke_free_sharing_ready()=1;
 assert not has_function_privilege('anon','public.create_luke_invitation_batch(text,jsonb,text,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','public.create_luke_invite(text)','EXECUTE'),'Unrestricted legacy factory was reopened';
 assert not has_table_privilege('authenticated','public.luke_share_orders','UPDATE');
 assert not has_function_privilege('authenticated','public.complete_luke_share_order(uuid,text,uuid,text,text,integer,text,boolean,text)','EXECUTE');
end $$;
set local role anon;
do $$ begin
 assert public.luke_free_sharing_ready()=1;
 begin perform public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000002');raise exception 'Anonymous invitation allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000001',true);
insert into free_vars values
 ('free-person',public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000002')->>'token'),
 ('free-group',public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid","two-free@example.invalid"]','group','fc100000-0000-4000-8000-000000000003')->>'token');
do $$ begin
 assert public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000002')->>'token'=(select v from free_vars where k='free-person'),'Retry changed the free invitation';
 assert jsonb_array_length(public.get_luke_invitations('free-calendar'))=2;
 begin perform public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid","two-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000004');raise exception 'Person accepted multiple recipients';exception when raise_exception then if sqlerrm='Person accepted multiple recipients' then raise;end if;end;
 begin perform public.create_luke_invitation_batch('free-calendar',(select jsonb_agg(n||'@example.invalid') from generate_series(1,51)n),'group','fc100000-0000-4000-8000-000000000004');raise exception 'Recipient limit removed';exception when raise_exception then if sqlerrm='Recipient limit removed' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.create_luke_invitation_batch('free-calendar','["outsider-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000004');raise exception 'Nonowner invited';exception when insufficient_privilege then null;end;
 begin perform public.accept_luke_invite((select v from free_vars where k='free-group'));raise exception 'Forwarded group allowed outsider';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb; begin
 perform public.accept_luke_invite((select v from free_vars where k='legacy'));
 perform public.accept_luke_invite((select v from free_vars where k='old-group'));
 perform public.accept_luke_invite((select v from free_vars where k='free-person'));
 perform public.accept_luke_invite((select v from free_vars where k='free-group'));
 assert public.get_luke_workspace()->'progress'->'free-calendar'->'opened'='[1]','Old opened doors were lost';
 r:=public.submit_luke_answer('free-calendar',1,0,'{"answers":[0]}');
 assert r->'attempt'->'result'->>'correct'='false','Free restoration reset the first quiz attempt';
end $$;
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000003',true);
select public.accept_luke_invite((select v from free_vars where k='paid-token'));
select set_config('request.jwt.claim.sub','fc000000-0000-4000-8000-000000000001',true);
select public.revoke_luke_invitation('free-calendar','one-free@example.invalid');
do $$ begin
 begin perform public.create_luke_invitation_batch('free-calendar','["one-free@example.invalid"]','person','fc100000-0000-4000-8000-000000000002');raise exception 'Retry restored a revoked invitation';exception when invalid_parameter_value then null;end;
end $$;
reset role;
do $$ begin
 assert (select jsonb_agg(to_jsonb(t) order by id) from public.luke_share_orders t)=(select snapshot->'orders' from free_upgrade_before),'Free sharing created or consumed a purchase';
end $$;
rollback;
select 'PASS: free person/group sharing restored; owner checks, allowlists, retries and revocation retained; calendars, old/paid invitations, purchases and quiz progress preserved.' as result;
