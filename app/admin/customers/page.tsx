import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import { requireAdminSession } from "@/lib/auth";
import { all, formatMoney, syncCustomerDirectoryFromOrders } from "@/lib/db";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdminSession();
  await syncCustomerDirectoryFromOrders();
  const rows = await all<Customer>(
    "SELECT * FROM customers ORDER BY COALESCE(last_order_at, created_at) DESC LIMIT 100",
  );

  return (
    <AdminShell title="Customers">
      <DataTable
        headers={["Name", "Email", "Phone", "Status", "Orders", "Payment received", "Last order"]}
        rows={rows.map((customer) => [
          customer.full_name,
          customer.email ?? "",
          customer.phone,
          customer.status,
          customer.order_count,
          formatMoney(customer.total_spent_cents),
          customer.last_order_at ?? "",
        ])}
      />
    </AdminShell>
  );
}
