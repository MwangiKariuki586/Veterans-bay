import { hashPassword } from "better-auth/crypto";

export const localPersonaSpecs = [
  {
    key: "clientPrimary",
    kind: "client",
    name: "Mwas",
    email: "mwas@gmail.com",
    password: "LocalClientMwas!2026",
    fallbackAuthUserId: "local-client-mwas",
    fallbackProfileId: "d1000000-0000-4000-8000-000000000003",
  },
  {
    key: "clientJourney",
    kind: "client",
    name: "Peter Mwangi",
    email: "local.dashboard.client@veterans-bay.invalid",
    password: "LocalClientPeter!2026",
    fallbackAuthUserId: "local-dashboard-client",
    fallbackProfileId: "d1000000-0000-4000-8000-000000000001",
  },
  {
    key: "professionalPrimary",
    kind: "professional",
    name: "Emkay",
    email: "emkay@gmail.com",
    password: "LocalProfessionalEmkay!2026",
    fallbackAuthUserId: "local-professional-emkay",
    fallbackProfileId: "d1000000-0000-4000-8000-000000000004",
  },
  {
    key: "professionalJourney",
    kind: "professional",
    name: "Grace Wanjiku",
    email: "local.dashboard.team@veterans-bay.invalid",
    password: "LocalProfessionalGrace!2026",
    fallbackAuthUserId: "local-dashboard-team",
    fallbackProfileId: "d1000000-0000-4000-8000-000000000002",
  },
  {
    key: "administrator",
    kind: "administrator",
    name: "Platform Administrator",
    email: "admin@gmail.com",
    password: "LocalAdministrator!2026",
    fallbackAuthUserId: "local-platform-admin",
    fallbackProfileId: "d1000000-0000-4000-8000-000000000005",
  },
];

const graceOrganisationSlugs = new Set([
  "brighthome-electrical",
  "assemble-pro-kenya",
  "sparkle-clean-services",
  "coolcare-appliances",
]);

export async function consolidateLocalPersonas(client) {
  const personas = {};
  for (const spec of localPersonaSpecs) {
    const user = await ensureAuthUser(client, spec);
    const profile = await ensureAccountProfile(client, spec, user.id);
    personas[spec.key] = { ...spec, authUserId: user.id, profileId: profile.id };
  }

  const roles = await client.query(
    `select key, id from roles where key in ('owner', 'platform_admin')`,
  );
  const roleIds = Object.fromEntries(roles.rows.map((row) => [row.key, row.id]));
  if (!roleIds.owner || !roleIds.platform_admin) {
    throw new Error("Local persona cleanup requires owner and platform_admin roles.");
  }

  const survivorProfileIds = Object.values(personas).map(
    (persona) => persona.profileId,
  );
  const profiles = await client.query(
    `select
       ap.id,
       ap.auth_user_id,
       ap.display_name,
       ap.primary_email,
       exists (
         select 1 from platform_role_assignments pra
         join roles r on r.id = pra.role_id
         where pra.account_profile_id = ap.id
           and pra.status = 'active'
           and r.scope = 'platform'
       ) as has_platform_role,
       coalesce(array_agg(o.slug) filter (where om.id is not null), '{}') as organisation_slugs
     from account_profiles ap
     left join organisation_memberships om on om.account_profile_id = ap.id
     left join organisations o on o.id = om.organisation_id
     group by ap.id
     order by ap.created_at, ap.id`,
  );

  const mappings = new Map();
  for (const profile of profiles.rows) {
    if (survivorProfileIds.includes(profile.id)) continue;
    mappings.set(profile.id, selectTargetProfile(profile, personas));
  }

  await consolidateMemberships(client, mappings, personas, roleIds.owner);
  await createPersonaMapping(client, mappings);
  await consolidateUniqueAccountReferences(client);
  await remapAccountProfileReferences(client);

  await client.query(`delete from platform_role_assignments`);
  await client.query(
    `insert into platform_role_assignments (account_profile_id,role_id,status)
     values ($1,$2,'active')`,
    [personas.administrator.profileId, roleIds.platform_admin],
  );

  await ensureProfessionalCoverage(client, personas, roleIds.owner);

  await client.query(
    `delete from account_profiles where not (id = any($1::uuid[]))`,
    [survivorProfileIds],
  );

  const survivorAuthUserIds = Object.values(personas).map(
    (persona) => persona.authUserId,
  );
  await client.query(`delete from session`);
  await client.query(`delete from verification`);
  await client.query(`delete from account`);
  for (const persona of Object.values(personas)) {
    await client.query(
      `insert into account (id,account_id,provider_id,user_id,password)
       values ($1,$2,'credential',$2,$3)`,
      [
        `local-persona-${persona.key}-credential`,
        persona.authUserId,
        await hashPassword(persona.password),
      ],
    );
  }
  await client.query(`delete from "user" where not (id = any($1::text[]))`, [
    survivorAuthUserIds,
  ]);

  return { personas, roleIds };
}

async function ensureAuthUser(client, spec) {
  const existing = await client.query(
    `select id from "user" where email=$1 limit 1`,
    [spec.email],
  );
  if (existing.rows[0]) {
    const result = await client.query(
      `update "user" set
         name=$1,
         email_verified=true,
         terms_accepted=true,
         privacy_accepted=true,
         updated_at=now()
       where id=$2
       returning id`,
      [spec.name, existing.rows[0].id],
    );
    return result.rows[0];
  }
  const result = await client.query(
    `insert into "user" (
       id,name,email,email_verified,terms_accepted,privacy_accepted
     ) values ($1,$2,$3,true,true,true)
     returning id`,
    [spec.fallbackAuthUserId, spec.name, spec.email],
  );
  return result.rows[0];
}

async function ensureAccountProfile(client, spec, authUserId) {
  const existing = await client.query(
    `select id from account_profiles where primary_email=$1 limit 1`,
    [spec.email],
  );
  if (existing.rows[0]) {
    const result = await client.query(
      `update account_profiles set
         auth_user_id=$1,
         display_name=$2,
         timezone='Africa/Nairobi',
         status='active',
         terms_accepted_at=coalesce(terms_accepted_at,now()),
         privacy_accepted_at=coalesce(privacy_accepted_at,now()),
         deactivated_at=null,
         updated_at=now()
       where id=$3
       returning id`,
      [authUserId, spec.name, existing.rows[0].id],
    );
    return result.rows[0];
  }
  const result = await client.query(
    `insert into account_profiles (
       id,auth_user_id,display_name,primary_email,timezone,status,
       terms_accepted_at,privacy_accepted_at
     ) values ($1,$2,$3,$4,'Africa/Nairobi','active',now(),now())
     returning id`,
    [spec.fallbackProfileId, authUserId, spec.name, spec.email],
  );
  return result.rows[0];
}

function selectTargetProfile(profile, personas) {
  if (profile.has_platform_role) return personas.administrator.profileId;
  const identity = `${profile.auth_user_id} ${profile.display_name} ${profile.primary_email}`.toLowerCase();
  const organisationSlugs = profile.organisation_slugs ?? [];
  if (
    organisationSlugs.length > 0 ||
    /(professional|scheduler|owner|technician|team|\bpro\b)/.test(identity)
  ) {
    return organisationSlugs.some(
      (slug) => graceOrganisationSlugs.has(slug) || slug.startsWith("local-flow-plumbing"),
    )
      ? personas.professionalJourney.profileId
      : personas.professionalPrimary.profileId;
  }
  return personas.clientPrimary.profileId;
}

async function consolidateMemberships(client, mappings, personas, ownerRoleId) {
  const references = await membershipReferences(client);
  const memberships = await client.query(
    `select om.id,om.organisation_id,om.account_profile_id,o.slug
     from organisation_memberships om
     join organisations o on o.id=om.organisation_id
     order by om.created_at,om.id`,
  );
  const survivorIds = new Set(
    Object.values(personas).map((persona) => persona.profileId),
  );
  for (const membership of memberships.rows) {
    if (survivorIds.has(membership.account_profile_id)) continue;
    const targetProfileId =
      graceOrganisationSlugs.has(membership.slug) ||
      membership.slug.startsWith("local-flow-plumbing")
        ? personas.professionalJourney.profileId
        : personas.professionalPrimary.profileId;
    mappings.set(membership.account_profile_id, targetProfileId);
    await mergeMembership(client, membership, targetProfileId, references);
  }

  const coveredOrganisations = await client.query(
    `select distinct o.id,o.slug
     from organisations o
     where o.status='active'
       and (
         exists (
           select 1 from professional_services ps
           where ps.organisation_id=o.id
             and ps.status='published'
             and ps.moderation_status='clear'
         )
         or exists (
           select 1 from service_requests sr where sr.organisation_id=o.id
         )
       )
     order by o.slug`,
  );
  for (const organisation of coveredOrganisations.rows) {
    const targetProfileId =
      graceOrganisationSlugs.has(organisation.slug) ||
      organisation.slug.startsWith("local-flow-plumbing")
        ? personas.professionalJourney.profileId
        : personas.professionalPrimary.profileId;
    await client.query(
      `insert into organisation_memberships (
         organisation_id,account_profile_id,role_id,status,
         assigned_jobs_only,financial_data_access
       ) values ($1,$2,$3,'active',false,true)
       on conflict (organisation_id,account_profile_id) do update set
         role_id=excluded.role_id,
         status='active',
         assigned_jobs_only=false,
         financial_data_access=true,
         updated_at=now()`,
      [organisation.id, targetProfileId, ownerRoleId],
    );
  }
}

async function mergeMembership(
  client,
  membership,
  targetProfileId,
  references,
) {
  const existing = await client.query(
    `select id from organisation_memberships
     where organisation_id=$1 and account_profile_id=$2 and id<>$3
     limit 1`,
    [membership.organisation_id, targetProfileId, membership.id],
  );
  if (!existing.rows[0]) {
    await client.query(
      `update organisation_memberships set account_profile_id=$1,updated_at=now()
       where id=$2`,
      [targetProfileId, membership.id],
    );
    return;
  }

  const targetMembershipId = existing.rows[0].id;
  await client.query(
    `delete from availability_rules old_rule
     where old_rule.membership_id=$1
       and exists (
         select 1 from availability_rules target_rule
         where target_rule.membership_id=$2
           and target_rule.weekday=old_rule.weekday
           and target_rule.start_minute=old_rule.start_minute
           and target_rule.end_minute=old_rule.end_minute
       )`,
    [membership.id, targetMembershipId],
  );
  await client.query(
    `update job_assignments old_assignment set active=false,unassigned_at=coalesce(unassigned_at,now())
     where old_assignment.membership_id=$1
       and old_assignment.active=true
       and exists (
         select 1 from job_assignments target_assignment
         where target_assignment.job_id=old_assignment.job_id
           and target_assignment.membership_id=$2
           and target_assignment.active=true
       )`,
    [membership.id, targetMembershipId],
  );

  for (const reference of references) {
    await client.query(
      `update "${reference.table_name}" set "${reference.column_name}"=$1
       where "${reference.column_name}"=$2`,
      [targetMembershipId, membership.id],
    );
  }
  await client.query(`delete from organisation_memberships where id=$1`, [
    membership.id,
  ]);
}

async function createPersonaMapping(client, mappings) {
  await client.query(
    `create temporary table local_persona_mapping (
       source_id uuid primary key,
       target_id uuid not null
     ) on commit drop`,
  );
  if (mappings.size === 0) return;
  const values = [...mappings.entries()];
  const parameters = values.flatMap(([sourceId, targetId]) => [
    sourceId,
    targetId,
  ]);
  const placeholders = values
    .map((_, index) => `($${index * 2 + 1},$${index * 2 + 2})`)
    .join(",");
  await client.query(
    `insert into local_persona_mapping (source_id,target_id) values ${placeholders}`,
    parameters,
  );
}

async function consolidateUniqueAccountReferences(client) {
  await client.query(
    `delete from engagement_conversation_reads source
     using local_persona_mapping mapping
     where source.account_id=mapping.source_id
       and exists (
         select 1 from engagement_conversation_reads target
           where target.account_id=mapping.target_id
             and target.conversation_id=source.conversation_id
             and target.participant_role=source.participant_role
         )`,
  );
  await client.query(
    `update engagement_conversation_reads target
     set account_id=mapping.target_id
     from local_persona_mapping mapping
     where target.account_id=mapping.source_id`,
  );

  await client.query(
    `delete from notifications source
     using local_persona_mapping mapping
     where source.recipient_account_id=mapping.source_id
         and exists (
           select 1 from notifications target
           where target.recipient_account_id=mapping.target_id
             and target.source_event_id=source.source_event_id
         )`,
  );
  await client.query(
    `update notifications target
     set recipient_account_id=mapping.target_id
     from local_persona_mapping mapping
     where target.recipient_account_id=mapping.source_id`,
  );

  await client.query(
    `delete from review_reports source
     using local_persona_mapping mapping
     where source.reported_by_account_id=mapping.source_id
         and exists (
           select 1 from review_reports target
           where target.reported_by_account_id=mapping.target_id
             and target.review_id=source.review_id
         )`,
  );
  await client.query(
    `update review_reports target
     set reported_by_account_id=mapping.target_id
     from local_persona_mapping mapping
     where target.reported_by_account_id=mapping.source_id`,
  );

  await client.query(
    `delete from saved_professionals source
     using local_persona_mapping mapping
     where source.account_profile_id=mapping.source_id
         and exists (
           select 1 from saved_professionals target
           where target.account_profile_id=mapping.target_id
             and target.organisation_id=source.organisation_id
         )`,
  );
  await client.query(
    `update saved_professionals target
     set account_profile_id=mapping.target_id
     from local_persona_mapping mapping
     where target.account_profile_id=mapping.source_id`,
  );

  await client.query(
    `update customer_records source set account_profile_id=null
     from local_persona_mapping mapping
     where source.account_profile_id=mapping.source_id
         and exists (
           select 1 from customer_records target
           where target.account_profile_id=mapping.target_id
             and target.organisation_id=source.organisation_id
         )`,
  );
  await client.query(
    `with ranked as (
       select
         source.id,
         row_number() over (
           partition by source.organisation_id,mapping.target_id
           order by source.created_at,source.id
         ) as position
       from customer_records source
       join local_persona_mapping mapping
         on mapping.source_id=source.account_profile_id
     )
     update customer_records target set account_profile_id=null
     from ranked
     where target.id=ranked.id and ranked.position>1`,
  );
  await client.query(
    `update customer_records target
     set account_profile_id=mapping.target_id
     from local_persona_mapping mapping
     where target.account_profile_id=mapping.source_id`,
  );
}

async function remapAccountProfileReferences(client) {
  const excluded = new Set([
    "customer_records.account_profile_id",
    "engagement_conversation_reads.account_id",
    "notifications.recipient_account_id",
    "organisation_memberships.account_profile_id",
    "platform_role_assignments.account_profile_id",
    "quotation_versions.created_by_account_id",
    "review_reports.reported_by_account_id",
    "saved_professionals.account_profile_id",
  ]);

  // This guarded local-only consolidation changes the actor FK, not the quoted
  // commercial terms. The production immutability trigger deliberately treats
  // both as immutable, so suspend only that trigger for this identity remap.
  await client.query(
    `alter table quotation_versions disable trigger quotation_versions_terms_immutable`,
  );
  await client.query(
    `update quotation_versions target
     set created_by_account_id=mapping.target_id
     from local_persona_mapping mapping
     where target.created_by_account_id=mapping.source_id`,
  );
  await client.query(
    `alter table quotation_versions enable trigger quotation_versions_terms_immutable`,
  );

  const references = await accountProfileReferences(client);
  for (const reference of references) {
    if (excluded.has(`${reference.table_name}.${reference.column_name}`)) {
      continue;
    }
    await client.query(
      `update "${reference.table_name}" target
       set "${reference.column_name}"=mapping.target_id
       from local_persona_mapping mapping
       where target."${reference.column_name}"=mapping.source_id`,
    );
  }
}

async function ensureProfessionalCoverage(client, personas, ownerRoleId) {
  const professionalIds = [
    personas.professionalPrimary.profileId,
    personas.professionalJourney.profileId,
  ];
  await client.query(
    `delete from organisation_memberships
     where account_profile_id <> all($1::uuid[])
       and organisation_id in (
         select organisation_id from professional_services
         where status='published' and moderation_status='clear'
       )`,
    [professionalIds],
  );
  await client.query(
    `update organisation_memberships set role_id=$1,status='active',updated_at=now()
     where account_profile_id = any($2::uuid[])`,
    [ownerRoleId, professionalIds],
  );
}

async function accountProfileReferences(client) {
  const result = await client.query(`
    select tc.table_name,kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name=tc.constraint_name
      and kcu.constraint_schema=tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name=tc.constraint_name
      and ccu.constraint_schema=tc.constraint_schema
    where tc.constraint_type='FOREIGN KEY'
      and ccu.table_schema='public'
      and ccu.table_name='account_profiles'
      and ccu.column_name='id'
    order by tc.table_name,kcu.column_name
  `);
  return result.rows;
}

async function membershipReferences(client) {
  const result = await client.query(`
    select tc.table_name,kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name=tc.constraint_name
      and kcu.constraint_schema=tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name=tc.constraint_name
      and ccu.constraint_schema=tc.constraint_schema
    where tc.constraint_type='FOREIGN KEY'
      and ccu.table_schema='public'
      and ccu.table_name='organisation_memberships'
      and ccu.column_name='id'
    order by tc.table_name,kcu.column_name
  `);
  return result.rows;
}

export async function verifyLocalPersonaInvariant(client) {
  const emails = localPersonaSpecs.map((persona) => persona.email);
  const result = await client.query(
    `select
       (select count(*)::int from "user") as user_count,
       (select count(*)::int from account_profiles) as profile_count,
       (select count(*)::int from account where provider_id='credential') as credential_count,
       (select count(*)::int
        from account_profiles ap
        where not exists (
          select 1 from account a
          where a.user_id=ap.auth_user_id
            and a.provider_id='credential'
        )) as profiles_without_credentials,
       (select count(*)::int
        from account_profiles
        where not (primary_email = any($1::text[]))) as unexpected_profiles,
       (select count(*)::int
        from platform_role_assignments pra
        join account_profiles ap on ap.id=pra.account_profile_id
        join roles r on r.id=pra.role_id
        where pra.status='active'
          and (ap.primary_email<>'admin@gmail.com' or r.key<>'platform_admin'))
         as invalid_platform_assignments`,
    [emails],
  );
  return result.rows[0];
}
