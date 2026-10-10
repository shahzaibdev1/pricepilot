create table public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"suppliers":[],"products":[],"batches":[],"catalogVersion":0,"currency":"USD"}'::jsonb,
  version integer not null default 0 check(version >= 0),
  updated_at timestamptz not null default now(),
  constraint workspace_size check (octet_length(data::text) <= 20000000)
);
alter table public.workspaces enable row level security;
create policy "Read only your workspace" on public.workspaces for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;

create function public.get_workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); result jsonb;
begin
 if current_user_id is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 insert into public.workspaces(user_id) values(current_user_id) on conflict(user_id) do nothing;
 select jsonb_build_object('data',w.data,'version',w.version) into result from public.workspaces w where w.user_id=current_user_id;
 return result;
end;
$$;

create function public.save_workspace(expected_version integer, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); result jsonb;
begin
 if current_user_id is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload) is distinct from 'object'
 or jsonb_typeof(payload->'suppliers') is distinct from 'array'
 or jsonb_typeof(payload->'products') is distinct from 'array'
 or jsonb_typeof(payload->'batches') is distinct from 'array'
 or jsonb_typeof(payload->'catalogVersion') is distinct from 'number'
 or (payload->>'catalogVersion') !~ '^[0-9]+$'
 or (payload->>'catalogVersion')::numeric > 2147483647
 or payload->>'currency' not in ('USD','EUR','GBP','PKR','CAD','AUD')
 or payload->>'currency' is null
 then raise exception 'Invalid workspace data' using errcode='22023'; end if;
 if jsonb_array_length(payload->'suppliers') > 100 or jsonb_array_length(payload->'products') > 5000 or jsonb_array_length(payload->'batches') > 50
 or octet_length(payload::text)>20000000 then raise exception 'Workspace limit exceeded' using errcode='22023'; end if;
 update public.workspaces w set data=payload, version=w.version+1, updated_at=now()
 where w.user_id=current_user_id and w.version=expected_version
 returning jsonb_build_object('data',w.data,'version',w.version) into result;
 if result is null then raise exception 'Workspace changed in another tab. Reload before saving.' using errcode='40001'; end if;
 return result;
end;
$$;
revoke all on function public.get_workspace() from public,anon;
revoke all on function public.save_workspace(integer,jsonb) from public,anon;
grant execute on function public.get_workspace() to authenticated;
grant execute on function public.save_workspace(integer,jsonb) to authenticated;
