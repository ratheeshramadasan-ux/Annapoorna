import OrderForm from "@/components/OrderForm";
import PublicShell from "@/components/PublicShell";
import { getPublicMenu } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const menu = await getPublicMenu();
  const params = await searchParams;

  return (
    <PublicShell
      active="order"
      eyebrow="Pre-order pickup meals"
      title="Order Food"
    >
      <OrderForm {...menu} error={params.error} />
    </PublicShell>
  );
}
