import AdminShell from "@/components/AdminShell";
import { addCustomer } from "@/app/actions";
import CustomerEditForm from "@/components/CustomerEditForm";
import DataTable from "@/components/DataTable";
import { requireAdminSession } from "@/lib/auth";
import { all, formatMoney, syncCustomerDirectoryFromOrders } from "@/lib/db";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

type CustomerReconciliationRow = Customer & {
  total_expected_cents: number;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  await syncCustomerDirectoryFromOrders();
  const rows = await all<CustomerReconciliationRow>(
    `SELECT c.*,
            COALESCE((
              SELECT SUM(o.total_cents)
              FROM orders o
              WHERE o.customer_id = c.id AND o.status != 'cancelled'
            ), 0) AS total_expected_cents
     FROM customers c
     ORDER BY COALESCE(c.last_order_at, c.created_at) DESC
     LIMIT 100`,
  );

  return (
    <AdminShell title="Customers">
      {params.updated ? <p className="admin-flash">Customer updated successfully.</p> : null}
      <form action={addCustomer} className="admin-form-grid">
        <label>
          Customer name
          <input name="customer_name" required />
        </label>
        <label>
          Phone
          <input name="customer_phone" type="tel" required />
        </label>
        <label>
          Email
          <input name="customer_email" type="email" />
        </label>
        <label>
          Preferred contact
          <select name="preferred_contact_method" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
        <label>
          Notes
          <input name="notes" />
        </label>
        <button type="submit">Add customer</button>
      </form>
      <DataTable
        headers={["Name", "Email", "Phone", "Status", "Order count", "Total expected", "Amount received", "Balance", "Last order", "Action"]}
        rows={rows.map((customer) => [
          customer.full_name,
          customer.email ?? "",
          customer.phone,
          customer.status,
          customer.order_count,
          formatMoney(customer.total_expected_cents),
          formatMoney(customer.total_spent_cents),
          formatMoney(customer.total_expected_cents - customer.total_spent_cents),
          customer.last_order_at ?? "",
          <CustomerEditForm key={customer.id} customer={customer} />,
        ])}
      />
    </AdminShell>
  );
}
