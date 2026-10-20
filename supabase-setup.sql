-- Run once: Supabase dashboard > SQL Editor > New query > paste > Run.
create table if not exists public.docs (
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);

alter table public.docs enable row level security;

-- Anyone with the site address can read and edit the six Rats collections, nothing else.
create policy "rats select" on public.docs for select to anon, authenticated
  using (coll in ('games','seasons','ledger','current','config','money'));
create policy "rats insert" on public.docs for insert to anon, authenticated
  with check (coll in ('games','seasons','ledger','current','config','money'));
create policy "rats update" on public.docs for update to anon, authenticated
  using (coll in ('games','seasons','ledger','current','config','money'))
  with check (coll in ('games','seasons','ledger','current','config','money'));
create policy "rats delete" on public.docs for delete to anon, authenticated
  using (coll in ('games','seasons','ledger','current','config','money'));

-- Live updates for everyone with the page open.
alter publication supabase_realtime add table public.docs;
