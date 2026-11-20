-- OKA : comptes de l'équipe, bénéficiaires, tablettes, annonces.
-- Principe : aucune donnée personnelle ni de santé sur le serveur. Le profil, l'agenda et les
-- conversations restent sur la tablette. Ici, seulement ce qu'il faut pour l'accueil et la gestion.

create extension if not exists pgcrypto with schema extensions;

/* ================= TABLES ================= */

-- Structures qui accompagnent les bénéficiaires (CCAS, association, Diwaging).
create table public.structures (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 120),
  ville text not null default 'Nice',
  created_at timestamptz not null default now()
);

-- Membres de l'équipe (comptes Supabase Auth). admin = Diwaging, referent = agent d'une structure.
create table public.equipe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  structure_id uuid references public.structures(id) on delete restrict,
  role text not null default 'referent' check (role in ('admin', 'referent')),
  nom text not null default '',
  created_at timestamptz not null default now(),
  check (role = 'admin' or structure_id is not null)
);

-- Bénéficiaires : un libellé pseudonyme (référence interne, initiales), jamais de nom complet.
create table public.beneficiaires (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid not null references public.structures(id) on delete restrict,
  libelle text not null check (char_length(libelle) between 1 and 60),
  referent_id uuid references public.equipe(user_id) on delete set null,
  ia_autorisee boolean not null default false, -- accord de la personne pour les questions libres
  statut text not null default 'en_attente' check (statut in ('en_attente', 'actif', 'suspendu')),
  created_at timestamptz not null default now()
);

-- Codes d'activation à usage unique (on ne garde que l'empreinte du code).
create table public.codes_activation (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  code_hash text not null unique,
  expire_le timestamptz not null default now() + interval '7 days',
  utilise_le timestamptz,
  cree_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tablettes activées (on ne garde que l'empreinte du jeton).
create table public.appareils (
  id uuid primary key default gen_random_uuid(),
  beneficiaire_id uuid not null references public.beneficiaires(id) on delete cascade,
  jeton_hash text not null unique,
  active_le timestamptz not null default now(),
  revoque_le timestamptz,
  vu_le date -- dernier contact, au jour près : gestion du parc, pas de suivi de la personne
);

-- Nombre de questions libres par tablette et par jour (maîtrise des coûts). Aucun contenu.
create table public.quota_ia (
  appareil_id uuid not null references public.appareils(id) on delete cascade,
  jour date not null default current_date,
  n int not null default 0,
  primary key (appareil_id, jour)
);

-- Informations envoyées aux tablettes. structure_id null = toutes les structures.
create table public.annonces (
  id uuid primary key default gen_random_uuid(),
  structure_id uuid references public.structures(id) on delete cascade,
  type text not null default 'info' check (type in ('info', 'alerte', 'activite')),
  titre text not null check (char_length(titre) between 1 and 120),
  texte text not null default '' check (char_length(texte) <= 600),
  date_evenement date,
  heure time,
  lieu text check (char_length(lieu) <= 120),
  visible_du date not null default current_date,
  visible_au date,
  cree_par uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (type <> 'activite' or (date_evenement is not null and heure is not null))
);

-- Journal des actions de l'équipe (qui a fait quoi, sans contenu personnel).
create table public.journal (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  acteur uuid,
  action text not null,
  cible uuid
);

create index on public.beneficiaires (structure_id);
create index on public.appareils (beneficiaire_id);
create index on public.codes_activation (beneficiaire_id);
create index on public.annonces (structure_id, visible_du);

/* ================= DROITS DE L'ÉQUIPE ================= */

create function public.est_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.equipe where user_id = auth.uid() and role = 'admin');
$$;

create function public.ma_structure() returns uuid
language sql stable security definer set search_path = '' as $$
  select structure_id from public.equipe where user_id = auth.uid();
$$;

-- Un admin gère tout ; un référent gère sa structure.
create function public.peut_gerer(s uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.est_admin() or (s is not null and s = public.ma_structure());
$$;

alter table public.structures enable row level security;
alter table public.equipe enable row level security;
alter table public.beneficiaires enable row level security;
alter table public.codes_activation enable row level security;
alter table public.appareils enable row level security;
alter table public.quota_ia enable row level security;
alter table public.annonces enable row level security;
alter table public.journal enable row level security;

create policy structures_lecture on public.structures for select to authenticated
  using (public.peut_gerer(id));
create policy structures_admin on public.structures for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

create policy equipe_lecture on public.equipe for select to authenticated
  using (user_id = auth.uid() or public.peut_gerer(structure_id));
create policy equipe_admin on public.equipe for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

create policy beneficiaires_gestion on public.beneficiaires for all to authenticated
  using (public.peut_gerer(structure_id)) with check (public.peut_gerer(structure_id));

create policy codes_lecture on public.codes_activation for select to authenticated
  using (exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.peut_gerer(b.structure_id)));

create policy appareils_gestion on public.appareils for select to authenticated
  using (exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.peut_gerer(b.structure_id)));
create policy appareils_revocation on public.appareils for update to authenticated
  using (exists (select 1 from public.beneficiaires b where b.id = beneficiaire_id and public.peut_gerer(b.structure_id)));

create policy annonces_gestion on public.annonces for all to authenticated
  using (public.peut_gerer(structure_id)) with check (public.peut_gerer(structure_id));

create policy journal_admin on public.journal for select to authenticated
  using (public.est_admin());

-- L'équipe ne peut modifier d'une tablette que sa date de révocation.
revoke update on public.appareils from authenticated;
grant update (revoque_le) on public.appareils to authenticated;
-- Rien n'est accessible sans connexion.
revoke all on all tables in schema public from anon;

/* ================= JOURNAL AUTOMATIQUE ================= */

create function public.journaliser() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'appareils' and tg_op = 'UPDATE' then
    if new.revoque_le is not distinct from old.revoque_le then
      return new; -- simple passage de la tablette (vu_le) : rien à journaliser
    end if;
  end if;
  insert into public.journal (acteur, action, cible)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), case when tg_op = 'DELETE' then old.id else new.id end);
  return coalesce(new, old);
end $$;

create trigger journal_structures after insert or update or delete on public.structures for each row execute function public.journaliser();
create trigger journal_beneficiaires after insert or update or delete on public.beneficiaires for each row execute function public.journaliser();
create trigger journal_codes after insert on public.codes_activation for each row execute function public.journaliser();
create trigger journal_appareils after insert or update on public.appareils for each row execute function public.journaliser();
create trigger journal_annonces after insert or update or delete on public.annonces for each row execute function public.journaliser();

/* ================= FONCTIONS POUR L'ÉQUIPE ================= */

-- Crée un code d'activation (format ABCD-EFGH, sans 0/O/1/I) ; un seul code valide à la fois.
create function public.creer_code_activation(p_beneficiaire uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  s uuid;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := extensions.gen_random_bytes(8);
  code text := '';
begin
  select structure_id into s from public.beneficiaires where id = p_beneficiaire;
  if s is null or not public.peut_gerer(s) then
    raise exception 'Bénéficiaire introuvable ou non autorisé' using errcode = '42501';
  end if;
  delete from public.codes_activation where beneficiaire_id = p_beneficiaire and utilise_le is null;
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    if i = 3 then code := code || '-'; end if;
  end loop;
  insert into public.codes_activation (beneficiaire_id, code_hash, cree_par)
  values (p_beneficiaire, encode(extensions.digest(code, 'sha256'), 'hex'), auth.uid());
  return code;
end $$;

-- Rattache un compte Auth existant (créé dans Supabase Studio) à l'équipe. Admin seulement.
create function public.ajouter_membre(p_email text, p_structure uuid, p_role text, p_nom text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs' using errcode = '42501'; end if;
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'Aucun compte avec cet e-mail : créez-le d''abord dans Supabase (Authentication).'; end if;
  insert into public.equipe (user_id, structure_id, role, nom) values (u, p_structure, p_role, coalesce(p_nom, ''))
  on conflict (user_id) do update set structure_id = excluded.structure_id, role = excluded.role, nom = excluded.nom;
  insert into public.journal (acteur, action, cible) values (auth.uid(), 'equipe.ajout', u);
  return u;
end $$;

-- Liste de l'équipe avec les e-mails (admin seulement).
create function public.liste_equipe() returns table (user_id uuid, email text, nom text, role text, structure_id uuid)
language sql stable security definer set search_path = '' as $$
  select e.user_id, u.email::text, e.nom, e.role, e.structure_id
  from public.equipe e join auth.users u on u.id = e.user_id
  where public.est_admin()
  order by e.role, e.nom;
$$;

/* ================= FONCTIONS POUR LES TABLETTES (service_role seulement) ================= */

-- Échange un code contre un jeton de tablette. Les anciennes tablettes de la personne sont révoquées.
create function public.activer_appareil(p_code_hash text, p_jeton_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  update public.codes_activation set utilise_le = now()
  where code_hash = p_code_hash and utilise_le is null and expire_le > now()
  returning beneficiaire_id into c;
  if not found then return null; end if;
  if exists (select 1 from public.beneficiaires where id = c.beneficiaire_id and statut = 'suspendu') then return null; end if;
  update public.appareils set revoque_le = now() where beneficiaire_id = c.beneficiaire_id and revoque_le is null;
  insert into public.appareils (beneficiaire_id, jeton_hash, vu_le) values (c.beneficiaire_id, p_jeton_hash, current_date);
  update public.beneficiaires set statut = 'actif' where id = c.beneficiaire_id;
  return (
    select jsonb_build_object('structure', s.nom, 'ville', s.ville, 'ia', b.ia_autorisee)
    from public.beneficiaires b join public.structures s on s.id = b.structure_id
    where b.id = c.beneficiaire_id
  );
end $$;

-- Tablette valide ? Met à jour vu_le et renvoie ses droits, ou null si révoquée / suspendue.
create function public.appareil_valide(p_jeton_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select a.id, b.structure_id, b.ia_autorisee, s.nom, s.ville into r
  from public.appareils a
  join public.beneficiaires b on b.id = a.beneficiaire_id
  join public.structures s on s.id = b.structure_id
  where a.jeton_hash = p_jeton_hash and a.revoque_le is null and b.statut = 'actif';
  if not found then return null; end if;
  update public.appareils set vu_le = current_date where id = r.id and vu_le is distinct from current_date;
  return jsonb_build_object('appareil', r.id, 'structure_id', r.structure_id, 'structure', r.nom, 'ville', r.ville, 'ia', r.ia_autorisee);
end $$;

-- Annonces visibles aujourd'hui pour une tablette.
create function public.annonces_appareil(p_jeton_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a jsonb;
begin
  a := public.appareil_valide(p_jeton_hash);
  if a is null then return null; end if;
  return a || jsonb_build_object('annonces', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'type', n.type, 'titre', n.titre, 'texte', n.texte,
      'date', n.date_evenement, 'heure', to_char(n.heure, 'HH24:MI'), 'lieu', n.lieu,
      'source', coalesce(s.nom, 'OKA')) order by n.created_at desc)
    from public.annonces n left join public.structures s on s.id = n.structure_id
    where (n.structure_id is null or n.structure_id = (a->>'structure_id')::uuid)
      and n.visible_du <= current_date
      and (n.visible_au is null or n.visible_au >= current_date)
      and (n.type <> 'activite' or n.date_evenement >= current_date)
  ), '[]'::jsonb));
end $$;

-- Compte une question libre ; faux si le plafond du jour est atteint.
create function public.consommer_quota_ia(p_appareil uuid, p_max int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.quota_ia (appareil_id, n) values (p_appareil, 1)
  on conflict (appareil_id, jour) do update set n = public.quota_ia.n + 1
  returning public.quota_ia.n into n;
  delete from public.quota_ia where jour < current_date - 7; -- pas d'historique inutile
  return n <= p_max;
end $$;

-- Supabase accorde par défaut l'exécution à anon et authenticated : on retire tout, puis on accorde au cas par cas.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.est_admin(), public.ma_structure(), public.peut_gerer(uuid),
  public.creer_code_activation(uuid), public.ajouter_membre(text, uuid, text, text), public.liste_equipe() to authenticated;
grant execute on function public.activer_appareil(text, text), public.appareil_valide(text),
  public.annonces_appareil(text), public.consommer_quota_ia(uuid, int) to service_role;
