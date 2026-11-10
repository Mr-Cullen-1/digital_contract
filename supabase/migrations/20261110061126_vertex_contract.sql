-- Vertex Contract. All mutations go through the authenticated Next.js server.
create type public.contract_status as enum ('Draft','Sent','Signed','Closed','Cancelled');
create table public.profiles(id uuid primary key references auth.users(id),display_name text,locale text not null default 'ru');
create table public.contracts(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 title text not null check(length(title) between 1 and 200),status public.contract_status not null default 'Draft',
 source_kind text not null default 'editor' check(source_kind in ('editor','docx','pdf')),
 recipient_role text not null check(recipient_role in ('customer','provider')),
 current_version_id uuid,number text unique,final_sha256 text,created_at timestamptz not null default now(),closed_at timestamptz,
 check((status='Closed')=(closed_at is not null and number is not null and final_sha256 is not null))
);
create index contracts_owner_created on public.contracts(owner_id,created_at desc);
create table public.contract_versions(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 version int not null,content jsonb not null,content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),created_at timestamptz not null default now(),unique(contract_id,version)
);
alter table public.contracts add constraint current_version_fk foreign key(current_version_id) references public.contract_versions(id) deferrable initially deferred;
create index versions_contract on public.contract_versions(contract_id);
create table public.contract_parties(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 side text not null check(side in ('creator','recipient')),role text not null check(role in ('customer','provider')),
 name text not null default '',address text not null default '',phone text not null default '',pinfl text not null default '',passport text not null default '',unique(contract_id,side)
);
create table public.contract_files(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 version_id uuid references public.contract_versions(id) on delete cascade,kind text not null check(kind in ('original','version','signature','final')),
 bucket text not null,path text not null unique,name text not null,mime text not null,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),created_at timestamptz not null default now()
);
create index files_contract on public.contract_files(contract_id);
create table public.contract_signatures(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 version_id uuid not null references public.contract_versions(id) on delete cascade,side text not null check(side in ('creator','recipient')),
 path text not null,sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),signed_at timestamptz not null default now(),
 consent_version text not null default '2026-11-10',user_agent text,unique(version_id,side)
);
create index signatures_contract on public.contract_signatures(contract_id);
create table public.contract_links(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 version_id uuid not null references public.contract_versions(id),token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),purpose text not null check(purpose in ('sign','view')),
 expires_at timestamptz not null,revoked_at timestamptz,used_at timestamptz,created_at timestamptz not null default now()
);
create index links_contract on public.contract_links(contract_id);
create table public.contract_events(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null references public.contracts(id) on delete cascade,
 event text not null,actor text not null,created_at timestamptz not null default now()
);
create index events_contract on public.contract_events(contract_id,created_at);
create table public.contract_templates(id text primary key,title text not null,description text not null,content jsonb not null,locale text not null default 'ru');
create sequence public.contract_number_seq;
create table public.contract_finalizations(
 contract_id uuid primary key references public.contracts(id),number text not null unique,
 reserved_at timestamptz not null default now(),completed_at timestamptz
);
-- Closed rows and children are protected even against accidental server-side writes.
create function public.vc_guard_contract() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='Closed' then raise exception 'Closed contract is immutable'; end if;
 if tg_op='DELETE' then
  if old.status<>'Draft' then raise exception 'Only drafts can be deleted';end if;
  return old;
 end if;
 if new.owner_id<>old.owner_id or new.id<>old.id then raise exception 'Owner is immutable';end if;
 if old.status<>'Draft' and (new.title is distinct from old.title or new.current_version_id is distinct from old.current_version_id or new.recipient_role is distinct from old.recipient_role or new.source_kind is distinct from old.source_kind) then raise exception 'Sent content is frozen';end if;
 if old.status<>new.status and not ((old.status='Draft' and new.status in ('Sent','Cancelled')) or (old.status='Sent' and new.status in ('Signed','Cancelled')) or (old.status='Signed' and new.status='Closed')) then raise exception 'Invalid transition';end if;
 return new;
end $$;
create trigger guard_contract before update or delete on public.contracts for each row execute function public.vc_guard_contract();
create function public.vc_guard_child() returns trigger language plpgsql set search_path='' as $$
declare cid uuid; s public.contract_status;
begin
 if tg_op='DELETE' then cid:=old.contract_id;else cid:=new.contract_id;end if;
 select status into s from public.contracts where id=cid;
 if s='Closed' then raise exception 'Closed contract children are immutable';end if;
 if tg_op='UPDATE' and new.contract_id<>old.contract_id then raise exception 'Cannot move contract data';end if;
 if tg_table_name='contract_versions' and (tg_op='UPDATE' or s<>'Draft') then raise exception 'Version is frozen';end if;
 if tg_table_name='contract_parties' then
  if s in ('Signed','Cancelled') or (s='Sent' and coalesce(new.side,old.side)='creator') then raise exception 'Party is frozen';end if;
 end if;
 if tg_table_name='contract_signatures' and tg_op<>'INSERT' and s is not null then raise exception 'Signature is immutable';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger guard_versions before insert or update or delete on public.contract_versions for each row execute function public.vc_guard_child();
create trigger guard_parties before insert or update or delete on public.contract_parties for each row execute function public.vc_guard_child();
create trigger guard_signatures before insert or update or delete on public.contract_signatures for each row execute function public.vc_guard_child();
create trigger guard_files before insert or update or delete on public.contract_files for each row execute function public.vc_guard_child();

-- RLS is defense in depth; untrusted roles have SELECT only, no mutation grants.
alter table public.profiles enable row level security;
create policy profile_owner on public.profiles for select to authenticated using(id=(select auth.uid()));
alter table public.contracts enable row level security;
create policy contract_owner on public.contracts for select to authenticated using(owner_id=(select auth.uid()));
do $$ declare t text;begin
 foreach t in array array['contract_versions','contract_parties','contract_files','contract_signatures','contract_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (exists(select 1 from public.contracts c where c.id=contract_id and c.owner_id=(select auth.uid())))',t);
 end loop;
end $$;
alter table public.contract_links enable row level security;
alter table public.contract_finalizations enable row level security;
alter table public.contract_templates enable row level security;
create policy template_read on public.contract_templates for select to authenticated using(true);
revoke all on public.profiles,public.contracts,public.contract_versions,public.contract_parties,public.contract_files,public.contract_signatures,public.contract_links,public.contract_events,public.contract_finalizations,public.contract_templates from anon,authenticated;
grant select on public.profiles,public.contracts,public.contract_versions,public.contract_parties,public.contract_files,public.contract_signatures,public.contract_events,public.contract_templates to authenticated;
grant all on public.profiles,public.contracts,public.contract_versions,public.contract_parties,public.contract_files,public.contract_signatures,public.contract_links,public.contract_events,public.contract_finalizations,public.contract_templates to service_role;
grant usage on sequence public.contract_number_seq to service_role;

create function public.vc_mutate(p_action text,p_owner uuid,p_id uuid,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.contracts; vid uuid; vno int; pid uuid; link public.contract_links; fin public.contract_finalizations; part jsonb; sigside text; seq_text text;
begin
 if p_action='save' and p_id is null then
  insert into public.contracts(owner_id,title,recipient_role,source_kind) values(p_owner,p_data->>'title',p_data->>'recipientRole',coalesce(p_data->>'sourceKind','editor')) returning * into c;
 else
  select * into c from public.contracts where id=p_id for update;
  if not found then raise exception 'Contract not found';end if;
  if p_action<>'sign' and c.owner_id is distinct from p_owner then raise exception 'Access denied';end if;
 end if;
 if p_action='save' then
  if c.status<>'Draft' then raise exception 'Only drafts can be edited';end if;
  select coalesce(max(version),0)+1 into vno from public.contract_versions where contract_id=c.id;
  insert into public.contract_versions(contract_id,version,content,content_hash) values(c.id,vno,p_data->'content',p_data->>'contentHash') returning id into vid;
  update public.contracts set title=p_data->>'title',current_version_id=vid,recipient_role=p_data->>'recipientRole' where id=c.id;
  part:=p_data->'creator';
  insert into public.contract_parties(contract_id,side,role,name,address,phone,pinfl,passport) values(c.id,'creator',case when p_data->>'recipientRole'='customer' then 'provider' else 'customer' end,part->>'name',part->>'address',part->>'phone',part->>'pinfl',part->>'passport')
  on conflict(contract_id,side) do update set role=excluded.role,name=excluded.name,address=excluded.address,phone=excluded.phone,pinfl=excluded.pinfl,passport=excluded.passport;
  insert into public.contract_events(contract_id,event,actor) values(c.id,case when vno=1 then 'created' else 'saved' end,'creator');
  return jsonb_build_object('id',c.id,'versionId',vid);
 elsif p_action='attach' then
  if c.status<>'Draft' then raise exception 'Only drafts accept originals';end if;
  if exists(select 1 from public.contract_files where contract_id=c.id and kind='original') then raise exception 'Original already attached';end if;
  insert into public.contract_files(contract_id,version_id,kind,bucket,path,name,mime,sha256) values(c.id,c.current_version_id,'original','originals',p_data->>'path',p_data->>'name',p_data->>'mime',p_data->>'sha256');
 elsif p_action in ('send','sign') then
  if (p_data->>'versionId')::uuid is distinct from c.current_version_id then raise exception 'Version has changed';end if;
  if p_action='send' then
   if c.status<>'Draft' then raise exception 'Only draft can be sent';end if;
   if c.source_kind in ('pdf','docx') and not exists(select 1 from public.contract_files where contract_id=c.id and kind='original') then raise exception 'Original missing';end if;
   sigside:='creator';
  else
   if c.status<>'Sent' then raise exception 'Contract is not awaiting signature';end if;
   select * into link from public.contract_links where contract_id=c.id and token_hash=p_data->>'tokenHash' and purpose='sign' for update;
   if not found or link.revoked_at is not null or link.used_at is not null or link.expires_at<=now() or link.version_id<>c.current_version_id then raise exception 'Link expired or revoked';end if;
   part:=p_data->'party';
   if part->>'role'<>c.recipient_role then raise exception 'Party role mismatch';end if;
   insert into public.contract_parties(contract_id,side,role,name,address,phone,pinfl,passport) values(c.id,'recipient',c.recipient_role,part->>'name',part->>'address',part->>'phone',part->>'pinfl',part->>'passport');
   update public.contract_links set used_at=now() where id=link.id;
   sigside:='recipient';
  end if;
  insert into public.contract_signatures(contract_id,version_id,side,path,sha256,user_agent) values(c.id,c.current_version_id,sigside,p_data->>'signaturePath',p_data->>'signatureHash',left(p_data->>'userAgent',300));
  if p_action='send' then
   insert into public.contract_links(contract_id,version_id,token_hash,purpose,expires_at) values(c.id,c.current_version_id,p_data->>'tokenHash','sign',now()+interval '7 days');
   update public.contracts set status='Sent' where id=c.id;
  else update public.contracts set status='Signed' where id=c.id;end if;
  insert into public.contract_events(contract_id,event,actor) values(c.id,p_action,sigside);
 elsif p_action='cancel' then
  if c.status not in ('Draft','Sent') then raise exception 'Cannot cancel this contract';end if;
  update public.contract_links set revoked_at=now() where contract_id=c.id and revoked_at is null;
  update public.contracts set status='Cancelled' where id=c.id;
  insert into public.contract_events(contract_id,event,actor) values(c.id,'cancelled','creator');
 elsif p_action='rotate_link' then
  if c.status<>'Sent' then raise exception 'Only sent invitations can be reissued';end if;
  update public.contract_links set revoked_at=now() where contract_id=c.id and revoked_at is null;
  insert into public.contract_links(contract_id,version_id,token_hash,purpose,expires_at) values(c.id,c.current_version_id,p_data->>'tokenHash','sign',now()+interval '7 days');
  insert into public.contract_events(contract_id,event,actor) values(c.id,'link_rotated','creator');
 elsif p_action='revoke_links' then
  update public.contract_links set revoked_at=now() where contract_id=c.id and revoked_at is null;
  insert into public.contract_events(contract_id,event,actor) values(c.id,'links_revoked','creator');
 elsif p_action='share' then
  if c.status<>'Closed' then raise exception 'Only closed contracts can be shared for viewing';end if;
  insert into public.contract_links(contract_id,version_id,token_hash,purpose,expires_at) values(c.id,c.current_version_id,p_data->>'tokenHash','view',now()+interval '7 days');
 elsif p_action='reserve_close' then
  if c.status not in ('Signed','Closed') then raise exception 'Both signatures required';end if;
  if (select count(*) from public.contract_signatures where contract_id=c.id and version_id=c.current_version_id)<>2 then raise exception 'Both signatures required';end if;
  select * into fin from public.contract_finalizations where contract_id=c.id;
  if not found then
   seq_text:=nextval('public.contract_number_seq')::text;
   insert into public.contract_finalizations(contract_id,number) values(c.id,'CTR-'||to_char(now() at time zone 'Asia/Tashkent','YYYY')||'-'||lpad(seq_text,greatest(6,length(seq_text)),'0')) returning * into fin;
  end if;
  return to_jsonb(fin);
 elsif p_action='complete_close' then
  if c.status='Closed' then return jsonb_build_object('id',c.id,'number',c.number);end if;
  if c.status<>'Signed' then raise exception 'Not signed';end if;
  select * into fin from public.contract_finalizations where contract_id=c.id;
  if not found or fin.number<>p_data->>'number' then raise exception 'Finalization mismatch';end if;
  insert into public.contract_files(contract_id,version_id,kind,bucket,path,name,mime,sha256) values(c.id,c.current_version_id,'final','finals',p_data->>'path',fin.number||'.pdf','application/pdf',p_data->>'sha256');
  update public.contracts set status='Closed',number=fin.number,closed_at=fin.reserved_at,final_sha256=p_data->>'sha256' where id=c.id;
  update public.contract_finalizations set completed_at=now() where contract_id=c.id;
  insert into public.contract_events(contract_id,event,actor) values(c.id,'closed','creator');
 elsif p_action='delete' then
  if c.status<>'Draft' then raise exception 'Only drafts can be deleted';end if;
  update public.contracts set current_version_id=null where id=c.id;
  delete from public.contracts where id=c.id;
 else raise exception 'Unknown action';end if;
 return jsonb_build_object('id',c.id);
end $$;
revoke all on function public.vc_mutate(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.vc_mutate(text,uuid,uuid,jsonb) to service_role;
revoke all on function public.vc_guard_contract(),public.vc_guard_child() from public,anon,authenticated;
grant execute on function public.vc_guard_contract(),public.vc_guard_child() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('originals','originals',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
 ('versions','versions',false,10485760,array['application/json','application/pdf']),
 ('signatures','signatures',false,300000,array['image/png']),
 ('finals','finals',false,20971520,array['application/pdf']) on conflict(id) do nothing;
-- No browser write policy. All uploads use unpredictable, unique paths, with upsert=false.
create policy vertex_file_read on storage.objects for select to authenticated using(
 bucket_id in ('originals','versions','signatures','finals') and exists(select 1 from public.contracts c where c.id::text=split_part(name,'/',1) and c.owner_id=(select auth.uid()))
);
