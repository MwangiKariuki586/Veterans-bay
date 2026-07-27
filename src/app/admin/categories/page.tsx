import { MarketplaceCategoryManager } from "@/components/admin/marketplace-category-manager";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminCategoriesPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Service categories"
      description="Maintain the marketplace category taxonomy."
      hideIntro
    >
      <MarketplaceCategoryManager />
    </AuthenticatedShell>
  );
}
