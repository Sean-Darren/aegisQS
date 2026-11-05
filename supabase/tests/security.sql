-- Run only against an isolated database seeded with the fixture SQL.
begin;
-- Seed, RLS, immutable audit and atomic rollback/CAS checks.
do $$begin
 if (select count(*) from public.documents)<>40 then raise exception 'Fixture documents missing'; end if;
 if (select count(*) from public.boq_items)<>1203 then raise exception 'Fixture items missing'; end if;
 if (select count(*) from public.document_versions where data->>'status'='current')<>40 then raise exception 'Current version invariant failed'; end if;
 begin
 perform public.smart_qs_commit(0,'[]');raise exception 'Expected stale revision rejection';
 exception when serialization_failure then null;end;
 begin
 perform public.smart_qs_commit(1,'[{"table":"not_allowed","id":"x","data":{}}]');raise exception 'Expected unknown table rejection';
 exception when raise_exception then if sqlerrm<>'Unsupported table' then raise;end if;end;
 if (select revision from public.backend_revision)<>1 then raise exception 'Failed transaction changed revision'; end if;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$begin
 if (select count(*) from public.documents)<>40 then raise exception 'Member cannot read project';end if;
 begin
 perform public.smart_qs_commit(1,'[]');raise exception 'Expected RPC denial';
 exception when insufficient_privilege then null;end;
 begin
 update public.user_profiles set data=jsonb_set(data,'{role}','"admin"');raise exception 'Expected role escalation denial';
 exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$begin if (select count(*) from public.documents)<>0 then raise exception 'Non-member read project data';end if;end$$;
reset role;
select 'Migration, seed, RLS, role escalation denial, CAS and rollback passed' as result;

rollback;
