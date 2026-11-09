-- Restore free person/group invitations without changing existing data or billing.
begin;
revoke execute on function public.create_luke_invitation_batch(text,jsonb,text,uuid) from public,anon;
grant execute on function public.create_luke_invitation_batch(text,jsonb,text,uuid) to authenticated;

-- Deployment checks inspect the actual grants, rather than only a version number.
create or replace function public.luke_free_sharing_ready() returns integer
language sql stable set search_path='' as $$
  select case when
    pg_catalog.has_function_privilege('authenticated','public.create_luke_invitation_batch(text,jsonb,text,uuid)','EXECUTE')
    and not pg_catalog.has_function_privilege('anon','public.create_luke_invitation_batch(text,jsonb,text,uuid)','EXECUTE')
  then 1 else 0 end
$$;
revoke all on function public.luke_free_sharing_ready() from public;
grant execute on function public.luke_free_sharing_ready() to anon,authenticated;
notify pgrst,'reload schema';
commit;
