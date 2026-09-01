import fs from "node:fs";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";

import { assertLocalSeedEnvironment } from "./lib/local-seed-guard.mjs";
import {
  consolidateLocalPersonas,
  localPersonaSpecs,
  verifyLocalPersonaInvariant,
} from "./lib/local-personas.mjs";

const env = { ...process.env, ...(fs.existsSync(".env") ? dotenv.parse(fs.readFileSync(".env")) : {}) };
assertLocalSeedEnvironment(env, process.argv.includes("--confirm-local"));

const ids = {
  client: "d1000000-0000-4000-8000-000000000001", team: "d1000000-0000-4000-8000-000000000002",
  membership: "d2000000-0000-4000-8000-000000000001", service: "d3000000-0000-4000-8000-000000000001",
  serviceSnapshot: "d3050000-0000-4000-8000-000000000001",
  fixtureOrganisations: [1,2,3,4].map((n) => `d3100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureProfiles: [1,2,3,4].map((n) => `d3200000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureMemberships: [1,2,3,4].map((n) => `d3270000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureServices: [1,2,3,4].map((n) => `d3300000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  fixtureServiceSnapshots: [1,2,3,4].map((n) => `d3350000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  paginationServices: Array.from({ length: 24 }, (_, index) => `d3400000-0000-4000-8000-${String(index + 1).padStart(12,"0")}`),
  paginationServiceSnapshots: Array.from({ length: 24 }, (_, index) => `d3450000-0000-4000-8000-${String(index + 1).padStart(12,"0")}`),
  requests: [1,2,3,4,5].map((n) => `d4000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  requestKeys: [1,2,3,4,5].map((n) => `d4100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quotations: [1,2,3].map((n) => `d5000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  historicalQuoteVersions: [1,2,3].map((n) => `d5100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  quoteVersions: [1,2,3].map((n) => `d5200000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  bookings: [1,2,3,4,5,6,7].map((n) => `d6000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  jobs: [1,2,3,4,5,6,7].map((n) => `d7000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  invoices: [1,2,3].map((n) => `d8000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  invoiceItems: [1,2,3].map((n) => `d8100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  payments: [1,2,3].map((n) => `d9000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  paymentAllocations: [1,2,3].map((n) => `d9100000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  reviews: [1,2,3].map((n) => `da000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  warranties: [1,2,3].map((n) => `db000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  warrantyClaim: "db100000-0000-4000-8000-000000000001",
  variation: "d7100000-0000-4000-8000-000000000001",
  savedProfessionals: [1,2].map((n) => `dc000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
  notifications: [1,2,3].map((n) => `dd000000-0000-4000-8000-${String(n).padStart(12,"0")}`),
};

const pool = new Pool({ connectionString: env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  const { personas, roleIds } = await consolidateLocalPersonas(client);
  const orgResult = await client.query("select id from organisations where name = 'Local Flow Plumbing' order by created_at limit 1");
  if (!orgResult.rows[0]) throw new Error("Local Flow Plumbing does not exist. Complete local professional registration first.");
  const organisationId = orgResult.rows[0].id;
  const ownerResult = await client.query("select om.id,om.account_profile_id,om.role_id from organisation_memberships om where om.organisation_id = $1 and om.account_profile_id=$2 and om.status = 'active' order by om.created_at limit 1", [organisationId, personas.professionalJourney.profileId]);
  if (!ownerResult.rows[0]) throw new Error("Local Flow Plumbing needs an active owner membership before seeding.");
  const ownerId = personas.professionalJourney.profileId;
  const roleId = roleIds.owner;
  ids.membership = ownerResult.rows[0].id;
  const now = new Date();
  const at = (days, hour) => { const date = new Date(now); date.setDate(date.getDate() + days); date.setHours(hour, 0, 0, 0); return date; };

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
  const paginationServiceRows = [
    [0, "circuit-breaker-replacement", "Circuit Breaker Replacement", "Electrical", "Replace faulty breakers and restore safe circuit protection.", "fixed", 450000, 90, 30, "on_site", true],
    [0, "indoor-lighting-installation", "Indoor Lighting Installation", "Electrical", "Install ceiling, wall, and feature lighting for living spaces.", "starting_from", 250000, 120, 30, "on_site", true],
    [0, "outdoor-security-lighting", "Outdoor Security Lighting", "Electrical", "Fit weather-resistant security and pathway lighting.", "starting_from", 320000, 150, 30, "on_site", true],
    [0, "socket-and-switch-repair", "Socket and Switch Repair", "Electrical", "Diagnose and replace damaged sockets and switches.", "fixed", 180000, 60, 14, "on_site", true],
    [0, "electrical-safety-inspection", "Electrical Safety Inspection", "Electrical", "Inspect household wiring, protection devices, and visible faults.", "fixed", 300000, 90, 14, "on_site", true],
    [0, "backup-power-consultation", "Backup Power Consultation", "Electrical", "Assess your home and recommend a suitable backup power setup.", "custom_quote", null, 60, 0, "hybrid", false],
    [1, "wardrobe-assembly", "Wardrobe Assembly", "Carpentry", "Assemble freestanding and modular wardrobes securely.", "starting_from", 220000, 150, 14, "on_site", true],
    [1, "tv-wall-mounting", "TV Wall Mounting", "Carpentry", "Mount televisions safely with tidy cable routing.", "fixed", 200000, 90, 14, "on_site", true],
    [1, "shelving-installation", "Shelving Installation", "Carpentry", "Install practical wall shelves for kitchens, offices, and bedrooms.", "starting_from", 160000, 90, 14, "on_site", true],
    [1, "curtain-rod-installation", "Curtain Rod Installation", "Carpentry", "Measure and install curtain rods with secure wall fixings.", "fixed", 140000, 60, 7, "on_site", true],
    [1, "office-furniture-setup", "Office Furniture Setup", "Carpentry", "Assemble desks, chairs, cabinets, and meeting-room furniture.", "starting_from", 350000, 180, 14, "on_site", true],
    [1, "custom-carpentry-assessment", "Custom Carpentry Assessment", "Carpentry", "Discuss measurements, materials, and scope for a custom project.", "custom_quote", null, 60, 0, "hybrid", false],
    [2, "move-out-cleaning", "Move-out Cleaning", "Cleaning", "Deep clean an empty home before handover or occupation.", "starting_from", 450000, 240, 7, "on_site", true],
    [2, "sofa-upholstery-cleaning", "Sofa and Upholstery Cleaning", "Cleaning", "Refresh fabric seating with targeted stain and odour treatment.", "starting_from", 240000, 120, 7, "on_site", true],
    [2, "kitchen-deep-cleaning", "Kitchen Deep Cleaning", "Cleaning", "Degrease worktops, cabinets, appliances, and tiled surfaces.", "fixed", 260000, 150, 7, "on_site", true],
    [2, "bathroom-sanitisation", "Bathroom Sanitisation", "Cleaning", "Descale, disinfect, and detail bathroom surfaces and fixtures.", "fixed", 180000, 90, 7, "on_site", true],
    [2, "post-construction-cleaning", "Post-construction Cleaning", "Cleaning", "Remove fine dust and building residue after renovation work.", "custom_quote", null, 300, 7, "on_site", false],
    [2, "recurring-home-cleaning", "Recurring Home Cleaning", "Cleaning", "Schedule dependable weekly or fortnightly household cleaning.", "starting_from", 200000, 180, 7, "on_site", true],
    [3, "washing-machine-repair", "Washing Machine Repair", "Appliance", "Diagnose drainage, spin, leak, and power faults.", "starting_from", 300000, 120, 30, "on_site", true],
    [3, "refrigerator-diagnostics", "Refrigerator Diagnostics", "Appliance", "Identify cooling, thermostat, compressor, and seal problems.", "fixed", 220000, 60, 14, "on_site", true],
    [3, "oven-cooker-repair", "Oven and Cooker Repair", "Appliance", "Repair heating, ignition, thermostat, and control faults.", "starting_from", 280000, 120, 30, "on_site", true],
    [3, "air-conditioner-maintenance", "Air Conditioner Maintenance", "Appliance", "Clean and service residential split air-conditioning units.", "fixed", 350000, 120, 30, "on_site", true],
    [3, "dishwasher-repair", "Dishwasher Repair", "Appliance", "Resolve filling, drainage, heating, and cleaning-cycle issues.", "starting_from", 320000, 120, 30, "on_site", true],
    [3, "appliance-installation", "Appliance Installation", "Appliance", "Connect and test common freestanding household appliances.", "starting_from", 200000, 90, 14, "on_site", true],
  ];
  const fixtureWorkingHours = { monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, tuesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, wednesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, thursday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, friday: { enabled: true, opensAt: "08:00", closesAt: "17:00" }, saturday: { enabled: true, opensAt: "09:00", closesAt: "14:00" } };

  for (let i=0;i<providerRows.length;i++) {
    const [name, slug, category, description, phone, email, ratingHundredths, reviewCount, verifiedJobs] = providerRows[i];
    const [serviceSlug, serviceName, serviceCategory, serviceDescription, priceMinor, durationMinutes, warrantyDays] = serviceRows[i];
    await client.query(`insert into organisations (id,name,slug,status) values ($1,$2,$3,'active') on conflict (id) do update set name=excluded.name,slug=excluded.slug,status='active',updated_at=now()`, [ids.fixtureOrganisations[i], name, slug]);
    await client.query(`insert into organisation_memberships (id,organisation_id,account_profile_id,role_id,status,assigned_jobs_only,financial_data_access) values ($1,$2,$3,$4,'active',false,true) on conflict (id) do update set account_profile_id=excluded.account_profile_id,role_id=excluded.role_id,status='active',assigned_jobs_only=false,financial_data_access=true,updated_at=now()`, [ids.fixtureMemberships[i], ids.fixtureOrganisations[i], ids.team, roleId]);
    await client.query(`insert into professional_profiles (id,organisation_id,business_type,primary_category,description,phone,email,operating_location,experience_started_year,service_areas,working_hours,verification_type,verification_reference,verification_status,terms_accepted,terms_accepted_at,submitted_at) values ($1,$2,'business',$3,$4,$5,$6,'Nairobi',2018,'["Nairobi","Westlands","Kilimani","Lavington"]'::jsonb,$7::jsonb,'business_registration',$8,'verified',true,now(),now()) on conflict (organisation_id) do update set primary_category=excluded.primary_category,description=excluded.description,phone=excluded.phone,email=excluded.email,service_areas=excluded.service_areas,working_hours=excluded.working_hours,verification_status='verified',terms_accepted=true,updated_at=now()`, [ids.fixtureProfiles[i], ids.fixtureOrganisations[i], category, description, phone, email, JSON.stringify(fixtureWorkingHours), `LOCAL-VERIFIED-${i+1}`]);
    await client.query(`insert into professional_reputation (organisation_id,verified_jobs,review_count,average_rating_hundredths,response_rate_basis_points,completion_rate_basis_points,repeat_rate_basis_points,cancellation_rate_basis_points,warranty_resolution_rate_basis_points,dispute_rate_basis_points,recalculated_at) values ($1,$2,$3,$4,9400,9600,3200,300,9000,100,now()) on conflict (organisation_id) do update set verified_jobs=excluded.verified_jobs,review_count=excluded.review_count,average_rating_hundredths=excluded.average_rating_hundredths,response_rate_basis_points=excluded.response_rate_basis_points,completion_rate_basis_points=excluded.completion_rate_basis_points,recalculated_at=now()`, [ids.fixtureOrganisations[i], verifiedJobs, reviewCount, ratingHundredths]);
    await client.query(`insert into professional_services (id,organisation_id,slug,name,category,description,fulfilment_model,pricing_model,price_minor,currency,estimated_duration_minutes,service_areas,requirements,warranty_duration_days,warranty_terms,direct_booking_enabled,status,moderation_status,version,published_at) values ($1,$2,$3,$4,$5,$6,'on_site','starting_from',$7,'KES',$8,'["Nairobi","Westlands","Kilimani","Lavington"]'::jsonb,'["Provide safe access to the work area"]'::jsonb,$9,'Workmanship warranty applies to the agreed service scope.',true,'published','clear',1,now() - ($10 * interval '1 day')) on conflict (id) do update set name=excluded.name,category=excluded.category,description=excluded.description,price_minor=excluded.price_minor,estimated_duration_minutes=excluded.estimated_duration_minutes,warranty_duration_days=excluded.warranty_duration_days,status='published',moderation_status='clear',updated_at=now()`, [ids.fixtureServices[i], ids.fixtureOrganisations[i], serviceSlug, serviceName, serviceCategory, serviceDescription, priceMinor, durationMinutes, warrantyDays, i+1]);
    await client.query(`insert into professional_service_snapshots (id,service_id,version,snapshot) values ($1,$2,1,$3::jsonb) on conflict (service_id,version) do nothing`, [ids.fixtureServiceSnapshots[i], ids.fixtureServices[i], JSON.stringify({ name: serviceName, category: serviceCategory, pricingModel: "starting_from", priceMinor, currency: "KES", estimatedDurationMinutes: durationMinutes, warrantyDurationDays: warrantyDays, directBookingEnabled: true, marker: "local-dashboard-seed" })]);
    for (let weekday=1;weekday<=6;weekday++) {
      await client.query(`insert into availability_rules (organisation_id,membership_id,weekday,start_minute,end_minute,timezone,active,created_by_account_id) values ($1,$2,$3,480,1020,'Africa/Nairobi',true,$4) on conflict (membership_id,weekday,start_minute,end_minute) do update set active=true,created_by_account_id=excluded.created_by_account_id,updated_at=now()`, [ids.fixtureOrganisations[i],ids.fixtureMemberships[i],weekday,ids.team]);
    }
  }
  for (let i=0;i<paginationServiceRows.length;i++) {
    const [providerIndex, serviceSlug, serviceName, category, description, pricingModel, priceMinor, durationMinutes, warrantyDays, fulfilmentModel, directBookingEnabled] = paginationServiceRows[i];
    await client.query(`insert into professional_services (id,organisation_id,slug,name,category,description,fulfilment_model,pricing_model,price_minor,currency,estimated_duration_minutes,service_areas,requirements,warranty_duration_days,warranty_terms,direct_booking_enabled,status,moderation_status,version,published_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'KES',$10,'["Nairobi","Westlands","Kilimani","Lavington"]'::jsonb,'["Provide safe access to the work area"]'::jsonb,$11,'Workmanship warranty applies to the agreed service scope.',$12,'published','clear',1,now() - ($13 * interval '1 day')) on conflict (id) do nothing`, [ids.paginationServices[i], ids.fixtureOrganisations[providerIndex], serviceSlug, serviceName, category, description, fulfilmentModel, pricingModel, priceMinor, durationMinutes, warrantyDays, directBookingEnabled, i+10]);
    await client.query(`insert into professional_service_snapshots (id,service_id,version,snapshot) values ($1,$2,1,$3::jsonb) on conflict (service_id,version) do nothing`, [ids.paginationServiceSnapshots[i], ids.paginationServices[i], JSON.stringify({ name: serviceName, category, pricingModel, priceMinor, currency: "KES", fulfilmentModel, estimatedDurationMinutes: durationMinutes, warrantyDurationDays: warrantyDays, directBookingEnabled, marker: "local-marketplace-pagination-seed" })]);
  }
  await client.query(`insert into professional_reputation (organisation_id,verified_jobs,review_count,average_rating_hundredths,response_rate_basis_points,completion_rate_basis_points,repeat_rate_basis_points,cancellation_rate_basis_points,warranty_resolution_rate_basis_points,dispute_rate_basis_points,recalculated_at) values ($1,42,124,480,9600,9700,4100,200,9300,100,now()) on conflict (organisation_id) do update set verified_jobs=42,review_count=124,average_rating_hundredths=480,response_rate_basis_points=9600,completion_rate_basis_points=9700,recalculated_at=now()`, [organisationId]);
  for (let i=0;i<ids.savedProfessionals.length;i++) {
    await client.query(`insert into saved_professionals (id,account_profile_id,organisation_id) values ($1,$2,$3) on conflict (account_profile_id,organisation_id) do nothing`, [ids.savedProfessionals[i], ids.client, ids.fixtureOrganisations[i]]);
  }

  const requestRows = [
    ["Leak repair", "Westlands", "URGENT", "SUBMITTED"], ["Bathroom installation", "Rongai", "SOON", "UNDER_REVIEW"], ["Pipe replacement", "Lang’ata", "SOON", "QUOTED"], ["Water pressure check", "Kilimani", "FLEXIBLE", "QUOTED"], ["Kitchen plumbing", "Lavington", "FLEXIBLE", "QUOTED"],
  ];
  for (let i=0;i<requestRows.length;i++) {
    const [description, location, urgency, status] = requestRows[i];
    await client.query(`insert into service_requests (id,client_account_id,organisation_id,preferred_service_id,idempotency_key,source,category,description,location,preferred_time,currency,urgency,contact_preference,status,submitted_at,expires_at) values ($1,$2,$3,$4,$5,'DIRECT_SERVICE_PAGE','Plumbing',$6,$7,'Weekday',$8,$9,'IN_APP',$10,$11,$12) on conflict (id) do update set description=excluded.description,location=excluded.location,urgency=excluded.urgency,status=excluded.status,submitted_at=excluded.submitted_at,expires_at=excluded.expires_at`, [ids.requests[i], ids.client, organisationId, ids.service, ids.requestKeys[i], description, location, "KES", urgency, status, at(-i, 9), at(30-i, 17)]);
    await client.query(`insert into service_request_history (request_id,actor_account_id,action,from_status,to_status,client_visible_note) select $1,$2,$3,'DRAFT',$4,'Synthetic local client-journey fixture.' where not exists (select 1 from service_request_history where request_id=$1 and action=$3 and client_visible_note='Synthetic local client-journey fixture.')`, [ids.requests[i], status === "SUBMITTED" ? ids.client : ownerId, status === "QUOTED" ? "quotation_submitted" : status === "UNDER_REVIEW" ? "review_started" : "submitted", status]);
  }
  const historicalQuotationLineItems = [
    ["LABOUR", "Initial plumbing inspection", 1, 80000],
    ["LABOUR", "Labour - plumbing repair", 2, 110000],
    ["MATERIAL", "Pipe replacement (PVC 20mm)", 5, 30000],
    ["TRANSPORT", "Call-out and site setup", 1, 50000],
  ];
  const currentQuotationLineItems = [
    ["LABOUR", "Initial plumbing inspection", 1, 80000],
    ["LABOUR", "Labour - plumbing repair", 2, 110000],
    ["MATERIAL", "Pipe replacement (PVC 20mm)", 5, 30000],
    ["TRANSPORT", "Call-out and site setup", 1, 50000],
  ];

  // These deterministic local fixtures predate line-item seeding. The production
  // trigger still protects submitted quotations everywhere else; suspend it only
  // inside this guarded transaction while repairing the seed-owned versions.
  await client.query(`alter table quotation_line_items disable trigger quotation_line_items_draft_only`);
  for (let i=0;i<3;i++) {
    await client.query(`insert into quotations (id,request_id,organisation_id,client_account_id,created_by_account_id,status,current_version_number) values ($1,$2,$3,$4,$5,'SUBMITTED',2) on conflict (id) do update set status='SUBMITTED',current_version_number=2,accepted_version_number=null,accepted_by_account_id=null,accepted_at=null,updated_at=now()`, [ids.quotations[i], ids.requests[i+2], organisationId, ids.client, ownerId]);
    await client.query(`insert into quotation_versions (id,quotation_id,version_number,status,currency,labour_minor,materials_minor,transport_minor,additional_charges_minor,subtotal_minor,discount_minor,tax_minor,total_minor,deposit_minor,expected_duration_minutes,valid_until,scope,exclusions,warranty_terms,payment_terms,created_by_account_id,submitted_at) values ($1,$2,1,'SUBMITTED','KES',300000,150000,50000,0,500000,0,0,500000,0,120,'2025-12-31T17:00:00.000Z','Initial synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$3,'2025-01-15T09:00:00.000Z') on conflict (id) do update set status='SUBMITTED',responded_at=null,replaced_at=null,updated_at=now()`, [ids.historicalQuoteVersions[i], ids.quotations[i], ownerId]);
    await client.query(`insert into quotation_versions (id,quotation_id,version_number,status,currency,labour_minor,materials_minor,transport_minor,additional_charges_minor,subtotal_minor,discount_minor,tax_minor,total_minor,deposit_minor,expected_duration_minutes,valid_until,scope,exclusions,warranty_terms,payment_terms,created_by_account_id,submitted_at) values ($1,$2,2,'SUBMITTED','KES',300000,150000,50000,0,500000,0,0,500000,0,120,$3,'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$4,now()) on conflict (id) do update set status='SUBMITTED',responded_at=null,replaced_at=null,updated_at=now()`, [ids.quoteVersions[i], ids.quotations[i], i===2 ? new Date('2025-12-31T17:00:00.000Z') : new Date('2035-12-31T17:00:00.000Z'), ownerId]);
    for (const [position, [category, description, quantity, unitPriceMinor]] of historicalQuotationLineItems.entries()) {
      await client.query(`insert into quotation_line_items (quotation_version_id,category,description,quantity,unit_price_minor,total_minor,position) values ($1,$2,$3,$4,$5,$4::integer*$5::bigint,$6) on conflict (quotation_version_id,position) do update set category=excluded.category,description=excluded.description,quantity=excluded.quantity,unit_price_minor=excluded.unit_price_minor,total_minor=excluded.total_minor`, [ids.historicalQuoteVersions[i], category, description, quantity, unitPriceMinor, position]);
    }
    for (const [position, [category, description, quantity, unitPriceMinor]] of currentQuotationLineItems.entries()) {
      await client.query(`insert into quotation_line_items (quotation_version_id,category,description,quantity,unit_price_minor,total_minor,position) values ($1,$2,$3,$4,$5,$4::integer*$5::bigint,$6) on conflict (quotation_version_id,position) do update set category=excluded.category,description=excluded.description,quantity=excluded.quantity,unit_price_minor=excluded.unit_price_minor,total_minor=excluded.total_minor`, [ids.quoteVersions[i], category, description, quantity, unitPriceMinor, position]);
    }
  }
  await client.query(`alter table quotation_line_items enable trigger quotation_line_items_draft_only`);

  const bookingRows = [[0,"CONFIRMED",3,10,"TEAM_ASSIGNED"],[1,"CONFIRMED",0,14,"IN_PROGRESS"],[2,"COMPLETED",-6,10,"COMPLETED"],[3,"COMPLETED",-12,13,"COMPLETED"],[4,"COMPLETED",-20,9,"COMPLETED"],[5,"CONFIRMED",-1,11,"AWAITING_CLIENT_CONFIRMATION"],[6,"COMPLETED",-3,15,"COMPLETED"]];
  for (const [i, bookingStatus, days, hour, jobStatus] of bookingRows) {
    const starts = at(days,hour); const ends = new Date(starts.getTime()+2*60*60*1000);
    await client.query(`insert into bookings (id,professional_service_id,organisation_id,client_account_id,created_by_account_id,assigned_membership_id,origin,status,currency,total_minor,deposit_minor,expected_duration_minutes,starts_at,ends_at,timezone,cancellation_acknowledged_at,scope,exclusions,warranty_terms,payment_terms,completed_at) values ($1,$2,$3,$4,$5,$6,'PROFESSIONAL_CUSTOMER',$7,'KES',$8,0,120,$9,$10,'Africa/Nairobi',now(),'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.',$11) on conflict (id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,completed_at=excluded.completed_at`, [ids.bookings[i],ids.service,organisationId,ids.client,ownerId,ids.membership,bookingStatus,450000+i*50000,starts,ends,bookingStatus==="COMPLETED"?ends:null]);
    await client.query(`insert into jobs (id,booking_id,organisation_id,client_account_id,created_by_account_id,status,service_name,scope_snapshot,exclusions_snapshot,warranty_terms_snapshot,payment_terms_snapshot,currency,base_total_minor,approved_variation_total_minor,total_minor,scheduled_starts_at,scheduled_ends_at,checked_in_at,started_at,awaiting_confirmation_at,completed_at) values ($1,$2,$3,$4,$5,$6,$7,'Synthetic local plumbing scope.','Unrelated fixtures excluded.','Thirty-day workmanship warranty.','Payment is recorded manually.','KES',$8,0,$8,$9,$10,$11,$11,$12,$13) on conflict (id) do update set status=excluded.status,scheduled_starts_at=excluded.scheduled_starts_at,scheduled_ends_at=excluded.scheduled_ends_at,awaiting_confirmation_at=excluded.awaiting_confirmation_at,completed_at=excluded.completed_at`, [ids.jobs[i],ids.bookings[i],organisationId,ids.client,ownerId,jobStatus,["Leak repair","Bathroom installation","Pipe replacement","Water pressure check","Kitchen plumbing","Completed bathroom repair","Tap replacement follow-up"][i],450000+i*50000,starts,ends,["IN_PROGRESS","AWAITING_CLIENT_CONFIRMATION","COMPLETED"].includes(jobStatus)?starts:null,jobStatus==="AWAITING_CLIENT_CONFIRMATION"?ends:null,jobStatus==="COMPLETED"?ends:null]);
    await client.query(`insert into job_assignments (job_id,organisation_id,membership_id,assigned_by_account_id,active,reason) values ($1,$2,$3,$4,true,'Synthetic local dashboard assignment.') on conflict do nothing`, [ids.jobs[i],organisationId,ids.membership,ownerId]);
  }
  await client.query(`insert into job_checklist_items (job_id,label,required,position,completed,completed_by_account_id,completed_at,result_note) values ($1,'Inspect the affected fixture',true,0,true,$2,now(),'Inspection complete.'),($1,'Complete the agreed repair',true,1,false,null,null,null),($1,'Test and clean the work area',true,2,false,null,null,null) on conflict (job_id,position) do update set label=excluded.label,required=excluded.required`, [ids.jobs[1], ids.team]);
  await client.query(`insert into job_updates (job_id,created_by_account_id,update_type,visibility,content) select $1,$2,'PROGRESS','CLIENT','The inspection is complete and the repair is in progress.' where not exists (select 1 from job_updates where job_id=$1 and content='The inspection is complete and the repair is in progress.')`, [ids.jobs[1], ids.team]);
  await client.query(`insert into job_variations (id,job_id,sequence,status,description,reason,additional_amount_minor,currency,schedule_impact_minutes,created_by_account_id,submitted_at,expires_at) values ($1,$2,1,'SUBMITTED','Replace the damaged isolation valve','The valve cannot be reused safely.',125000,'KES',30,$3,now(),$4) on conflict (id) do update set status='SUBMITTED',responded_by_account_id=null,responded_at=null,response_comment=null,submitted_at=now(),expires_at=excluded.expires_at,updated_at=now()`, [ids.variation, ids.jobs[1], ownerId, at(7,17)]);
  for (let i=0;i<3;i++) {
    await client.query(`insert into invoices (id,job_id,organisation_id,client_account_id,created_by_account_id,invoice_number,status,currency,subtotal_minor,tax_minor,total_minor,payment_terms_snapshot,issued_at,due_at) values ($1,$2,$3,$4,$5,$6,$7,'KES',$8,0,$8,'Payment recorded manually.',$9,$10) on conflict (id) do update set status=excluded.status,due_at=excluded.due_at,total_minor=excluded.total_minor,subtotal_minor=excluded.subtotal_minor`, [ids.invoices[i],ids.jobs[i+2],organisationId,ids.client,ownerId,`LOCAL-INV-${i+1}`,i===0?"OVERDUE":"ISSUED",550000+i*100000,at(-12-i,9),i===0?at(-3,17):at(5+i,17)]);
    const invoiceTotal = 550000+i*100000;
    const paymentAmount = 300000+i*75000;
    await client.query(`insert into invoice_items (id,invoice_id,source_type,source_id,description,quantity,unit_price_minor,total_minor,position) values ($1,$2,'JOB_BASE',$3,$4,1,$5,$5,0) on conflict (invoice_id,position) do update set description=excluded.description,unit_price_minor=excluded.unit_price_minor,total_minor=excluded.total_minor`, [ids.invoiceItems[i],ids.invoices[i],ids.jobs[i+2],`Completed ${["pipe replacement","water pressure check","kitchen plumbing"][i]}`,invoiceTotal]);
    await client.query(`insert into payments (id,organisation_id,client_account_id,recorded_by_account_id,idempotency_key,status,amount_minor,currency,method,transaction_reference,notes,paid_at) values ($1,$2,$3,$4,$1,'PARTIALLY_ALLOCATED',$5,'KES','OTHER',$6,'Synthetic local-only payment record.',$7) on conflict (id) do update set status='PARTIALLY_ALLOCATED',amount_minor=excluded.amount_minor,paid_at=excluded.paid_at,transaction_reference=excluded.transaction_reference`, [ids.payments[i],organisationId,ids.client,ownerId,paymentAmount,`LOCAL-PREVIEW-${i+1}`,at(-8+i*3,15)]);
    await client.query(`insert into payment_allocations (id,payment_id,invoice_item_id,allocated_by_account_id,amount_minor) values ($1,$2,$3,$4,$5) on conflict (payment_id,invoice_item_id) do update set amount_minor=excluded.amount_minor`, [ids.paymentAllocations[i],ids.payments[i],ids.invoiceItems[i],ownerId,paymentAmount]);
    await client.query(`insert into reviews (id,job_id,organisation_id,client_account_id,overall_rating,service_quality_rating,communication_rating,timeliness_rating,professionalism_rating,value_rating,feedback,status,submitted_at) values ($1,$2,$3,$4,$5,5,5,$6,5,5,$7,'PUBLISHED',$8) on conflict (id) do update set feedback=excluded.feedback,submitted_at=excluded.submitted_at`, [ids.reviews[i],ids.jobs[i+2],organisationId,ids.client,i===2?4:5,i===1?4:5,["Great service. Arrived on time and fixed the issue perfectly.","Clear updates and careful workmanship.","Professional work and a tidy finish."][i],at(-5-i*4,11)]);
  }
  for (let i=0;i<ids.warranties.length;i++) {
    const startsAt = at([-6,-12,-20][i], 12);
    const endsAt = at([18,48,75][i], 17);
    await client.query(`insert into warranties (id,job_id,organisation_id,client_account_id,created_by_account_id,status,service_name_snapshot,terms_snapshot,exclusions_snapshot,starts_at,ends_at) values ($1,$2,$3,$4,$5,'ACTIVE',$6,'Workmanship warranty for the completed service scope.','Damage outside the agreed scope is excluded.',$7,$8) on conflict (job_id) do update set status='ACTIVE',service_name_snapshot=excluded.service_name_snapshot,terms_snapshot=excluded.terms_snapshot,exclusions_snapshot=excluded.exclusions_snapshot,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now()`, [ids.warranties[i],ids.jobs[i+2],organisationId,ids.client,ownerId,["Pipe replacement","Water pressure check","Kitchen plumbing"][i],startsAt,endsAt]);
  }
  await client.query(`insert into warranty_claims (id,warranty_id,sequence,status,submitted_by_account_id,subject,description,preferred_resolution) values ($1,$2,1,'SUBMITTED',$3,'Water pressure dropped again','The pressure issue returned after the completed service.','Please inspect and arrange a return visit.') on conflict (id) do update set status='SUBMITTED',reviewed_by_account_id=null,reviewed_at=null,resolved_at=null,rejected_at=null,escalated_at=null,updated_at=now()`, [ids.warrantyClaim, ids.warranties[1], ids.client]);
  for (let weekday=1;weekday<=6;weekday++) {
    await client.query(`insert into availability_rules (organisation_id,membership_id,weekday,start_minute,end_minute,timezone,active,created_by_account_id) values ($1,$2,$3,480,1020,'Africa/Nairobi',true,$4) on conflict (membership_id,weekday,start_minute,end_minute) do update set active=true,updated_at=now()`, [organisationId,ids.membership,weekday,ownerId]);
  }
  const notificationRows = [
    [ids.notifications[0], ids.requests[2], "Quotation ready", "Review the current quotation and choose whether to accept, request a revision, or decline.", `/client/quotations/${ids.quotations[0]}`],
    [ids.notifications[1], ids.jobs[1], "Variation needs a decision", "Review the additional work request before the professional continues.", `/client/jobs/${ids.jobs[1]}`],
    [ids.notifications[2], ids.jobs[5], "Completion confirmation needed", "Review the completed work and confirm it or report an issue.", `/client/jobs/${ids.jobs[5]}`],
  ];
  for (const [sourceEventId, sourceAggregateId, title, body, actionTarget] of notificationRows) {
    await client.query(`insert into notifications (recipient_account_id,organisation_id,source_event_id,source_event_type,source_aggregate_type,source_aggregate_id,title,body,action_target) values ($1,$2,$3,'local.client_journey','client_journey',$4,$5,$6,$7) on conflict (source_event_id,recipient_account_id) do update set title=excluded.title,body=excluded.body,action_target=excluded.action_target,read_at=null`, [ids.client,organisationId,sourceEventId,sourceAggregateId,title,body,actionTarget]);
  }
  const verificationResult = await client.query(`select
    (select count(*)::int from organisations where id = any($1::uuid[]) and status='active') as provider_count,
    (select count(*)::int from professional_services where id = any($2::uuid[]) and status='published' and moderation_status='clear') as fixture_service_count,
    (select count(*)::int from professional_service_snapshots where service_id = any($3::uuid[]) and version=1) as snapshot_count,
    (select count(*)::int from saved_professionals where account_profile_id=$4) as saved_count,
    (select count(*)::int from warranties where id = any($5::uuid[]) and status='ACTIVE') as warranty_count,
    (select count(*)::int from account where provider_id='credential') as credential_count,
    (select count(*)::int from service_requests where id=any($6::uuid[]) and status='QUOTED') as quoted_request_count,
    (select count(*)::int from quotation_versions where id=any($7::uuid[]) and status='SUBMITTED' and valid_until > now()) as eligible_quotation_count,
    (select count(*)::int from jobs where id=any($8::uuid[]) and status='AWAITING_CLIENT_CONFIRMATION') as completion_ready_count,
    (select count(*)::int from jobs j where j.id=$9 and j.status='COMPLETED' and not exists (select 1 from reviews r where r.job_id=j.id)) as review_ready_count,
    (select count(*)::int from job_variations where id=$10 and status='SUBMITTED' and expires_at > now()) as variation_ready_count,
    (select count(*)::int from invoice_items where id=any($11::uuid[])) as invoice_item_count,
    (select count(*)::int from payment_allocations where id=any($12::uuid[])) as allocation_count,
    (select count(*)::int from warranty_claims where id=$13 and status='SUBMITTED') as claim_count,
    (select count(*)::int from availability_rules where membership_id=$14 and active=true) as availability_rule_count,
    (select count(*)::int from notifications where source_event_id=any($15::uuid[]) and recipient_account_id=$4) as notification_count,
    (select count(*)::int from organisation_memberships where id=any($16::uuid[]) and status='active') as fixture_membership_count,
    (select count(*)::int from availability_rules where membership_id=any($16::uuid[]) and active=true) as fixture_availability_rule_count,
    (select count(*)::int from professional_services ps where ps.id=any($2::uuid[]) and ps.direct_booking_enabled=true and not exists (select 1 from availability_rules ar where ar.organisation_id=ps.organisation_id and ar.active=true)) as unbookable_direct_service_count,
    (select count(*)::int from quotation_line_items where quotation_version_id=any($17::uuid[])) as quotation_line_item_count,
    (select count(*)::int from quotation_versions qv where qv.id=any($17::uuid[]) and qv.subtotal_minor <> coalesce((select sum(qli.total_minor) from quotation_line_items qli where qli.quotation_version_id=qv.id),0)) as inconsistent_quotation_line_item_total_count`, [ids.fixtureOrganisations, [...ids.fixtureServices, ...ids.paginationServices], [ids.service, ...ids.fixtureServices, ...ids.paginationServices], ids.client, ids.warranties, ids.requests, ids.quoteVersions, ids.jobs, ids.jobs[6], ids.variation, ids.invoiceItems, ids.paymentAllocations, ids.warrantyClaim, ids.membership, ids.notifications, ids.fixtureMemberships, [...ids.historicalQuoteVersions, ...ids.quoteVersions]]);
  const verification = verificationResult.rows[0];
  if (verification.provider_count !== 4 || verification.fixture_service_count !== 28 || verification.snapshot_count !== 29 || verification.saved_count < 2 || verification.warranty_count !== 3 || verification.credential_count !== 5 || verification.quoted_request_count !== 3 || verification.eligible_quotation_count !== 2 || verification.completion_ready_count !== 1 || verification.review_ready_count !== 1 || verification.variation_ready_count !== 1 || verification.invoice_item_count !== 3 || verification.allocation_count !== 3 || verification.claim_count !== 1 || verification.availability_rule_count < 6 || verification.notification_count !== 3 || verification.fixture_membership_count !== 4 || verification.fixture_availability_rule_count !== 24 || verification.unbookable_direct_service_count !== 0 || verification.quotation_line_item_count !== 24 || verification.inconsistent_quotation_line_item_total_count !== 0) {
    throw new Error(`Local dashboard seed verification failed: ${JSON.stringify(verification)}`);
  }
  const personaVerification = await verifyLocalPersonaInvariant(client);
  if (
    personaVerification.user_count !== 5 ||
    personaVerification.profile_count !== 5 ||
    personaVerification.credential_count !== 5 ||
    personaVerification.profiles_without_credentials !== 0 ||
    personaVerification.unexpected_profiles !== 0 ||
    personaVerification.invalid_platform_assignments !== 0
  ) {
    throw new Error(`Local persona verification failed: ${JSON.stringify(personaVerification)}`);
  }
  await client.query(`insert into availability_blocks (organisation_id,membership_id,starts_at,ends_at,reason,created_by_account_id) select $1,$2,$3,$4,'Synthetic local dashboard training block.',$5 where not exists (select 1 from availability_blocks where organisation_id=$1 and membership_id=$2 and reason='Synthetic local dashboard training block.')`, [organisationId,ids.membership,at(1,8),at(1,12),ownerId]);
  await client.query("commit");
  console.log(`Seeded Local Flow Plumbing dashboard scenario (${organisationId}).`);
  console.log("Verified discovery, request, quotation decision, direct/repeat booking with schedulable providers, active variation, completion confirmation, invoice/payment, warranty claim, review-ready, notification, and saved-professional client journeys.");
  for (const persona of localPersonaSpecs) {
    console.log(`${persona.kind}: ${persona.email} / ${persona.password}`);
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release(); await pool.end();
}
