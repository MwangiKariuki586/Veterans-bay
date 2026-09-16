CREATE TABLE "engagement_conversation_reads" (
	"conversation_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_conversation_reads_conversation_id_account_id_pk" PRIMARY KEY("conversation_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "engagement_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"context_type" text NOT NULL,
	"context_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_conversations_context_unique" UNIQUE("context_type","context_id"),
	CONSTRAINT "engagement_conversations_context_type_check" CHECK ("engagement_conversations"."context_type" in ('SERVICE_REQUEST', 'QUOTATION', 'BOOKING', 'JOB', 'WARRANTY_CLAIM', 'DISPUTE'))
);
--> statement-breakpoint
CREATE TABLE "engagement_message_attachments" (
	"message_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_message_attachments_message_id_asset_id_pk" PRIMARY KEY("message_id","asset_id"),
	CONSTRAINT "engagement_message_attachments_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "engagement_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_account_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_messages_sender_idempotency_unique" UNIQUE("conversation_id","sender_account_id","idempotency_key"),
	CONSTRAINT "engagement_messages_body_check" CHECK (char_length("engagement_messages"."body") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ADD CONSTRAINT "engagement_conversation_reads_conversation_id_engagement_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."engagement_conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ADD CONSTRAINT "engagement_conversation_reads_account_id_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_message_attachments" ADD CONSTRAINT "engagement_message_attachments_message_id_engagement_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."engagement_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_message_attachments" ADD CONSTRAINT "engagement_message_attachments_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_message_attachments" ADD CONSTRAINT "engagement_message_attachments_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_messages" ADD CONSTRAINT "engagement_messages_conversation_id_engagement_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."engagement_conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_messages" ADD CONSTRAINT "engagement_messages_sender_account_id_account_profiles_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagement_conversation_reads_account_idx" ON "engagement_conversation_reads" USING btree ("account_id","updated_at");--> statement-breakpoint
CREATE INDEX "engagement_conversations_context_idx" ON "engagement_conversations" USING btree ("context_type","context_id");--> statement-breakpoint
CREATE INDEX "engagement_message_attachments_message_idx" ON "engagement_message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "engagement_messages_timeline_idx" ON "engagement_messages" USING btree ("conversation_id","created_at","id");