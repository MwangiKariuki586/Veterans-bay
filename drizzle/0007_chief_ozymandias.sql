CREATE INDEX "professional_profiles_service_areas_idx" ON "professional_profiles" USING gin ("service_areas");--> statement-breakpoint
CREATE INDEX "professional_profiles_operating_location_idx" ON "professional_profiles" USING btree ("operating_location");--> statement-breakpoint
CREATE INDEX "professional_services_marketplace_search_idx" ON "professional_services" USING gin (to_tsvector(
        'simple',
        coalesce("name", '') || ' ' ||
        coalesce("category", '') || ' ' ||
        coalesce("description", '')
      ));--> statement-breakpoint
CREATE INDEX "professional_services_service_areas_idx" ON "professional_services" USING gin ("service_areas");--> statement-breakpoint
CREATE INDEX "professional_services_fulfilment_status_idx" ON "professional_services" USING btree ("fulfilment_model","status");--> statement-breakpoint
CREATE INDEX "professional_services_pricing_status_idx" ON "professional_services" USING btree ("pricing_model","status");