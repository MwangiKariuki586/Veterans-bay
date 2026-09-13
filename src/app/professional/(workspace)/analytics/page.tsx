"use client";

import { ProfessionalReports } from "@/components/workspace/professional-reports";
import { ProfessionalReportsProvider } from "@/components/workspace/professional-reports-context";

export default function ProfessionalAnalyticsPage() {
  return (
    <ProfessionalReportsProvider>
      <ProfessionalReports />
    </ProfessionalReportsProvider>
  );
}
