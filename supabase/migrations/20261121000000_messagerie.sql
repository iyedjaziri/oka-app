-- Messagerie entre l'équipe (structure, partenaires d'événements) et les bénéficiaires.
-- Une conversation par bénéficiaire, visible uniquement par sa structure. Messages effacés après 30 jours.
-- Nouveau rôle « partenaire » : organisateur d'événements rattaché à une structure ; il publie des annonces
-- et répond aux messages, mais ne gère ni les bénéficiaires ni les tablettes.

alter table public.equipe drop constraint if exists equipe_role_check;
alter table public.equipe add constraint equipe_role_check check (role in ('admin', 'referent', 'partenaire'));

-- gestion des bénéficiaires et des tablettes : admin, ou référent de la structure (pas les partenaires)
create or replace function public.peut_gerer(s uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_admin() or exists (
    select 1 from public.equipe where user_id = auth.uid() and role = 'referent' and structure_id = s);
$$;

-- annonces et messages : toute l'équipe de la structure, partenaires compris
create function public.est_membre(s uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_admin() or (s is not null and s = public.ma_structure());
$$;

drop policy annonces_gestion on public.annonces;
create policy annonces_gestion on public.annonces for all to authenticated
  using (public.est_membre(structure_id) or (structure_id is null and public.est_admin()))
  with check (public.est_membre(structure_id) or (structure_id is null and public.est_admin()));

create policy structures_lecture_membres on public.structures for select to authenticated
  using (public.est_membre(id));

-- les partenaires voient les bénéficiaires de leur structure (pour la messagerie), sans pouvoir les modifier
create policy beneficiaires_lecture_membres on public.beneficiaires for select to authenticated
  using (public.est_membre(structure_id));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  auteur text not null check (auteur in ('beneficiaire', 'equipe')),
  auteur_id uuid default auth.uid() references auth.users(id) on delete set null,
  auteur_nom text not null default '' check (char_length(auteur_nom) <= 60),
  texte text not null check (char_length(texte) between 1 and 1000),
  lu_le timestamptz,
  created_at timestamptz not null default now()
);
create index on public.messages (beneficiaire_id, created_at);
alter table public.messages enable row level security;

create policy messages_lecture on public.messages for select to authenticated
  using (exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.est_membre(b.structure_id)));
create policy messages_ecriture on public.messages for insert to authenticated
  with check (auteur = 'equipe' and auteur_id = auth.uid()
    and exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.est_membre(b.structure_id)));
-- l'équipe marque comme lus les messages des bénéficiaires (seule la colonne lu_le est modifiable)
create policy messages_lu on public.messages for update to authenticated
  using (exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.est_membre(b.structure_id)));
revoke update on public.messages from authenticated;
grant update (lu_le) on public.messages to authenticated;
revoke all on public.messages from anon;

-- durée de conservation : 30 jours (appelée à chaque échange, sans tâche planifiée)
create function public.purger_messages() returns void
language sql security definer set search_path = '' as $$
  delete from public.messages where created_at < now() - interval '30 days';
$$;

/* ---- côté tablette (service_role seulement, via la fonction Edge « messages ») ---- */

-- messages de la conversation (50 derniers) ; ceux de l'équipe sont marqués lus
create function public.messages_appareil(p_jeton_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a jsonb; b uuid; l jsonb;
begin
  a := public.appareil_valide(p_jeton_hash);
  if a is null then return null; end if;
  perform public.purger_messages();
  select beneficiaire_id into b from public.appareils where id = (a->>'appareil')::uuid;
  select coalesce(jsonb_agg(x order by x->>'date'), '[]'::jsonb) into l from (
    select jsonb_build_object('id', id, 'auteur', auteur, 'nom', auteur_nom, 'texte', texte, 'date', created_at) x
    from public.messages where beneficiaire_id = b order by created_at desc limit 50) t;
  update public.messages set lu_le = now() where beneficiaire_id = b and auteur = 'equipe' and lu_le is null;
  return jsonb_build_object('structure', a->>'structure', 'messages', l);
end $$;

-- message écrit sur la tablette
create function public.ecrire_message_appareil(p_jeton_hash text, p_texte text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a jsonb; b uuid; m public.messages;
begin
  a := public.appareil_valide(p_jeton_hash);
  if a is null then return null; end if;
  select beneficiaire_id into b from public.appareils where id = (a->>'appareil')::uuid;
  insert into public.messages (beneficiaire_id, auteur, auteur_id, auteur_nom, texte)
  values (b, 'beneficiaire', null, '', left(p_texte, 1000)) returning * into m;
  return jsonb_build_object('id', m.id, 'date', m.created_at);
end $$;

revoke execute on function public.est_membre(uuid), public.purger_messages(), public.messages_appareil(text),
  public.ecrire_message_appareil(text, text) from public, anon, authenticated;
grant execute on function public.est_membre(uuid) to authenticated;
grant execute on function public.purger_messages(), public.messages_appareil(text), public.ecrire_message_appareil(text, text) to service_role;
