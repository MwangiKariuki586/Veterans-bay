CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_position_unique" UNIQUE("invoice_id","position"),
	CONSTRAINT "invoice_items_source_check" CHECK ("invoice_items"."source_type" in ('JOB_BASE', 'JOB_VARIATION', 'CUSTOM')),
	CONSTRAINT "invoice_items_quantity_check" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_money_check" CHECK ("invoice_items"."unit_price_minor" >= 0 and "invoice_items"."total_minor" = "invoice_items"."quantity" * "invoice_items"."unit_price_minor")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" text NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"notes" text,
	"payment_terms_snapshot" text NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_job_unique" UNIQUE("job_id"),
	CONSTRAINT "invoices_org_number_unique" UNIQUE("organisation_id","invoice_number"),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED')),
	CONSTRAINT "invoices_currency_check" CHECK (char_length("invoices"."currency") = 3 and "invoices"."currency" = upper("invoices"."currency")),
	CONSTRAINT "invoices_money_check" CHECK ("invoices"."subtotal_minor" >= 0 and "invoices"."tax_minor" >= 0 and "invoices"."total_minor" = "invoices"."subtotal_minor" + "invoices"."tax_minor"),
	CONSTRAINT "invoices_lock_version_check" CHECK ("invoices"."lock_version" > 0),
	CONSTRAINT "invoices_issue_fields_check" CHECK ("invoices"."status" = 'DRAFT' or "invoices"."issued_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "payment_adjustment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"payment_allocation_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_adjustment_allocations_unique" UNIQUE("adjustment_id","payment_allocation_id"),
	CONSTRAINT "payment_adjustment_allocations_amount_check" CHECK ("payment_adjustment_allocations"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"recorded_by_account_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"adjustment_type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason" text NOT NULL,
	"transaction_reference" text,
	"evidence_asset_id" uuid,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_adjustments_payment_idempotency_unique" UNIQUE("payment_id","idempotency_key"),
	CONSTRAINT "payment_adjustments_type_check" CHECK ("payment_adjustments"."adjustment_type" in ('REVERSAL', 'REFUND')),
	CONSTRAINT "payment_adjustments_amount_check" CHECK ("payment_adjustments"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_item_id" uuid NOT NULL,
	"allocated_by_account_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_payment_item_unique" UNIQUE("payment_id","invoice_item_id"),
	CONSTRAINT "payment_allocations_amount_check" CHECK ("payment_allocations"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"recorded_by_account_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" text DEFAULT 'RECORDED' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"method" text NOT NULL,
	"transaction_reference" text,
	"notes" text,
	"evidence_asset_id" uuid,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_org_idempotency_unique" UNIQUE("organisation_id","idempotency_key"),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('RECORDED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'REVERSED')),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_currency_check" CHECK (char_length("payments"."currency") = 3 and "payments"."currency" = upper("payments"."currency")),
	CONSTRAINT "payments_method_check" CHECK ("payments"."method" in ('CASH', 'BANK_TRANSFER', 'M_PESA_MANUAL', 'CARD_MANUAL', 'CHEQUE', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "platform_fee_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"basis" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_fee_records_invoice_unique" UNIQUE("invoice_id"),
	CONSTRAINT "platform_fee_records_amount_check" CHECK ("platform_fee_records"."amount_minor" >= 0),
	CONSTRAINT "platform_fee_records_currency_check" CHECK (char_length("platform_fee_records"."currency") = 3 and "platform_fee_records"."currency" = upper("platform_fee_records"."currency"))
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustment_allocations" ADD CONSTRAINT "payment_adjustment_allocations_adjustment_id_payment_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."payment_adjustments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustment_allocations" ADD CONSTRAINT "payment_adjustment_allocations_payment_allocation_id_payment_allocations_id_fk" FOREIGN KEY ("payment_allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_recorded_by_account_id_account_profiles_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_evidence_asset_id_file_assets_id_fk" FOREIGN KEY ("evidence_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_account_id_account_profiles_id_fk" FOREIGN KEY ("allocated_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_account_id_account_profiles_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_evidence_asset_id_file_assets_id_fk" FOREIGN KEY ("evidence_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_fee_records" ADD CONSTRAINT "platform_fee_records_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organisation_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "invoices_client_status_idx" ON "invoices" USING btree ("client_account_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "invoices" USING btree ("status","due_at","id");--> statement-breakpoint
CREATE INDEX "payment_adjustment_allocations_adjustment_idx" ON "payment_adjustment_allocations" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX "payment_adjustment_allocations_allocation_idx" ON "payment_adjustment_allocations" USING btree ("payment_allocation_id");--> statement-breakpoint
CREATE INDEX "payment_adjustments_payment_idx" ON "payment_adjustments" USING btree ("payment_id","created_at","id");--> statement-breakpoint
CREATE INDEX "payment_adjustments_evidence_idx" ON "payment_adjustments" USING btree ("evidence_asset_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_item_idx" ON "payment_allocations" USING btree ("invoice_item_id");--> statement-breakpoint
CREATE INDEX "payments_org_paid_idx" ON "payments" USING btree ("organisation_id","paid_at","id");--> statement-breakpoint
CREATE INDEX "payments_client_paid_idx" ON "payments" USING btree ("client_account_id","paid_at","id");--> statement-breakpoint
CREATE INDEX "payments_evidence_idx" ON "payments" USING btree ("evidence_asset_id");