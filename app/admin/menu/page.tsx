import AdminMenuManager from "@/components/AdminMenuManager";
import AdminShell from "@/components/AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { getAdminMenuData } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; item?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const { categories, items, availability, prices, recipes } = await getAdminMenuData();

  return (
    <AdminShell title="Menu">
      <AdminMenuManager
        saved={params.saved}
        savedItemId={params.item ? Number(params.item) : null}
        categories={categories}
        items={items}
        availability={availability}
        prices={prices}
        recipes={recipes}
      />
    </AdminShell>
  );
}
