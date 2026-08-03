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
  requests: [1,2,3,4,5].map((n) => `d4000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  requestKeys: [1,2,3,4,5].map((n) => `d4100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quotations: [1,2,3].map((n) => `d5000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quoteVersions: [1,2,3].map((n) => `d5100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  bookings: [1,2,3,4,5].map((n) => `d6000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  jobs: [1,2,3,4,5].map((n) => `d7000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  invoices: [1,2,3].map((n) => `d8000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  payments: [1,2,3].map((n) => `d9000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  reviews: [1,2,3].map((n) => `da000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
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
  const passwordHash = await hashPassword(localPassword);
  const at = (days, hour) => { const date = new Date(now); date.setDate(date.getDate() + days); date.setHours(hour, 0, 0, 0); return date; };

  await client.query(`insert into "user" (id,name,email,email_verified,terms_accepted,privacy_accepted) values ('local-dashboard-client','Peter Mwangi','local.dashboard.client@veterans-bay.invalid',true,true,true),('local-dashboard-team','Grace Wanjiku','local.dashboard.team@veterans-bay.invalid',true,true,true) on conflict (id) do update set name=excluded.name`);
  await client.query(`insert into account (id,account_id,provider_id,user_id,password) values ('local-dashboard-team-credential','local-dashboard-team','credential','local-dashboard-team',$1) on conflict (id) do update set password=excluded.password,updated_at=now()`, [passwordHash]);
  await client.query(`insert into account_profiles (id,auth_user_id,display_name,primary_email,timezone,terms_accepted_at,privacy_accepted_at) values ($1,'local-dashboard-client','Peter Mwangi','local.dashboard.client@veterans-bay.invalid','Africa/Nairobi',now(),now()),($2,'local-dashboard-team','Grace Wanjiku','local.dashboard.team@veterans-bay.invalid','Africa/Nairobi',now(),now()) on conflict (id) do update set display_name=excluded.display_name`, [ids.client, ids.team]);
  await client.query(`insert into organisation_memberships (id,organisation_id,account_profile_id,role_id,status,assigned_jobs_only,financial_data_access) values ($1,$2,$3,$4,'active',false,true) on conflict (id) do update set status='active',financial_data_access=true`, [ids.membership, organisationId, ids.team, roleId]);
  await client.query(`update professional_profiles set description='Reliable local plumbing repairs and maintenance for homes and businesses.', primary_category='Plumbing', phone='+254700000999', email='local.flow@veterans-bay.invalid', operating_location='Westlands, Nairobi', service_areas='["Westlands","Kilimani","Lavington"]'::jsonb, working_hours='{"monday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"tuesday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"wednesday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"thursday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"},"friday":{"enabled":true,"opensAt":"08:00","closesAt":"17:00"}}'::jsonb, verification_status='verified', terms_accepted=true where organisation_id=$1`, [organisationId]);
  await client.query(`insert into professional_services (id,organisation_id,slug,name,category,description,fulfilment_model,pricing_model,price_minor,currency,estimated_duration_minutes,service_areas,requirements,warranty_duration_days,warranty_terms,direct_booking_enabled,status,moderation_status,published_at) values ($1,$2,'local-flow-plumbing-repair','Plumbing Repair','Plumbing','Synthetic local dashboard service.','on_site','starting_from',350000,'KES',120,'["Westlands","Kilimani"]'::jsonb,'[]'::jsonb,30,'Thirty-day workmanship warranty.',true,'published','clear',now()) on conflict (id) do update set status='published',updated_at=now()`, [ids.service, organisationId]);

  const requestRows = [
    ["Leak repair", "Westlands", "URGENT", "SUBMITTED"], ["Bathroom installation", "Rongai", "SOON", "UNDER_REVIEW"], ["Pipe replacement", "Lang’ata", "SOON", "SUBMITTED"], ["Water pressure check", "Kilimani", "FLEXIBLE", "SUBMITTED"], ["Kitchen plumbing", "Lavington", "FLEXIBLE", "SUBMITTED"],
  ];
  for (let i=0;i<requestRows.length;i++) {
    const [description, location, urgency, status] = requestRows[i];
    await client.query(`insert into service_requests (id,client_account_id,organisation_id,preferred_service_id,idempotency_key,source,category,description,location,preferred_time,currency,urgency,contact_preference,status,submitted_at,expires_at) values ($1,$2,$3,$4,$5,'DIRECT_SERVICE_PAGE','Plumbing',$6,$7,'Weekday',$8,$9,'IN_APP',$10,$11,$12) on conflict (id) do update set description=excluded.description,location=excluded.location,urgency=excluded.urgency,status=excluded.status,submitted_at=excluded.submitted_at,expires_at=excluded.expires_at`, [ids.requests[i], ids.client, organisationId, ids.service, ids.requestKeys[i], description, location, "KES", urgency, status, at(-i, 9), at(30-i, 17)]);
  }
  for (let i=0;i<3;i++) {
    await client.query(`insert into quotations (id,request_id,organisation_id,client_account_id,created_by_account_id,status,current_version_number) values ($1,$2,$3,$4,$5,'SUBMITTED',1) on conflict (id) do update set status='SUBMITTED',updated_at=now()`, [ids.quotations[i], ids.requests[i+2], organisationId, ids.client, ownerId]);
    await client.query(`insert into quotation_versions (id,quotation_id,version_number,status,currency,labour_minor,materials_minor,transport_minor,additional_charges_minor,subtotal_minor,discount_minor,tax_minor,total_minor,deposit_minor,expected_duration_minutes,valid_until,scope,exclusions,warranty_terms,payment_terms,created_by_account_id,submitted_at) values ($1,$2,1,'SUBMITTED','KES',300000,150000,50000,0,500000,0,0,500000,0,120,$3,'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$4,now()) on conflict (id) do update set valid_until=excluded.valid_until,status='SUBMITTED',updated_at=now()`, [ids.quoteVersions[i], ids.quotations[i], i===0 ? at(0,18) : at(7+i,17), ownerId]);
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
  await client.query(`insert into availability_blocks (organisation_id,membership_id,starts_at,ends_at,reason,created_by_account_id) select $1,$2,$3,$4,'Synthetic local dashboard training block.',$5 where not exists (select 1 from availability_blocks where organisation_id=$1 and membership_id=$2 and reason='Synthetic local dashboard training block.')`, [organisationId,ids.membership,at(1,8),at(1,12),ownerId]);
  await client.query("commit");
  console.log(`Seeded Local Flow Plumbing dashboard scenario (${organisationId}).`);
  console.log(`Local login: local.dashboard.team@veterans-bay.invalid / ${localPassword}`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release(); await pool.end();
}
