begin;
insert into auth.users(id,email) values
 ('8c000000-0000-4000-8000-000000000001','owner-group@example.invalid'),
 ('8c000000-0000-4000-8000-000000000002','one@example.invalid'),
 ('8c000000-0000-4000-8000-000000000003','two@example.invalid'),
 ('8c000000-0000-4000-8000-000000000004','outsider@example.invalid'),
 ('8c000000-0000-4000-8000-000000000005','one@example.invalid');
insert into public.luke_calendars(id,owner_id,document) values('group-calendar','8c000000-0000-4000-8000-000000000001',
 jsonb_build_object('id','group-calendar','title','Gruppekalender','year',2020,'doors',
  (select jsonb_agg(jsonb_build_object('day',day,'kind','message','title','','body','Hei')||case when day=1 then
   jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('title','Riktig?','options',jsonb_build_array('Ja','Nei'),'answerIndex',0))) else '{}' end order by day) from generate_series(1,24)day)));
create temporary table group_vars(k text primary key,v text);grant all on group_vars to authenticated;
set local role anon;
do $$ begin
 assert not has_function_privilege('anon','public.create_luke_invitation_batch(text,jsonb,text,uuid)','EXECUTE');
 assert not has_function_privilege('anon','public.get_luke_invitations(text)','EXECUTE');
 assert not has_function_privilege('anon','public.revoke_luke_invitation(text,text)','EXECUTE');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000001',true);
insert into group_vars values
 ('group',public.create_luke_invitation_batch('group-calendar','[" One@Example.invalid ","two@example.invalid","one@example.invalid"]','group','8c100000-0000-4000-8000-000000000001')->>'token'),
 ('personal',public.create_luke_personal_invite('group-calendar','one@example.invalid')),
 ('legacy',public.create_luke_invite('group-calendar'));
do $$ declare r jsonb;begin
 assert public.luke_media_ready()>=6;
 assert public.create_luke_invitation_batch('group-calendar','["two@example.invalid","one@example.invalid"]','group','8c100000-0000-4000-8000-000000000001')->>'token'=(select v from group_vars where k='group'),'Retry changed token';
 r:=public.get_luke_invitations('group-calendar');assert jsonb_array_length(r)=2,'List should include unopened invites and deduplicate emails';
 assert not r::text like '%token%' and not r::text like '%8c000000%','Invitation list leaked token or account IDs';
 assert r->0->>'accepted'='false' and r->0->>'hasAccess'='false';
 assert not has_table_privilege('authenticated','public.luke_invitation_batches','SELECT');
 assert not has_table_privilege('authenticated','public.luke_invitation_recipients','SELECT');
 assert not has_table_privilege('authenticated','public.luke_invite_revocations','UPDATE');
 assert not has_function_privilege('authenticated','public.luke_allow_invitation(text,text)','EXECUTE');
 begin perform public.create_luke_invitation_batch('group-calendar','["one@example.invalid","two@example.invalid"]','person','8c100000-0000-4000-8000-000000000002');raise exception 'Individual accepted multiple';exception when raise_exception then if sqlerrm='Individual accepted multiple' then raise;end if;end;
 begin perform public.create_luke_invitation_batch('group-calendar','["one@example.invalid"]','group','8c100000-0000-4000-8000-000000000002');raise exception 'Single group accepted';exception when raise_exception then if sqlerrm='Single group accepted' then raise;end if;end;
 begin perform public.create_luke_invitation_batch('group-calendar','["one@example.invalid","bad@-domain.no"]','group','8c100000-0000-4000-8000-000000000002');raise exception 'Invalid email allowed';exception when raise_exception then if sqlerrm='Invalid email allowed' then raise;end if;end;
 begin perform public.create_luke_invitation_batch('group-calendar','[null]','person','8c100000-0000-4000-8000-000000000002');raise exception 'Nonstring email allowed';exception when raise_exception then if sqlerrm='Nonstring email allowed' then raise;end if;end;
 begin perform public.create_luke_invitation_batch('group-calendar','["two@example.invalid"]','person','8c100000-0000-4000-8000-000000000001');raise exception 'Changed retry allowed';exception when invalid_parameter_value then null;end;
 begin perform public.create_luke_invitation_batch('group-calendar',(select jsonb_agg(n||'@example.invalid') from generate_series(1,51)n),'group','8c100000-0000-4000-8000-000000000002');raise exception 'Recipient limit ignored';exception when raise_exception then if sqlerrm='Recipient limit ignored' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000004',true);
do $$ begin
 begin perform public.get_luke_invitations('group-calendar');raise exception 'Nonowner listed invite emails';exception when insufficient_privilege then null;end;
 begin perform public.revoke_luke_invitation('group-calendar','one@example.invalid');raise exception 'Nonowner revoked';exception when insufficient_privilege then null;end;
 begin perform public.create_luke_invitation_batch('group-calendar','["one@example.invalid"]','person','8c100000-0000-4000-8000-000000000002');raise exception 'Nonowner invited';exception when insufficient_privilege then null;end;
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Forwarded group token allowed outsider';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email_confirmed_at=null where id='8c000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Unverified group email allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='8c000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 assert public.accept_luke_invite((select v from group_vars where k='group'))='group-calendar';
 assert public.accept_luke_invite((select v from group_vars where k='group'))='group-calendar','Repeat acceptance failed';
 perform public.accept_luke_invite((select v from group_vars where k='personal'));
 perform public.open_luke_door('group-calendar',1);
 r:=public.submit_luke_answer('group-calendar',1,0,'{"answers":[1]}');assert r->'attempt'->'result'->>'correct'='false';
 begin perform public.get_luke_invitations('group-calendar');raise exception 'Member listed other invite emails';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000005',true);
do $$ begin
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Second account claimed same group recipient';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000001',true);
do $$ declare r jsonb;begin
 r:=public.get_luke_invitations('group-calendar');assert r->0->>'hasAccess'='true';
 perform public.remove_luke_participant('group-calendar','8c000000-0000-4000-8000-000000000002');
 r:=public.get_luke_invitations('group-calendar');assert jsonb_array_length(r)=2 and r->0->>'accepted'='true' and r->0->>'hasAccess'='false';
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 perform public.accept_luke_invite((select v from group_vars where k='group'));
 assert public.get_luke_workspace()->'progress'->'group-calendar'->'opened'='[1]','Remove/rejoin reset progress';
 r:=public.submit_luke_answer('group-calendar',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','Remove/rejoin reset first attempt';
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000001',true);
select public.revoke_luke_invitation('group-calendar','one@example.invalid');
select public.revoke_luke_invitation('group-calendar','one@example.invalid');
do $$ begin
 assert jsonb_array_length(public.get_luke_invitations('group-calendar'))=1,'Revoke did not remove all invitations for email';
 begin perform public.create_luke_invitation_batch('group-calendar','["one@example.invalid","two@example.invalid"]','group','8c100000-0000-4000-8000-000000000001');raise exception 'Delayed retry restored revoked address';exception when invalid_parameter_value then null;end;
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ begin
 assert jsonb_array_length(public.get_luke_workspace()->'data'->'calendars')=0,'Revoked invitation retained calendar';
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Revoked group recipient rejoined';exception when insufficient_privilege then null;end;
 begin perform public.accept_luke_invite((select v from group_vars where k='legacy'));raise exception 'Legacy link bypassed email revocation';exception when insufficient_privilege then null;end;
 begin perform public.accept_luke_invite((select v from group_vars where k='personal'));raise exception 'Deleted personal link worked';exception when raise_exception then if sqlerrm='Deleted personal link worked' then raise;end if;end;
end $$;
-- Claim IDs remain blocked even when a previously invited account changes email.
reset role;
update auth.users set email='changed@example.invalid' where id='8c000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.accept_luke_invite((select v from group_vars where k='legacy'));raise exception 'Email change bypassed revocation';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.users set email='one@example.invalid' where id='8c000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000003',true);
do $$ begin assert public.accept_luke_invite((select v from group_vars where k='group'))='group-calendar','One revocation broke group for others';end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000001',true);
insert into group_vars values('reinvited',public.create_luke_invitation_batch('group-calendar','["one@example.invalid"]','person','8c100000-0000-4000-8000-000000000003')->>'token');
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000002',true);
do $$ declare r jsonb;begin
 perform public.accept_luke_invite((select v from group_vars where k='reinvited'));
 assert public.get_luke_workspace()->'progress'->'group-calendar'->'opened'='[1]';
 r:=public.submit_luke_answer('group-calendar',1,0,'{"answers":[0]}');assert r->'attempt'->'result'->>'correct'='false','Reinvitation reset first attempt';
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Old revoked group link restored by new invitation';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000001',true);
select public.stop_luke_sharing('group-calendar');
do $$ begin assert public.get_luke_invitations('group-calendar')='[]';end $$;
select set_config('request.jwt.claim.sub','8c000000-0000-4000-8000-000000000003',true);
do $$ begin
 assert jsonb_array_length(public.get_luke_workspace()->'data'->'calendars')=0;
 begin perform public.accept_luke_invite((select v from group_vars where k='group'));raise exception 'Stopped group worked';exception when raise_exception then if sqlerrm='Stopped group worked' then raise;end if;end;
end $$;
reset role;
rollback;
select 'PASS: group allowlists, owner-only unopened invitation list, nonce retries, verified identities, independent member removal, per-email revocation across tokens, legacy bypass prevention and retained progress/first attempts.' as result;
