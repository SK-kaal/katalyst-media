-- Keep the privileged report reader out of PostgREST's exposed public schema.
-- Anonymous callers reach it only through the narrow SECURITY INVOKER wrapper
-- below; the private implementation retains the exact allowlisted payload and
-- token/lifecycle checks from the preceding hardening migration.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, service_role;

alter function public.fetch_shared_report(text) set schema private;
alter function private.fetch_shared_report(text)
  rename to fetch_shared_report_impl;

revoke all on function private.fetch_shared_report_impl(text)
  from public, anon, authenticated;
grant execute on function private.fetch_shared_report_impl(text)
  to anon, service_role;

create function public.fetch_shared_report(p_token text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.fetch_shared_report_impl($1);
$function$;

revoke all on function public.fetch_shared_report(text)
  from public, authenticated;
grant execute on function public.fetch_shared_report(text)
  to anon, service_role;

comment on function private.fetch_shared_report_impl(text) is
  'Unexposed privileged reader for token-gated active campaign reports.';
comment on function public.fetch_shared_report(text) is
  'Public SECURITY INVOKER wrapper; delegates to the unexposed allowlisted report reader.';
