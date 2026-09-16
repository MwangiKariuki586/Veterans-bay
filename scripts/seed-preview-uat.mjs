import fs from "node:fs";
import { createHash } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";
import sharp from "sharp";

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify");
const confirmedPreview = args.has("--confirm-preview");
const envFile = ".env.preview.local";

if (!fs.existsSync(envFile)) {
  throw new Error(`${envFile} is required. The UAT seed never falls back to .env.`);
}

const env = dotenv.parse(fs.readFileSync(envFile));
const databaseUrl = env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(`DATABASE_URL is missing from ${envFile}.`);
}

const target = new URL(databaseUrl);
if (!target.hostname.includes("neon.tech")) {
  throw new Error("The UAT seed target must be a Neon PostgreSQL database.");
}

if (!verifyOnly && !confirmedPreview) {
  throw new Error("Pass --confirm-preview to seed the controlled preview database.");
}

const password = process.env.UAT_SEED_PASSWORD;
if (!verifyOnly && (!password || password.length < 16)) {
  throw new Error("UAT_SEED_PASSWORD must contain at least 16 characters.");
}

const ids = {
  profiles: {
    client: "10000000-0000-4000-8000-000000000001",
    owner: "10000000-0000-4000-8000-000000000002",
    technician: "10000000-0000-4000-8000-000000000003",
    admin: "10000000-0000-4000-8000-000000000004",
    applicant: "10000000-0000-4000-8000-000000000005",
  },
  organisations: {
    provider: "20000000-0000-4000-8000-000000000001",
    applicant: "20000000-0000-4000-8000-000000000002",
  },
  memberships: {
    owner: "30000000-0000-4000-8000-000000000001",
    technician: "30000000-0000-4000-8000-000000000002",
    applicant: "30000000-0000-4000-8000-000000000003",
  },
  professionalProfiles: {
    provider: "40000000-0000-4000-8000-000000000001",
    applicant: "40000000-0000-4000-8000-000000000002",
  },
  service: "50000000-0000-4000-8000-000000000001",
  serviceSnapshot: "51000000-0000-4000-8000-000000000001",
  assets: {
    logo: "52000000-0000-4000-8000-000000000001",
    verification: "52000000-0000-4000-8000-000000000002",
    verificationLink: "53000000-0000-4000-8000-000000000001",
  },
  requests: {
    submitted: "60000000-0000-4000-8000-000000000001",
    quoted: "60000000-0000-4000-8000-000000000002",
  },
  requestKeys: {
    submitted: "61000000-0000-4000-8000-000000000001",
    quoted: "61000000-0000-4000-8000-000000000002",
  },
  quotation: "70000000-0000-4000-8000-000000000001",
  quotationVersion: "71000000-0000-4000-8000-000000000001",
  quotationLine: "72000000-0000-4000-8000-000000000001",
  bookings: {
    upcoming: "80000000-0000-4000-8000-000000000001",
    active: "80000000-0000-4000-8000-000000000002",
    completed: "80000000-0000-4000-8000-000000000003",
    disputed: "80000000-0000-4000-8000-000000000004",
  },
  reservation: "81000000-0000-4000-8000-000000000001",
  jobs: {
    upcoming: "90000000-0000-4000-8000-000000000001",
    active: "90000000-0000-4000-8000-000000000002",
    completed: "90000000-0000-4000-8000-000000000003",
    disputed: "90000000-0000-4000-8000-000000000004",
  },
  invoice: "a0000000-0000-4000-8000-000000000001",
  customerRecord: "a2000000-0000-4000-8000-000000000001",
  warranty: "b0000000-0000-4000-8000-000000000001",
  warrantyClaim: "b1000000-0000-4000-8000-000000000001",
  report: "c0000000-0000-4000-8000-000000000001",
  dispute: "d0000000-0000-4000-8000-000000000001",
  platformRule: "e0000000-0000-4000-8000-000000000001",
};

const users = [
  { key: "client", id: "uat-client-v1", name: "UAT Client", email: "uat.client@veterans-bay.invalid" },
  { key: "owner", id: "uat-owner-v1", name: "UAT Professional Owner", email: "uat.owner@veterans-bay.invalid" },
  { key: "technician", id: "uat-technician-v1", name: "UAT Field Technician", email: "uat.technician@veterans-bay.invalid" },
  { key: "admin", id: "uat-admin-v1", name: "UAT Platform Administrator", email: "uat.admin@veterans-bay.invalid" },
  { key: "applicant", id: "uat-applicant-v1", name: "UAT Professional Applicant", email: "uat.applicant@veterans-bay.invalid" },
];

const pool = new Pool({ connectionString: databaseUrl });

function cloudinaryConfig() {
  const localEnv = fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {};
  const cloudName = localEnv.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = localEnv.CLOUDINARY_API_KEY?.trim();
  const apiSecret = localEnv.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials from .env are required to prepare reviewable UAT evidence.");
  }
  return { cloudName, apiKey, apiSecret };
}

async function uploadSyntheticAsset({ folder, publicId, resourceType, type, buffer, filename }) {
  const config = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = { folder, public_id: publicId, timestamp: String(timestamp), type };
  const toSign = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");
  const signature = createHash("sha1")
    .update(`${toSign}${config.apiSecret}`)
    .digest("hex");
  const form = new FormData();
  for (const [key, value] of Object.entries(parameters)) form.append(key, value);
  form.append("api_key", config.apiKey);
  form.append("signature", signature);
  form.append("file", new Blob([buffer], { type: "image/png" }), filename);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    throw new Error(`Cloudinary UAT asset upload failed with status ${response.status}.`);
  }
  const result = await response.json();
  return { publicId: result.public_id, sizeBytes: result.bytes };
}

async function prepareApplicationAssets(client) {
  const assetSpecs = [
    {
      key: "logo",
      id: ids.assets.logo,
      folder: "veterans-bay/logos",
      publicId: "uat-preview-logo-v1",
      resourceType: "image",
      type: "upload",
      purpose: "PROFESSIONAL_LOGO",
      visibility: "public",
      filename: "uat-preview-logo.png",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="#173d35"/><text x="256" y="235" text-anchor="middle" font-family="Arial" font-size="96" font-weight="700" fill="#ffffff">VB</text><text x="256" y="325" text-anchor="middle" font-family="Arial" font-size="54" fill="#f2bd5a">UAT</text></svg>`,
    },
    {
      key: "verification",
      id: ids.assets.verification,
      folder: "veterans-bay/verification",
      publicId: "uat-preview-verification-v1.png",
      resourceType: "raw",
      type: "authenticated",
      purpose: "VERIFICATION_DOCUMENT",
      visibility: "private",
      filename: "uat-preview-verification.png",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="#f8f5ed"/><rect x="80" y="80" width="1040" height="1440" rx="30" fill="#ffffff" stroke="#173d35" stroke-width="8"/><text x="600" y="260" text-anchor="middle" font-family="Arial" font-size="62" font-weight="700" fill="#173d35">CONTROLLED PREVIEW</text><text x="600" y="360" text-anchor="middle" font-family="Arial" font-size="54" font-weight="700" fill="#173d35">UAT VERIFICATION EVIDENCE</text><text x="600" y="540" text-anchor="middle" font-family="Arial" font-size="38" fill="#333333">Synthetic business registration document</text><text x="600" y="620" text-anchor="middle" font-family="Arial" font-size="38" fill="#333333">Reference: UAT-PENDING-001</text><text x="600" y="820" text-anchor="middle" font-family="Arial" font-size="42" font-weight="700" fill="#a33a2b">NO REAL IDENTITY OR BUSINESS DATA</text><text x="600" y="910" text-anchor="middle" font-family="Arial" font-size="36" fill="#333333">For Veterans Bay preview testing only</text><text x="600" y="1390" text-anchor="middle" font-family="Arial" font-size="32" fill="#666666">Generated synthetic evidence</text></svg>`,
    },
  ];
  const prepared = {};
  for (const spec of assetSpecs) {
    const current = await client.query(
      `select cloudinary_public_id, size_bytes from file_assets where id = $1`,
      [spec.id],
    );
    const expectedPublicId = `${spec.folder}/${spec.publicId}`;
    if (current.rowCount === 1 && current.rows[0].cloudinary_public_id === expectedPublicId) {
      prepared[spec.key] = {
        ...spec,
        publicId: current.rows[0].cloudinary_public_id,
        sizeBytes: Number(current.rows[0].size_bytes),
      };
      continue;
    }
    const buffer = await sharp(Buffer.from(spec.svg)).png().toBuffer();
    const uploaded = await uploadSyntheticAsset({ ...spec, buffer });
    prepared[spec.key] = { ...spec, ...uploaded };
  }
  return prepared;
}

async function insertApplicationAssetRecords(client, assets) {
  for (const asset of Object.values(assets)) {
    await client.query(
      `insert into file_assets
        (id, cloudinary_public_id, purpose, mime_type, size_bytes, visibility, owner_account_id, organisation_id, linked_entity_type, linked_entity_id, status)
       values ($1, $2, $3, 'image/png', $4, $5, $6, $7, 'professional_profile', $8, 'ready')
       on conflict (id) do update set
         cloudinary_public_id = excluded.cloudinary_public_id,
         purpose = excluded.purpose,
         mime_type = excluded.mime_type,
         size_bytes = excluded.size_bytes,
         visibility = excluded.visibility,
         owner_account_id = excluded.owner_account_id,
         organisation_id = excluded.organisation_id,
         linked_entity_type = excluded.linked_entity_type,
         linked_entity_id = excluded.linked_entity_id,
         status = excluded.status,
         updated_at = now()`,
      [
        asset.id,
        asset.publicId,
        asset.purpose,
        asset.sizeBytes,
        asset.visibility,
        ids.profiles.applicant,
        ids.organisations.applicant,
        ids.professionalProfiles.applicant,
      ],
    );
  }
}

async function linkApplicationAssets(client) {
  await client.query(
    `update professional_profiles
     set logo_asset_id = $2,
         description = case when char_length(description) < 80 then $3 else description end,
         updated_at = now()
     where id = $1`,
    [
      ids.professionalProfiles.applicant,
      ids.assets.logo,
      "Synthetic pending applicant prepared for complete administrator review in the isolated controlled-preview environment.",
    ],
  );
  await client.query(
    `insert into professional_verification_documents
      (id, professional_profile_id, asset_id, document_type)
     values ($1, $2, $3, 'Synthetic business registration')
     on conflict (id) do nothing`,
    [ids.assets.verificationLink, ids.professionalProfiles.applicant, ids.assets.verification],
  );
}

async function ensureCustomerRecord(client) {
  await client.query(
    `insert into customer_records
      (id, organisation_id, account_profile_id, display_name, email, acquisition_source, status, created_by_account_id, reconciled_at)
     values ($1, $2, $3, 'UAT Client', 'uat.client@veterans-bay.invalid', 'MARKETPLACE_ACQUIRED', 'REGISTERED', $4, now())
     on conflict (id) do nothing`,
    [ids.customerRecord, ids.organisations.provider, ids.profiles.client, ids.profiles.owner],
  );
}

function offsetDate(days, hours = 0) {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000);
}

async function verifySeed(client) {
  const checks = [
    ["five login-capable UAT personas", `select count(*)::int = 5 as passed from "user" where email like 'uat.%@veterans-bay.invalid'`],
    ["provider and pending applicant organisations", `select count(*)::int = 2 as passed from organisations where id in ('${ids.organisations.provider}', '${ids.organisations.applicant}')`],
    ["owner, assigned technician, and applicant memberships", `select count(*)::int = 3 as passed from organisation_memberships where id in ('${ids.memberships.owner}', '${ids.memberships.technician}', '${ids.memberships.applicant}') and status = 'active'`],
    ["dedicated platform administrator authority", `select exists(select 1 from platform_role_assignments pra join roles r on r.id = pra.role_id join role_permissions rp on rp.role_id = r.id join permissions p on p.id = rp.permission_id where pra.account_profile_id = '${ids.profiles.admin}' and pra.status = 'active' and r.key = 'platform_admin' and p.key = 'platform.admin') as passed`],
    ["verified professional and complete pending application", `select exists(select 1 from professional_profiles pp where pp.id = '${ids.professionalProfiles.applicant}' and pp.verification_status = 'pending' and pp.logo_asset_id = '${ids.assets.logo}' and char_length(pp.description) >= 80 and pp.business_type is not null and pp.primary_category is not null and pp.phone is not null and pp.email is not null and pp.operating_location is not null and jsonb_array_length(pp.service_areas) > 0 and pp.terms_accepted = true and exists(select 1 from professional_verification_documents pvd join file_assets fa on fa.id = pvd.asset_id where pvd.professional_profile_id = pp.id and fa.id = '${ids.assets.verification}' and fa.status = 'ready' and fa.visibility = 'private')) as passed`],
    ["published service with immutable snapshot", `select exists(select 1 from professional_services ps join professional_service_snapshots pss on pss.service_id = ps.id and pss.version = ps.version where ps.id = '${ids.service}' and ps.status = 'published' and ps.moderation_status = 'clear') as passed`],
    ["submitted and quoted service requests", `select count(distinct status)::int = 2 as passed from service_requests where id in ('${ids.requests.submitted}', '${ids.requests.quoted}') and status in ('SUBMITTED', 'QUOTED')`],
    ["eligible submitted quotation", `select exists(select 1 from quotations q join quotation_versions qv on qv.quotation_id = q.id where q.id = '${ids.quotation}' and q.status = 'SUBMITTED' and qv.status = 'SUBMITTED') as passed`],
    ["upcoming, active, completed, and disputed jobs", `select count(distinct status)::int = 4 as passed from jobs where id in ('${ids.jobs.upcoming}', '${ids.jobs.active}', '${ids.jobs.completed}', '${ids.jobs.disputed}') and status in ('TEAM_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')`],
    ["issued unpaid invoice", `select exists(select 1 from invoices i where i.id = '${ids.invoice}' and i.status = 'ISSUED' and not exists(select 1 from payment_allocations pa join invoice_items ii on ii.id = pa.invoice_item_id where ii.invoice_id = i.id)) as passed`],
    ["active warranty with escalated claim", `select exists(select 1 from warranties w join warranty_claims wc on wc.warranty_id = w.id where w.id = '${ids.warranty}' and w.status = 'ACTIVE' and wc.status = 'ESCALATED') as passed`],
    ["registered customer with completed history", `select exists(select 1 from customer_records cr join bookings b on b.organisation_id = cr.organisation_id and b.client_account_id = cr.account_profile_id where cr.id = '${ids.customerRecord}' and cr.status = 'REGISTERED' and b.id = '${ids.bookings.completed}' and b.status = 'COMPLETED') as passed`],
    ["open moderation report and dispute", `select exists(select 1 from moderation_reports where id = '${ids.report}' and status = 'OPEN') and exists(select 1 from disputes where id = '${ids.dispute}' and status = 'OPEN') as passed`],
    ["active platform rule", `select exists(select 1 from platform_rules where id = '${ids.platformRule}' and status = 'ACTIVE') as passed`],
    ["persona notifications", `select count(*)::int >= 4 as passed from notifications where recipient_account_id in ('${ids.profiles.client}', '${ids.profiles.owner}', '${ids.profiles.technician}', '${ids.profiles.admin}') and source_event_type like 'uat.%'`],
  ];

  let failed = false;
  for (const [label, sql] of checks) {
    const result = await client.query(sql);
    const passed = result.rows[0]?.passed === true;
    console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
    failed ||= !passed;
  }

  if (failed) {
    throw new Error("The preview UAT seed verification failed.");
  }
}

async function seed(client) {
  const existing = await client.query(
    `select count(*)::int as count from "user" where email like 'uat.%@veterans-bay.invalid'`,
  );
  const uploadedAssets = await prepareApplicationAssets(client);
  if (existing.rows[0].count > 0) {
    await client.query("begin");
    try {
      await insertApplicationAssetRecords(client, uploadedAssets);
      await linkApplicationAssets(client);
      await ensureCustomerRecord(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    console.log("UAT seed records already exist; preserving their current workflow state and completing required application assets.");
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const upcomingStart = offsetDate(7);
  const upcomingEnd = new Date(upcomingStart.getTime() + 90 * 60 * 1000);
  const activeStart = offsetDate(0, -1);
  const activeEnd = new Date(activeStart.getTime() + 2 * 60 * 60 * 1000);
  const completedStart = offsetDate(-3);
  const completedEnd = new Date(completedStart.getTime() + 90 * 60 * 1000);
  const disputedStart = offsetDate(-5);
  const disputedEnd = new Date(disputedStart.getTime() + 2 * 60 * 60 * 1000);

  await client.query("begin");
  try {
    for (const user of users) {
      await client.query(
        `insert into "user" (id, name, email, email_verified, terms_accepted, privacy_accepted)
         values ($1, $2, $3, true, true, true)`,
        [user.id, user.name, user.email],
      );
      await client.query(
        `insert into account (id, account_id, provider_id, user_id, password)
         values ($1, $2, 'credential', $2, $3)`,
        [`uat-credential-${user.key}-v1`, user.id, passwordHash],
      );
      await client.query(
        `insert into account_profiles
          (id, auth_user_id, display_name, primary_email, timezone, status, terms_accepted_at, privacy_accepted_at)
         values ($1, $2, $3, $4, 'Africa/Nairobi', 'active', $5, $5)`,
        [ids.profiles[user.key], user.id, user.name, user.email, now],
      );
    }

    await client.query(
      `insert into organisations (id, name, slug, status) values
       ($1, 'UAT Home Services', 'uat-home-services', 'active'),
       ($2, 'UAT Applicant Services', 'uat-applicant-services', 'pending_review')`,
      [ids.organisations.provider, ids.organisations.applicant],
    );
    await insertApplicationAssetRecords(client, uploadedAssets);
    await ensureCustomerRecord(client);

    const roles = await client.query(
      `select key, id from roles where key in ('owner', 'technician', 'platform_admin')`,
    );
    const roleIds = Object.fromEntries(roles.rows.map((role) => [role.key, role.id]));
    if (!roleIds.owner || !roleIds.technician || !roleIds.platform_admin) {
      throw new Error("Required owner, technician, and platform_admin roles are not seeded.");
    }

    await client.query(
      `insert into organisation_memberships
        (id, organisation_id, account_profile_id, role_id, status, assigned_jobs_only, financial_data_access)
       values
        ($1, $4, $6, $9, 'active', false, true),
        ($2, $4, $7, $10, 'active', true, false),
        ($3, $5, $8, $9, 'active', false, true)`,
      [
        ids.memberships.owner,
        ids.memberships.technician,
        ids.memberships.applicant,
        ids.organisations.provider,
        ids.organisations.applicant,
        ids.profiles.owner,
        ids.profiles.technician,
        ids.profiles.applicant,
        roleIds.owner,
        roleIds.technician,
      ],
    );
    await client.query(
      `insert into platform_role_assignments (account_profile_id, role_id, status)
       values ($1, $2, 'active')`,
      [ids.profiles.admin, roleIds.platform_admin],
    );

    const workingHours = {
      monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      tuesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      wednesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      thursday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      friday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      saturday: { enabled: false, opensAt: "08:00", closesAt: "17:00" },
      sunday: { enabled: false, opensAt: "08:00", closesAt: "17:00" },
    };
    await client.query(
      `insert into professional_profiles
        (id, organisation_id, business_type, primary_category, description, phone, email, operating_location, service_areas, working_hours, logo_asset_id, verification_type, verification_reference, verification_status, terms_accepted, terms_accepted_at, submitted_at)
       values
        ($1, $3, 'business', 'Plumbing', 'Synthetic approved provider for controlled-preview user acceptance testing in the isolated demonstration environment.', '+254700000101', 'uat.owner@veterans-bay.invalid', 'Nairobi', $5::jsonb, $6::jsonb, null, 'business_registration', 'UAT-VERIFIED-001', 'verified', true, $7, $7),
        ($2, $4, 'business', 'Electrical', 'Synthetic pending applicant prepared for complete administrator review in the isolated controlled-preview environment.', '+254700000102', 'uat.applicant@veterans-bay.invalid', 'Nairobi', $5::jsonb, $6::jsonb, $8, 'business_registration', 'UAT-PENDING-001', 'pending', true, $7, $7)`,
      [
        ids.professionalProfiles.provider,
        ids.professionalProfiles.applicant,
        ids.organisations.provider,
        ids.organisations.applicant,
        JSON.stringify(["Nairobi"]),
        JSON.stringify(workingHours),
        now,
        ids.assets.logo,
      ],
    );
    await linkApplicationAssets(client);
    await client.query(
      `insert into professional_onboarding_history
        (organisation_id, from_status, to_status, reason, actor_account_id)
       values
        ($1, 'pending_review', 'active', 'Controlled-preview UAT approved-provider baseline.', $3),
        ($2, 'draft', 'pending_review', 'Controlled-preview UAT application awaiting administrator review.', $4)`,
      [ids.organisations.provider, ids.organisations.applicant, ids.profiles.admin, ids.profiles.applicant],
    );

    await client.query(
      `insert into professional_services
        (id, organisation_id, slug, name, category, description, fulfilment_model, pricing_model, price_minor, currency, estimated_duration_minutes, service_areas, requirements, warranty_duration_days, warranty_terms, direct_booking_enabled, status, moderation_status, version, published_at)
       values
        ($1, $2, 'uat-plumbing-maintenance', 'UAT Plumbing Maintenance', 'Plumbing', 'Synthetic service for controlled-preview user acceptance testing.', 'on_site', 'fixed', 750000, 'KES', 90, '["Nairobi"]'::jsonb, '["Provide safe access to the affected fixture"]'::jsonb, 30, 'Thirty-day workmanship warranty for the agreed scope.', true, 'published', 'clear', 1, $3)`,
      [ids.service, ids.organisations.provider, now],
    );
    await client.query(
      `insert into professional_service_snapshots (id, service_id, version, snapshot)
       values ($1, $2, 1, $3::jsonb)`,
      [
        ids.serviceSnapshot,
        ids.service,
        JSON.stringify({
          name: "UAT Plumbing Maintenance",
          category: "Plumbing",
          priceMinor: 750000,
          currency: "KES",
          estimatedDurationMinutes: 90,
          warrantyDurationDays: 30,
          directBookingEnabled: true,
          marker: "controlled-preview-uat",
        }),
      ],
    );

    for (let weekday = 1; weekday <= 5; weekday += 1) {
      await client.query(
        `insert into availability_rules
          (organisation_id, membership_id, weekday, start_minute, end_minute, timezone, active, created_by_account_id)
         values ($1, $2, $3, 480, 1020, 'Africa/Nairobi', true, $4)`,
        [ids.organisations.provider, ids.memberships.technician, weekday, ids.profiles.owner],
      );
    }

    const requests = [
      [ids.requests.submitted, ids.requestKeys.submitted, "SUBMITTED", "Kitchen sink is leaking and needs inspection."],
      [ids.requests.quoted, ids.requestKeys.quoted, "QUOTED", "Bathroom pipe repair requiring a current quotation."],
    ];
    for (const [id, key, status, description] of requests) {
      await client.query(
        `insert into service_requests
          (id, client_account_id, organisation_id, preferred_service_id, idempotency_key, source, category, description, location, preferred_time, budget_min_minor, budget_max_minor, currency, urgency, contact_preference, status, submitted_at, expires_at)
         values ($1, $2, $3, $4, $5, 'DIRECT_SERVICE_PAGE', 'Plumbing', $6, 'Nairobi', 'Weekday morning', 500000, 1000000, 'KES', 'SOON', 'IN_APP', $7, $8, $9)`,
        [id, ids.profiles.client, ids.organisations.provider, ids.service, key, description, status, now, offsetDate(30)],
      );
      await client.query(
        `insert into service_request_history
          (request_id, actor_account_id, action, from_status, to_status, client_visible_note)
         values ($1, $2, 'submitted', 'DRAFT', 'SUBMITTED', 'Synthetic request prepared for controlled-preview UAT.')`,
        [id, ids.profiles.client],
      );
    }
    await client.query(
      `insert into service_request_history
        (request_id, actor_account_id, action, from_status, to_status, client_visible_note)
       values ($1, $2, 'quotation_submitted', 'SUBMITTED', 'QUOTED', 'A quotation is ready for review.')`,
      [ids.requests.quoted, ids.profiles.owner],
    );

    await client.query(
      `insert into quotations
        (id, request_id, organisation_id, client_account_id, created_by_account_id, status, current_version_number)
       values ($1, $2, $3, $4, $5, 'SUBMITTED', 1)`,
      [ids.quotation, ids.requests.quoted, ids.organisations.provider, ids.profiles.client, ids.profiles.owner],
    );
    await client.query(
      `insert into quotation_versions
        (id, quotation_id, version_number, status, currency, labour_minor, materials_minor, transport_minor, additional_charges_minor, subtotal_minor, discount_minor, tax_minor, total_minor, deposit_minor, expected_duration_minutes, proposed_start_at, valid_until, scope, exclusions, warranty_terms, payment_terms, created_by_account_id, submitted_at)
       values ($1, $2, 1, 'DRAFT', 'KES', 500000, 200000, 50000, 0, 750000, 0, 0, 750000, 0, 90, $3, $4, 'Inspect and repair the identified bathroom pipe.', 'Wall finishing and unrelated fixtures are excluded.', 'Thirty-day workmanship warranty.', 'Payment is recorded after client confirmation.', $5, null)`,
      [ids.quotationVersion, ids.quotation, offsetDate(7), offsetDate(14), ids.profiles.owner],
    );
    await client.query(
      `insert into quotation_line_items
        (id, quotation_version_id, category, description, quantity, unit_price_minor, total_minor, position)
       values ($1, $2, 'LABOUR', 'Controlled-preview plumbing repair quotation', 1, 750000, 750000, 0)`,
      [ids.quotationLine, ids.quotationVersion],
    );
    await client.query(
      `update quotation_versions
       set status = 'SUBMITTED', submitted_at = $2, updated_at = $2
       where id = $1`,
      [ids.quotationVersion, now],
    );
    await client.query(
      `insert into quotation_history
        (quotation_id, quotation_version_id, actor_account_id, action, from_status, to_status, note)
       values ($1, $2, $3, 'submitted', 'DRAFT', 'SUBMITTED', 'Synthetic eligible quotation for client acceptance UAT.')`,
      [ids.quotation, ids.quotationVersion, ids.profiles.owner],
    );

    const bookingRows = [
      [ids.bookings.upcoming, "CONFIRMED", upcomingStart, upcomingEnd],
      [ids.bookings.active, "CONFIRMED", activeStart, activeEnd],
      [ids.bookings.completed, "COMPLETED", completedStart, completedEnd],
      [ids.bookings.disputed, "COMPLETED", disputedStart, disputedEnd],
    ];
    for (const [id, status, startsAt, endsAt] of bookingRows) {
      await client.query(
        `insert into bookings
          (id, professional_service_id, organisation_id, client_account_id, created_by_account_id, assigned_membership_id, origin, status, currency, total_minor, deposit_minor, expected_duration_minutes, starts_at, ends_at, timezone, cancellation_acknowledged_at, scope, exclusions, warranty_terms, payment_terms, completed_at)
         values ($1, $2, $3, $4, $5, $6, 'DIRECT_SERVICE', $7, 'KES', 750000, 0, 90, $8, $9, 'Africa/Nairobi', $10, 'Inspect and repair the agreed plumbing fixture.', 'Wall finishing and unrelated fixtures are excluded.', 'Thirty-day workmanship warranty.', 'Payment is recorded after client confirmation.', $11)`,
        [id, ids.service, ids.organisations.provider, ids.profiles.client, ids.profiles.client, ids.memberships.technician, status, startsAt, endsAt, now, status === "COMPLETED" ? endsAt : null],
      );
    }
    await client.query(
      `insert into booking_reservations
        (id, booking_id, organisation_id, membership_id, starts_at, ends_at, status)
       values ($1, $2, $3, $4, $5, $6, 'ACTIVE')`,
      [ids.reservation, ids.bookings.upcoming, ids.organisations.provider, ids.memberships.technician, upcomingStart, upcomingEnd],
    );

    const jobRows = [
      [ids.jobs.upcoming, ids.bookings.upcoming, "TEAM_ASSIGNED", upcomingStart, upcomingEnd, null, null, null],
      [ids.jobs.active, ids.bookings.active, "IN_PROGRESS", activeStart, activeEnd, activeStart, activeStart, null],
      [ids.jobs.completed, ids.bookings.completed, "COMPLETED", completedStart, completedEnd, completedStart, completedStart, completedEnd],
      [ids.jobs.disputed, ids.bookings.disputed, "DISPUTED", disputedStart, disputedEnd, disputedStart, disputedStart, disputedEnd],
    ];
    for (const [id, bookingId, status, startsAt, endsAt, checkedInAt, startedAt, completedAt] of jobRows) {
      await client.query(
        `insert into jobs
          (id, booking_id, organisation_id, client_account_id, created_by_account_id, status, service_name, scope_snapshot, exclusions_snapshot, warranty_terms_snapshot, payment_terms_snapshot, currency, base_total_minor, approved_variation_total_minor, total_minor, scheduled_starts_at, scheduled_ends_at, checked_in_at, started_at, completed_at)
         values ($1, $2, $3, $4, $5, $6, 'UAT Plumbing Maintenance', 'Inspect and repair the agreed plumbing fixture.', 'Wall finishing and unrelated fixtures are excluded.', 'Thirty-day workmanship warranty.', 'Payment is recorded after client confirmation.', 'KES', 750000, 0, 750000, $7, $8, $9, $10, $11)`,
        [id, bookingId, ids.organisations.provider, ids.profiles.client, ids.profiles.owner, status, startsAt, endsAt, checkedInAt, startedAt, completedAt],
      );
      await client.query(
        `insert into job_assignments
          (job_id, organisation_id, membership_id, assigned_by_account_id, active, reason)
         values ($1, $2, $3, $4, true, 'Controlled-preview UAT technician assignment.')`,
        [id, ids.organisations.provider, ids.memberships.technician, ids.profiles.owner],
      );
    }

    const checklist = ["Inspect the affected fixture", "Complete the agreed repair", "Test and clean the work area"];
    for (let position = 0; position < checklist.length; position += 1) {
      const completed = position === 0;
      await client.query(
        `insert into job_checklist_items
          (job_id, label, required, position, completed, completed_by_account_id, completed_at, result_note)
         values ($1, $2, true, $3, $4, $5, $6, $7)`,
        [ids.jobs.active, checklist[position], position, completed, completed ? ids.profiles.technician : null, completed ? now : null, completed ? "Initial inspection completed during UAT." : null],
      );
    }
    await client.query(
      `insert into job_updates
        (job_id, created_by_account_id, update_type, visibility, content)
       values ($1, $2, 'PROGRESS', 'CLIENT', 'UAT technician has started the inspection; no real service is being performed.')`,
      [ids.jobs.active, ids.profiles.technician],
    );

    await client.query(
      `insert into invoices
        (id, job_id, organisation_id, client_account_id, created_by_account_id, invoice_number, status, currency, subtotal_minor, tax_minor, total_minor, notes, payment_terms_snapshot, issued_at, due_at)
       values ($1, $2, $3, $4, $5, 'UAT-INV-001', 'ISSUED', 'KES', 750000, 0, 750000, 'Controlled-preview record. Do not enter or represent real funds.', 'Payment is recorded after client confirmation.', $6, $7)`,
      [ids.invoice, ids.jobs.completed, ids.organisations.provider, ids.profiles.client, ids.profiles.owner, now, offsetDate(14)],
    );
    await client.query(
      `insert into invoice_items
        (invoice_id, source_type, source_id, description, quantity, unit_price_minor, total_minor, position)
       values ($1, 'JOB_BASE', $2, 'UAT Plumbing Maintenance', 1, 750000, 750000, 0)`,
      [ids.invoice, ids.jobs.completed],
    );

    await client.query(
      `insert into warranties
        (id, job_id, organisation_id, client_account_id, created_by_account_id, status, service_name_snapshot, terms_snapshot, exclusions_snapshot, starts_at, ends_at)
       values ($1, $2, $3, $4, $5, 'ACTIVE', 'UAT Plumbing Maintenance', 'Thirty-day workmanship warranty.', 'Damage outside the agreed scope is excluded.', $6, $7)`,
      [ids.warranty, ids.jobs.completed, ids.organisations.provider, ids.profiles.client, ids.profiles.owner, completedEnd, new Date(completedEnd.getTime() + 30 * 24 * 60 * 60 * 1000)],
    );
    await client.query(
      `insert into warranty_claims
        (id, warranty_id, sequence, status, submitted_by_account_id, subject, description, preferred_resolution, reviewed_by_account_id, escalated_at)
       values ($1, $2, 1, 'ESCALATED', $3, 'UAT workmanship follow-up', 'Synthetic escalated warranty claim for administrator testing.', 'Review the simulated workmanship concern.', $4, $5)`,
      [ids.warrantyClaim, ids.warranty, ids.profiles.client, ids.profiles.owner, now],
    );
    await client.query(
      `insert into warranty_claim_history
        (claim_id, actor_account_id, action, from_status, to_status, reason)
       values ($1, $2, 'escalated', 'UNDER_REVIEW', 'ESCALATED', 'Controlled-preview UAT escalation.')`,
      [ids.warrantyClaim, ids.profiles.owner],
    );

    await client.query(
      `insert into moderation_reports
        (id, submitted_by_account_id, organisation_id, category, subject_type, subject_id, summary, details, status)
       values ($1, $2, $3, 'MISLEADING_LISTING', 'professional_service', $4, 'UAT listing report', 'Synthetic report for controlled-preview moderation testing only.', 'OPEN')`,
      [ids.report, ids.profiles.client, ids.organisations.provider, ids.service],
    );
    await client.query(
      `insert into disputes
        (id, job_id, organisation_id, client_account_id, opened_by_account_id, assigned_to_account_id, reason, status)
       values ($1, $2, $3, $4, $4, $5, 'Synthetic payment disagreement for controlled-preview administrator testing.', 'OPEN')`,
      [ids.dispute, ids.jobs.disputed, ids.organisations.provider, ids.profiles.client, ids.profiles.admin],
    );
    await client.query(
      `insert into platform_rules
        (id, key, name, description, value, status, reason, updated_by_account_id)
       values ($1, 'uat.preview.activity', 'Controlled-preview activity', 'Defines the synthetic-only UAT boundary.', '{"realActivityAllowed":false,"simulatedPaymentsOnly":true}'::jsonb, 'ACTIVE', 'Seeded for controlled-preview rules-management UAT.', $2)`,
      [ids.platformRule, ids.profiles.admin],
    );

    const notifications = [
      [ids.profiles.client, null, "uat.client.action", "service_request", ids.requests.quoted, "Quotation ready for UAT", "Review the synthetic quotation and test the acceptance flow.", `/client/requests/${ids.requests.quoted}`],
      [ids.profiles.owner, ids.organisations.provider, "uat.owner.action", "service_request", ids.requests.submitted, "New UAT enquiry", "A synthetic client enquiry is ready for quotation testing.", `/professional/requests/${ids.requests.submitted}`],
      [ids.profiles.technician, ids.organisations.provider, "uat.technician.action", "job", ids.jobs.active, "Assigned UAT job", "Continue the synthetic in-progress job and checklist.", `/professional/jobs/${ids.jobs.active}`],
      [ids.profiles.admin, null, "uat.admin.action", "moderation_report", ids.report, "Open UAT moderation report", "A synthetic listing report is ready for investigation.", `/admin/reports`],
    ];
    for (let index = 0; index < notifications.length; index += 1) {
      const [recipient, organisation, eventType, aggregateType, aggregateId, title, body, actionTarget] = notifications[index];
      await client.query(
        `insert into notifications
          (recipient_account_id, organisation_id, source_event_id, source_event_type, source_aggregate_type, source_aggregate_id, title, body, action_target)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [recipient, organisation, `f1000000-0000-4000-8000-00000000000${index + 1}`, eventType, aggregateType, aggregateId, title, body, actionTarget],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

const client = await pool.connect();
try {
  console.log(`Preview database target: ${target.hostname}/${decodeURIComponent(target.pathname.slice(1))}`);
  if (!verifyOnly) {
    await seed(client);
  }
  await verifySeed(client);
} finally {
  client.release();
  await pool.end();
}
