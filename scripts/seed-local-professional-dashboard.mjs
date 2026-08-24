import fs from "node:fs";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

import { assertLocalSeedEnvironment } from "./lib/local-seed-guard.mjs";

const env = { ...process.env, ...(fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {}) };
assertLocalSeedEnvironment(env, process.argv.includes("--confirm-local"));

const ids = {
  client: "d1000000-0000-4000-8000-000000000001", team: "d1000000-0000-4000-8000-000000000002",
  membership: "d2000000-0000-4000-8000-000000000001", service: "d3000000-0000-4000-8000-000000000001",
  serviceSnapshot: "d3050000-0000-4000-8000-000000000001",
  fixtureOrganisations: [1,2,3,4].map((n) => `d3100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureProfiles: [1,2,3,4].map((n) => `d3200000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureServices: [1,2,3,4].map((n) => `d3300000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureServiceSnapshots: [1,2,3,4].map((n) => `d3350000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  requests: [1,2,3,4,5].map((n) => `d4000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  requestKeys: [1,2,3,4,5].map((n) => `d4100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quotations: [1,2,3].map((n) => `d5000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quoteVersions: [1,2,3].map((n) => `d5100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  bookings: [1,2,3,4,5].map((n) => `d6000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  jobs: [1,2,3,4,5].map((n) => `d7000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  invoices: [1,2,3].map((n) => `d8000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  payments: [1,2,3].map((n) => `d9000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  reviews: [1,2,3].map((n) => `da000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  warranties: [1,2,3].map((n) => `db000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  savedProfessionals: [1,2].map((n) => `dc000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
};

const pool = new Pool({ connectionString: env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const orgResult = await client.query("select id from organisations where name = 'Local Flow Plumbing' order by created_at limit 1");
  if (!orgResult.rows[0]) throw new Error("Local Flow Plumbing does not exist. Complete local professional registration first.");
  const organisationId = orgResult.rows[0].id;
  const ownerResult = await client.query("select om.account_profile_id, om.role_id from organisation_memberships om where om.organisation_id = $1 and om.status = 'active' order by om.created_at limit 1", [organisationId]);
  if (!ownerResult.rows[0]) throw new Error("Local Flow Plumbing needs an active owner membership before seeding.");
  const ownerId = ownerResult.rows[0].account_profile_id;
  const roleId = ownerResult.rows[0].role_id;
  const now = new Date();
  const localPassword = "LocalFlowDashboard!2026";
  const localClientPassword = "LocalClientDashboard!2026";
  const passwordHash = await hashPassword(localPassword);
  const clientPasswordHash = await hashPassword(localClientPassword);
  const at = (days, hour) => { const date = new Date(now); date.setDate(date.getDate() + days); date.setHours(hour, 0, 0, 0); return date; };

  await client.query(`insert into "user" (id,name,email,email_verified,terms_accepted,privacy_accepted) values ('local-dashboard-client','Peter Mwangi','local.dashboard.client@veterans-bay.invalid',true,true,true),('local-dashboard-team','Grace Wanjiku','local.dashboard.team@veterans-bay.invalid',true,true,true) on conflict (id) do update set name=excluded.name`);
  await client.query(`insert into account (id,account_id,provider_id,user_id,password) values ('local-dashboard-team-credential','local-dashboard-team','credential','local-dashboard-team',$1) on conflict (id) do update set password=excluded.password,updated_at=now()`, [passwordHash]);
  await client.query(`insert into account (id,account_id,provider_id,user_id,password) values ('local-dashboard-client-credential','local-dashboard-client','credential','local-dashboard-client',$1) on conflict (id) do update set password=excluded.password,updated_at=now()`, [clientPasswordHash]);
  await client.query(`insert into account_profiles (id,auth_user_id,display_name,primary_email,timezone,terms_accepted_at,privacy_accepted_at) values ($1,'local-dashboard-client','Peter Mwangi','local.dashboard.client@veterans-bay.invalid','Africa/Nairobi',now(),now()),($2,'local-dashboard-team','Grace Wanjiku','local.dashboard.team@veterans-bay.invalid','Africa/Nairobi',now(),now()) on conflict (id) do update set display_name=excluded.display_name`, [ids.client, ids.team]);
  await client.query(`insert into organisation_memberships (id,organisation_id,account_profile_id,role_id,status,assigned_jobs_only,financial_data_access) values ($1,$2,$3,$4,'active',false,true) on conflict (id) do update set status='active',financial_data_access=true`, [ids.membership, organisationId, ids.team, roleId]);
  await client.query(`update professional_profiles set description='Reliable local plumbing repairs and maintenance for homes and businesses.', primary_category='Plumbing', phone='+254700000999', email='local.flow@veterans-bay.invalid', operating_location='Westlands, Nairobi', service_areas='["Westlands","Kilimani","Lavington"]'::jsonb, working_hours='{"monday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"tuesday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"wednesday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"thursday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"friday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"}}'::jsonb, verification_status='verified', terms_accepted=true where organisation_id=$1`, [organisationId]);
  await client.query(`insert into professional_services (id,organisation_id,slug,name,category,description,fulfilment_model,pricing_model,price_minor,currency,estimated_duration_minutes,service_areas,requirements,warranty_duration_days,warranty_terms,direct_booking_enabled,status,moderation_status,published_at) values ($1,$2,'local-flow-plumbing-repair','Plumbing Repair','Plumbing','Synthetic local dashboard service.','on_site','starting_from',350000,'KES',120,'["Westlands","Kilimani"]'::jsonb,'[]'::jsonb,30,'Thirty-day workmanship warranty.',true,'published','clear',now()) on conflict (id) do update set status='published',updated_at=now()`, [ids.service, organisationId]);
  await client.query(`insert into professional_service_snapshots (id,service_id,version,snapshot) values ($1,$2,1,$3::jsonb) on conflict (service_id,version) do nothing`, [ids.serviceSnapshot, ids.service, JSON.stringify({ name: "Plumbing Repair", category: "Plumbing", pricingModel: "starting_from", priceMinor: 350000, currency: "KES", estimatedDurationMinutes: 120, warrantyDurationDays: 30, directBookingEnabled: true, marker: "local-dashboard-seed" })]);

  const providerRows = [
    ["BrightHome Electrical", "brighthome-electrical", "Electrical", "Electrical installation and repair across Nairobi homes.", "+254700000201", "brighthome@veterans-bay.invalid", 470, 96, 38],
    ["Assemble Pro Kenya", "assemble-pro-kenya", "Carpentry", "Furniture assembly and practical home installation services.", "+254700000202", "assemble.pro@veterans-bay.invalid", 490, 78, 44],
    ["Sparkle Clean Services", "sparkle-clean-services", "Cleaning", "Deep cleaning for occupied homes, move-outs, and recurring care.", "+254700000203", "sparkle.clean@veterans-bay.invalid", 460, 63, 31],
    ["CoolCare Appliances", "coolcare-appliances", "Appliance", "Appliance diagnostics, servicing, and preventive maintenance.", "+254700000204", "coolcare@veterans-bay.invalid", 450, 52, 27],
  ];
  const serviceRows = [
    ["electrical-installation", "Electrical Installation", "Electrical", "Safe residential electrical installation and fault diagnosis.", 200000, 120, 30],
    ["furniture-assembly", "Furniture Assembly", "Carpentry", "Flat-pack and custom furniture assembly in your home.", 150000, 90, 14],
    ["home-deep-cleaning", "Home Deep Cleaning", "Cleaning", "Detailed room-by-room cleaning using home-safe products.", 280000, 180, 7],
    ["appliance-repair", "Appliance Repair", "Appliance", "Diagnosis and repair for common household appliances.", 380000, 120, 30],
  ];
  const fixtureWorkingHours = { monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, tuesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, wednesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, thursday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, friday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, saturday: { enabled: true, opensAt: "09:00", closesAt: "14:00" } };

  for (let i=0;i<providerRows.length;i++) {
    const [name, slug, category, description, phone, email, ratingHundredths, reviewCount, verifiedJobs] = providerRows[i];
    const [serviceSlug, serviceName, serviceCategory, serviceDescription, priceMinor, durationMinutes, warrantyDays] = serviceRows[i];
    await client.query(`insert into organisations (id,name,slug,status) values ($1,$2,$3,'active') on conflict (id) do update set name=excluded.name,slug=excluded.slug,status='active',updated_at=now()`, [ids.fixtureOrganisations[i], name, slug]);
    await client.query(`insert into professional_profiles (id,organisation_id,business_type,primary_category,description,phone,email,operating_location,experience_started_year,service_areas,working_hours,verification_type,verification_reference,verification_status,terms_accepted,terms_accepted_at,submitted_at) values ($1,$2,'business',$3,$4,$5,$6,'Nairobi',2018,'["Nairobi","Westlands","Kilimani","Lavington"]'::jsonb,$7::jsonb,'business_registration',$8,'verified',true,now(),now()) on conflict (organisation_id) do update set primary_category=excluded.primary_category,description=excluded.description,phone=excluded.phone,email=excluded.email,service_areas=excluded.service_areas,working_hours=excluded.working_hours,verification_status='verified',terms_accepted=true,updated_at=now()`, [ids.fixtureProfiles[i], ids.fixtureOrganisations[i], category, description, phone, email, JSON.stringify(fixtureWorkingHours), `LOCAL-VERIFIED-${i+1}`]);
    await client.query(`insert into professional_reputation (organisation_id,verified_jobs,review_count,average_rating_hundredths,response_rate_basis_points,completion_rate_basis_points,repeat_rate_basis_points,cancellation_rate_basis_points,warranty_resolution_rate_basis_points,dispute_rate_basis_points,recalculated_at) values ($1,$2,$3,$4,9400,9600,3200,300,9000,100,now()) on conflict (organisation_id) do update set verified_jobs=excluded.verified_jobs,review_count=excluded.review_count,average_rating_hundredths=excluded.average_rating_hundredths,response_rate_basis_points=excluded.response_rate_basis_points,completion_rate_basis_points=excluded.completion_rate_basis_points,recalculated_at=now()`, [ids.fixtureOrganisations[i], verifiedJobs, reviewCount, ratingHundredths]);
    await client.query(`insert into professional_services (id,organisation_id,slug,name,category,description,fulfilment_model,pricing_model,price_minor,currency,estimated_duration_minutes,service_areas,requirements,warranty_duration_days,warranty_terms,direct_booking_enabled,status,moderation_status,version,published_at) values ($1,$2,$3,$4,$5,$6,'on_site','starting_from',$7,'KES',$8,'["Nairobi","Westlands","Kilimani","Lavington"]'::jsonb,'["Provide safe access to the work area"]'::jsonb,$9,'Workmanship warranty applies to the agreed service scope.',true,'published','clear',1,now() - ($10 * interval '1 day')) on conflict (id) do update set name=excluded.name,category=excluded.category,description=excluded.description,price_minor=excluded.price_minor,estimated_duration_minutes=excluded.estimated_duration_minutes,warranty_duration_days=excluded.warranty_duration_days,status='published',moderation_status='clear',updated_at=now()`, [ids.fixtureServices[i], ids.fixtureOrganisations[i], serviceSlug, serviceName, serviceCategory, serviceDescription, priceMinor, durationMinutes, warrantyDays, i+1]);
    await client.query(`insert into professional_service_snapshots (id,service_id,version,snapshot) values ($1,$2,1,$3::jsonb) on conflict (service_id,version) do nothing`, [ids.fixtureServiceSnapshots[i], ids.fixtureServices[i], JSON.stringify({ name: serviceName, category: serviceCategory, pricingModel: "starting_from", priceMinor, currency: "KES", estimatedDurationMinutes: durationMinutes, warrantyDurationDays: warrantyDays, directBookingEnabled: true, marker: "local-dashboard-seed" })]);
  }
  await client.query(`insert into professional_reputation (organisation_id,verified_jobs,review_count,average_rating_hundredths,response_rate_basis_points,completion_rate_basis_points,repeat_rate_basis_points,cancellation_rate_basis_points,warranty_resolution_rate_basis_points,dispute_rate_basis_points,recalculated_at) values ($1,42,124,480,9600,9700,4100,200,9300,100,now()) on conflict (organisation_id) do update set verified_jobs=42,review_count=124,average_rating_hundredths=480,response_rate_basis_points=9600,completion_rate_basis_points=9700,recalculated_at=now()`, [organisationId]);
  for (let i=0;i<ids.savedProfessionals.length;i++) {
    await client.query(`insert into saved_professionals (id,account_profile_id,organisation_id) values ($1,$2,$3) on conflict (account_profile_id,organisation_id) do nothing`, [ids.savedProfessionals[i], ids.client, ids.fixtureOrganisations[i]]);
  }

  const requestRows = [
    ["Leak repair", "Westlands", "URGENT", "SUBMITTED"], ["Bathroom installation", "Rongai", "SOON", "UNDER_REVIEW"], ["Pipe replacement", "Lang’ata", "SOON", "SUBMITTED"], ["Water pressure check", "Kilimani", "FLEXIBLE", "SUBMITTED"], ["Kitchen plumbing", "Lavington", "FLEXIBLE", "SUBMITTED"],
  ];
  for (let i=0;i<requestRows.length;i++) {
    const [description, location, urgency, status] = requestRows[i];
    await client.query(`insert into service_requests (id,client_account_id,organisation_id,preferred_service_id,idempotency_key,source,category,description,location,preferred_time,currency,urgency,contact_preference,status,submitted_at,expires_at) values ($1,$2,$3,$4,$5,'DIRECT_SERVICE_PAGE','Plumbing',$6,$7,'Weekday',$8,$9,'IN_APP',$10,$11,$12) on conflict (id) do update set description=excluded.description,location=excluded.location,urgency=excluded.urgency,status=excluded.status,submitted_at=excluded.submitted_at,expires_at=excluded.expires_at`, [ids.requests[i], ids.client, organisationId, ids.service, ids.requestKeys[i], description, location, "KES", urgency, status, at(-i, 9), at(30-i, 17)]);
  }
  for (let i=0;i<3;i++) {
    await client.query(`insert into quotations (id,request_id,organisation_id,client_account_id,created_by_account_id,status,current_version_number) values ($1,$2,$3,$4,$5,'SUBMITTED',1) on conflict (id) do update set status='SUBMITTED',updated_at=now()`, [ids.quotations[i], ids.requests[i+2], organisationId, ids.client, ownerId]);
    await client.query(`insert into quotation_versions (id,quotation_id,version_number,status,currency,labour_minor,materials_minor,transport_minor,additional_charges_minor,subtotal_minor,discount_minor,tax_minor,total_minor,deposit_minor,expected_duration_minutes,valid_until,scope,exclusions,warranty_terms,payment_terms,created_by_account_id,submitted_at) values ($1,$2,1,'SUBMITTED','KES',300000,150000,50000,0,500000,0,0,500000,0,120,$3,'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$4,now()) on conflict (id) do nothing`, [ids.quoteVersions[i], ids.quotations[i], i===0 ? at(0,18) : at(7+i,17), ownerId]);
  }

  const bookingRows = [[0,"CONFIRMED",0,10,"TEAM_ASSIGNED"],[1,"CONFIRMED",0,14,"IN_PROGRESS"],[2,"COMPLETED",-6,10,"COMPLETED"],[3,"COMPLETED",-12,13,"COMPLETED"],[4,"COMPLETED",-20,9,"COMPLETED"]];
  for (const [i, bookingStatus, days, hour, jobStatus] of bookingRows) {
    const starts = at(days,hour); const ends = new Date(starts.getTime()+2*60*60*1000);
    await client.query(`insert into bookings (id,professional_service_id,organisation_id,client_account_id,created_by_account_id,assigned_membership_id,origin,status,currency,total_minor,deposit_minor,expected_duration_minutes,starts_at,ends_at,timezone,cancellation_acknowledged_at,scope,exclusions,warranty_terms,payment_terms,completed_at) values ($1,$2,$3,$4,$5,$6,'PROFESSIONAL_CUSTOMER',$7,'KES',$8,0,120,$9,$10,'Africa/Nairobi',now(),'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$11) on conflict (id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,completed_at=excluded.completed_at`, [ids.bookings[i],ids.service,organisationId,ids.client,ownerId,ids.membership,bookingStatus,450000+i*50000,starts,ends,bookingStatus==="COMPLETED"?ends:null]);
    await client.query(`insert into jobs (id,booking_id,organisation_id,client_account_id,created_by_account_id,status,service_name,scope_snapshot,exclusions_snapshot,warranty_terms_snapshot,payment_terms_snapshot,currency,base_total_minor,approved_variation_total_minor,total_minor,scheduled_starts_at,scheduled_ends_at,checked_in_at,started_at,completed_at) values ($1,$2,$3,$4,$5,$6,$7,'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.','KES',$8,0,$8,$9,$10,$11,$11,$12) on conflict (id) do update set status=excluded.status,scheduled_starts_at=excluded.scheduled_starts_at,scheduled_ends_at=excluded.scheduled_ends_at,completed_at=excluded.completed_at`, [ids.jobs[i],ids.bookings[i],organisationId,ids.client,ownerId,jobStatus,["Leak repair","Bathroom installation","Pipe replacement","Water pressure check","Kitchen plumbing"][i],450000+i*50000,starts,ends,jobStatus==="IN_PROGRESS"?starts:null,jobStatus==="COMPLETED"?ends:null]);
    await client.query(`insert into job_assignments (job_id,organisation_id,membership_id,assigned_by_account_id,active,reason) values ($1,$2,$3,$4,true,'Synthetic local dashboard assignment.') on conflict do nothing`, [ids.jobs[i],organisationId,ids.membership,ownerId]);
  }
  for (let i=0;i<3;i++) {
    await client.query(`insert into invoices (id,job_id,organisation_id,client_account_id,created_by_account_id,invoice_number,status,currency,subtotal_minor,tax_minor,total_minor,payment_terms_snapshot,issued_at,due_at) values ($1,$2,$3,$4,$5,$6,$7,'KES',$8,0,$8,'Payment recorded manually.',$9,$10) on conflict (id) do update set status=excluded.status,due_at=excluded.due_at,total_minor=excluded.total_minor,subtotal_minor=excluded.subtotal_minor`, [ids.invoices[i],ids.jobs[i+2],organisationId,ids.client,ownerId,`LOCAL-INV-${i+1}`,i===0?"OVERDUE":"ISSUED",550000+i*100000,at(-12-i,9),i===0?at(-3,17):at(5+i,17)]);
    await client.query(`insert into payments (id,organisation_id,client_account_id,recorded_by_account_id,idempotency_key,status,amount_minor,currency,method,transaction_reference,notes,paid_at) values ($1,$2,$3,$4,$1,'RECORDED',$5,'KES','OTHER',$6,'Synthetic local-only payment record.',$7) on conflict (id) do update set amount_minor=excluded.amount_minor,paid_at=excluded.paid_at,transaction_reference=excluded.transaction_reference`, [ids.payments[i],organisationId,ids.client,ownerId,300000+i*75000,`LOCAL-PREVIEW-${i+1}`,at(-8+i*3,15)]);
    await client.query(`insert into reviews (id,job_id,organisation_id,client_account_id,overall_rating,service_quality_rating,communication_rating,timeliness_rating,professionalism_rating,value_rating,feedback,status,submitted_at) values ($1,$2,$3,$4,$5,5,5,$6,5,5,$7,'PUBLISHED',$8) on conflict (id) do update set feedback=excluded.feedback,submitted_at=excluded.submitted_at`, [ids.reviews[i],ids.jobs[i+2],organisationId,ids.client,i===2?4:5,i===1?4:5,["Great service. Arrived on time and fixed the issue perfectly.","Clear updates and careful workmanship.","Professional work and a tidy finish."][i],at(-5-i*4,11)]);
  }
  for (let i=0;i<ids.warranties.length;i++) {
    const startsAt = at([-6,-12,-20][i], 12);
    const endsAt = at([18,48,75][i], 17);
    await client.query(`insert into warranties (id,job_id,organisation_id,client_account_id,created_by_account_id,status,service_name_snapshot,terms_snapshot,exclusions_snapshot,starts_at,ends_at) values ($1,$2,$3,$4,$5,'ACTIVE',$6,'Workmanship warranty for the completed service scope.','Damage outside the agreed scope is excluded.',$7,$8) on conflict (job_id) do update set status='ACTIVE',service_name_snapshot=excluded.service_name_snapshot,terms_snapshot=excluded.terms_snapshot,exclusions_snapshot=excluded.exclusions_snapshot,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now()`, [ids.warranties[i],ids.jobs[i+2],organisationId,ids.client,ownerId,["Pipe replacement","Water pressure check","Kitchen plumbing"][i],startsAt,endsAt]);
  }
  const verificationResult = await client.query(`select
    (select count(*)::int from organisations where id = any($1::uuid[]) and status='active') as provider_count,
    (select count(*)::int from professional_services where id = any($2::uuid[]) and status='published' and moderation_status='clear') as fixture_service_count,
    (select count(*)::int from professional_service_snapshots where service_id = any($3::uuid[]) and version=1) as snapshot_count,
    (select count(*)::int from saved_professionals where account_profile_id=$4) as saved_count,
    (select count(*)::int from warranties where id = any($5::uuid[]) and status='ACTIVE') as warranty_count,
    (select count(*)::int from account where id in ('local-dashboard-client-credential','local-dashboard-team-credential')) as credential_count`, [ids.fixtureOrganisations, ids.fixtureServices, [ids.service, ...ids.fixtureServices], ids.client, ids.warranties]);
  const verification = verificationResult.rows[0];
  if (verification.provider_count !== 4 || verification.fixture_service_count !== 4 || verification.snapshot_count !== 5 || verification.saved_count < 2 || verification.warranty_count !== 3 || verification.credential_count !== 2) {
    throw new Error(`Local dashboard seed verification failed: ${JSON.stringify(verification)}`);
  }
  await client.query(`insert into availability_blocks (organisation_id,membership_id,starts_at,ends_at,reason,created_by_account_id) select $1,$2,$3,$4,'Synthetic local dashboard training block.',$5 where not exists (select 1 from availability_blocks where organisation_id=$1 and membership_id=$2 and reason='Synthetic local dashboard training block.')`, [organisationId,ids.membership,at(1,8),at(1,12),ownerId]);
  await client.query("commit");
  console.log(`Seeded Local Flow Plumbing dashboard scenario (${organisationId}).`);
  console.log("Verified 5 published services, 4 recommendation providers, 3 active warranties, 2 saved professionals, and both dashboard logins.");
  console.log(`Local login: local.dashboard.team@veterans-bay.invalid / ${localPassword}`);
  console.log(`Client login: local.dashboard.client@veterans-bay.invalid / ${localClientPassword}`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release(); await pool.end();
}
