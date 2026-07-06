import OrderForm from "@/components/OrderForm";
import PublicShell from "@/components/PublicShell";
import { getPublicMenu } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const menu = await getPublicMenu();

  return (
    <PublicShell
      active="order"
      eyebrow="Pre-order pickup meals"
      title="Order Food"
    >
      <OrderForm {...menu} />
    </PublicShell>
  );
}
