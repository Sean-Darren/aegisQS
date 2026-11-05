-- Smart QS persistence. Run once in the Supabase SQL editor or with psql.
-- The entity payloads preserve the existing camelCase Zod/API contracts.
begin;
create table public.user_profiles (
 id text primary key, auth_user_id uuid unique references auth.users(id),
 data jsonb not null check (data->>'id'=id),
 check (data->>'role' in ('senior_qs','qs','viewer','admin'))
);
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon, authenticated;
grant select on public.user_profiles to authenticated;
create policy own_profile on public.user_profiles for select to authenticated using(auth_user_id=(select auth.uid()));
create table public.projects (
 id text primary key, project_id text, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index projects_project_idx on public.projects(project_id) where active;
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant all on public.projects to service_role;
create table public.documents (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index documents_project_idx on public.documents(project_id) where active;
alter table public.documents enable row level security;
revoke all on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
grant all on public.documents to service_role;
create table public.document_versions (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index document_versions_project_idx on public.document_versions(project_id) where active;
alter table public.document_versions enable row level security;
revoke all on public.document_versions from anon, authenticated;
grant select on public.document_versions to authenticated;
grant all on public.document_versions to service_role;
create table public.version_conflicts (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index version_conflicts_project_idx on public.version_conflicts(project_id) where active;
alter table public.version_conflicts enable row level security;
revoke all on public.version_conflicts from anon, authenticated;
grant select on public.version_conflicts to authenticated;
grant all on public.version_conflicts to service_role;
create table public.drawing_comparisons (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index drawing_comparisons_project_idx on public.drawing_comparisons(project_id) where active;
alter table public.drawing_comparisons enable row level security;
revoke all on public.drawing_comparisons from anon, authenticated;
grant select on public.drawing_comparisons to authenticated;
grant all on public.drawing_comparisons to service_role;
create table public.drawing_changes (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index drawing_changes_project_idx on public.drawing_changes(project_id) where active;
alter table public.drawing_changes enable row level security;
revoke all on public.drawing_changes from anon, authenticated;
grant select on public.drawing_changes to authenticated;
grant all on public.drawing_changes to service_role;
create table public.variation_events (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index variation_events_project_idx on public.variation_events(project_id) where active;
alter table public.variation_events enable row level security;
revoke all on public.variation_events from anon, authenticated;
grant select on public.variation_events to authenticated;
grant all on public.variation_events to service_role;
create table public.workbooks (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index workbooks_project_idx on public.workbooks(project_id) where active;
alter table public.workbooks enable row level security;
revoke all on public.workbooks from anon, authenticated;
grant select on public.workbooks to authenticated;
grant all on public.workbooks to service_role;
create table public.workbook_versions (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index workbook_versions_project_idx on public.workbook_versions(project_id) where active;
alter table public.workbook_versions enable row level security;
revoke all on public.workbook_versions from anon, authenticated;
grant select on public.workbook_versions to authenticated;
grant all on public.workbook_versions to service_role;
create table public.workbook_checks (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index workbook_checks_project_idx on public.workbook_checks(project_id) where active;
alter table public.workbook_checks enable row level security;
revoke all on public.workbook_checks from anon, authenticated;
grant select on public.workbook_checks to authenticated;
grant all on public.workbook_checks to service_role;
create table public.boq_items (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index boq_items_project_idx on public.boq_items(project_id) where active;
alter table public.boq_items enable row level security;
revoke all on public.boq_items from anon, authenticated;
grant select on public.boq_items to authenticated;
grant all on public.boq_items to service_role;
create table public.materials (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index materials_project_idx on public.materials(project_id) where active;
alter table public.materials enable row level security;
revoke all on public.materials from anon, authenticated;
grant select on public.materials to authenticated;
grant all on public.materials to service_role;
create table public.price_forecasts (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index price_forecasts_project_idx on public.price_forecasts(project_id) where active;
alter table public.price_forecasts enable row level security;
revoke all on public.price_forecasts from anon, authenticated;
grant select on public.price_forecasts to authenticated;
grant all on public.price_forecasts to service_role;
create table public.procurement_advice (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index procurement_advice_project_idx on public.procurement_advice(project_id) where active;
alter table public.procurement_advice enable row level security;
revoke all on public.procurement_advice from anon, authenticated;
grant select on public.procurement_advice to authenticated;
grant all on public.procurement_advice to service_role;
create table public.material_needs (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index material_needs_project_idx on public.material_needs(project_id) where active;
alter table public.material_needs enable row level security;
revoke all on public.material_needs from anon, authenticated;
grant select on public.material_needs to authenticated;
grant all on public.material_needs to service_role;
create table public.entity_links (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index entity_links_project_idx on public.entity_links(project_id) where active;
alter table public.entity_links enable row level security;
revoke all on public.entity_links from anon, authenticated;
grant select on public.entity_links to authenticated;
grant all on public.entity_links to service_role;
create table public.audit_events (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index audit_events_project_idx on public.audit_events(project_id) where active;
alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
create table public.parsed_workbooks (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index parsed_workbooks_project_idx on public.parsed_workbooks(project_id) where active;
alter table public.parsed_workbooks enable row level security;
revoke all on public.parsed_workbooks from anon, authenticated;
grant select on public.parsed_workbooks to authenticated;
grant all on public.parsed_workbooks to service_role;
create table public.file_objects (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
create index file_objects_project_idx on public.file_objects(project_id) where active;
alter table public.file_objects enable row level security;
revoke all on public.file_objects from anon, authenticated;
grant select on public.file_objects to authenticated;
grant all on public.file_objects to service_role;
create table public.project_events (
 id text primary key, project_id text references public.projects(id) deferrable initially deferred, data jsonb not null,
 active boolean not null default true, updated_at timestamptz not null default now()
);
alter table public.project_events add column event_seq bigint generated always as identity unique;
create index project_events_project_idx on public.project_events(project_id) where active;
alter table public.project_events enable row level security;
revoke all on public.project_events from anon, authenticated;
grant select on public.project_events to authenticated;
grant all on public.project_events to service_role;
create function public.smart_qs_member(p_project text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p join public.user_profiles u on p.data->'memberIds' ? u.id
 where p.id=p_project and p.active and u.auth_user_id=(select auth.uid()));
$$;
revoke all on function public.smart_qs_member(text) from public; grant execute on function public.smart_qs_member(text) to authenticated;
create policy member_read on public.projects for select to authenticated using(active and (public.smart_qs_member(id)));
create policy member_read on public.documents for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.document_versions for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.version_conflicts for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.drawing_comparisons for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.drawing_changes for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.variation_events for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.workbooks for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.workbook_versions for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.workbook_checks for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.boq_items for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.materials for select to authenticated using(active and (auth.uid() is not null));
create policy member_read on public.price_forecasts for select to authenticated using(active and (auth.uid() is not null));
create policy member_read on public.procurement_advice for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.material_needs for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.entity_links for select to authenticated using(active and (public.smart_qs_member(project_id)));
create policy member_read on public.audit_events for select to authenticated using(active and (public.smart_qs_member(project_id)));
revoke select on public.parsed_workbooks from authenticated;
revoke select on public.file_objects from authenticated;
create policy member_read on public.project_events for select to authenticated using(active and (public.smart_qs_member(project_id)));
grant all on public.user_profiles to service_role;
create unique index one_current_document_version on public.document_versions ((data->>'documentId')) where active and data->>'status'='current';
create unique index document_number_per_project on public.documents (project_id,(data->>'docNumber')) where active;
create unique index workbook_version_number on public.workbook_versions ((data->>'workbookId'),(data->>'versionNumber')) where active;
create index checks_version on public.workbook_checks ((data->>'versionId')) where active;
create index items_version on public.boq_items ((data->>'workbookVersionId')) where active;
create index audit_time on public.audit_events (project_id,(data->>'at')) where active;
alter table public.document_versions add column document_id text generated always as (data->>'documentId') stored references public.documents(id) deferrable initially deferred;
alter table public.version_conflicts add column document_id text generated always as (data->>'documentId') stored references public.documents(id) deferrable initially deferred;
alter table public.drawing_comparisons add column document_id text generated always as (data->>'documentId') stored references public.documents(id) deferrable initially deferred;
alter table public.drawing_changes add column comparison_id text generated always as (data->>'comparisonId') stored references public.drawing_comparisons(id) deferrable initially deferred;
alter table public.variation_events add column comparison_id text generated always as (data->>'comparisonId') stored references public.drawing_comparisons(id) deferrable initially deferred;
alter table public.workbooks add column document_id text generated always as (data->>'documentId') stored references public.documents(id) deferrable initially deferred;
alter table public.workbook_versions add column workbook_id text generated always as (data->>'workbookId') stored references public.workbooks(id) deferrable initially deferred;
alter table public.workbook_checks add column version_id text generated always as (data->>'versionId') stored references public.workbook_versions(id) deferrable initially deferred;
alter table public.boq_items add column workbook_version_id text generated always as (data->>'workbookVersionId') stored references public.workbook_versions(id) deferrable initially deferred;
alter table public.price_forecasts add column material_id text generated always as (data->>'materialId') stored references public.materials(id) deferrable initially deferred;
alter table public.procurement_advice add column material_id text generated always as (data->>'materialId') stored references public.materials(id) deferrable initially deferred;
alter table public.material_needs add column material_id text generated always as (data->>'materialId') stored references public.materials(id) deferrable initially deferred;
create table public.backend_revision(id integer primary key check(id=1), revision bigint not null default 0);
insert into public.backend_revision(id) values(1);
alter table public.backend_revision enable row level security;
revoke all on public.backend_revision from anon, authenticated;
grant all on public.backend_revision to service_role;
create function public.smart_qs_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb := '[]'; chunk jsonb; t text; rev bigint;
begin
 select revision into rev from public.backend_revision where id=1 for share;
 foreach t in array ARRAY['projects','documents','document_versions','version_conflicts','drawing_comparisons','drawing_changes','variation_events','workbooks','workbook_versions','workbook_checks','boq_items','materials','price_forecasts','procurement_advice','material_needs','entity_links','audit_events','parsed_workbooks','file_objects','project_events'] loop
 execute format('select coalesce(jsonb_agg(jsonb_build_object(''table'',%L,''id'',id,''projectId'',project_id,''data'',data)),''[]''::jsonb) from public.%I where active',t,t) into chunk;
 result := result || chunk;
 end loop;
 return jsonb_build_object('revision',rev,'records',result);
end; $$;
-- All domain changes + audit + events are committed atomically. CAS prevents lost updates.
-- Only the server's secret key may invoke this function, after user permission checks.
create function public.smart_qs_commit(expected_revision bigint, changes jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare rev bigint; r jsonb; t text; d jsonb;
begin
 select revision into rev from public.backend_revision where id=1 for update;
 if rev <> expected_revision then raise exception 'Concurrent update; reload and retry' using errcode='40001'; end if;
 -- Supersede former current versions before inserting/updating the new current.
 for r in select value from jsonb_array_elements(changes) where value->>'table'='document_versions' and value->'data'->>'status' <> 'current' loop
 update public.document_versions set data=r->'data',updated_at=now() where id=r->>'id';
 end loop;
 for r in select value from jsonb_array_elements(changes) loop
 t:=r->>'table'; d:=r->'data';
 if not(t=any(ARRAY['projects','documents','document_versions','version_conflicts','drawing_comparisons','drawing_changes','variation_events','workbooks','workbook_versions','workbook_checks','boq_items','materials','price_forecasts','procurement_advice','material_needs','entity_links','audit_events','parsed_workbooks','file_objects','project_events'])) then raise exception 'Unsupported table'; end if;
 if coalesce((r->>'inactive')::boolean,false) then
 if not(t=any(ARRAY['boq_items','workbook_checks','material_needs','entity_links','parsed_workbooks'])) then raise exception 'Historical records cannot be removed'; end if;
 execute format('update public.%I set active=false,updated_at=now() where id=$1',t) using r->>'id';
 else
 if t='audit_events' and exists(select 1 from public.audit_events where id=r->>'id') then raise exception 'Audit events are immutable'; end if;
 execute format('insert into public.%I(id,project_id,data) values($1,$2,$3) on conflict(id) do update set data=excluded.data,project_id=excluded.project_id,active=true,updated_at=now()',t) using r->>'id',r->>'projectId',d;
 end if;
 end loop;
 -- Every versioned document has exactly one Current, matching its pointer.
 if exists(select 1 from public.documents d where d.active and ((d.data->>'versionCount')::integer>0 or d.data->>'currentVersionId' is not null) and
 (select count(*) from public.document_versions v where v.active and v.data->>'documentId'=d.id and v.data->>'status'='current' and v.id=d.data->>'currentVersionId')<>1) then raise exception 'Invalid current document version'; end if;
 update public.backend_revision set revision=revision+1 where id=1 returning revision into rev;
 return rev;
end; $$;
revoke all on function public.smart_qs_snapshot() from public,anon,authenticated;
revoke all on function public.smart_qs_commit(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.smart_qs_snapshot() to service_role;
grant execute on function public.smart_qs_commit(bigint,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('smart-qs-files','smart-qs-files',false,52428800) on conflict(id) do nothing;
-- File downloads go through the authenticated API. There are no public object policies.
notify pgrst,'reload schema';
commit;
