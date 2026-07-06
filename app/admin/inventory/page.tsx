import { addInventoryItem } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import { requireAdminSession } from "@/lib/auth";
import { all, formatMoney } from "@/lib/db";

export const dynamic = "force-dynamic";

type InventoryRow = {
  name: string;
  inventory_type: string;
  category: string;
  unit: string;
  current_quantity: number;
  reorder_level: number;
  cost_per_unit_cents: number | null;
};

export default async function AdminInventoryPage() {
  await requireAdminSession();
  const rows = await all<InventoryRow>(
    "SELECT * FROM inventory_items ORDER BY is_active DESC, category, name",
  );

  return (
    <AdminShell title="Inventory">
      <form action={addInventoryItem} className="admin-form-grid">
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Type
          <select name="inventory_type" defaultValue="ingredient">
            <option value="ingredient">Ingredient</option>
            <option value="packaging">Packaging</option>
            <option value="supply">Supply</option>
          </select>
        </label>
        <label>
          Category
          <input name="category" required />
        </label>
        <label>
          Unit
          <input name="unit" required />
        </label>
        <label>
          Current quantity
          <input name="current_quantity" type="number" step="0.01" defaultValue="0" />
        </label>
        <label>
          Reorder level
          <input name="reorder_level" type="number" step="0.01" defaultValue="0" />
        </label>
        <label>
          Cost per unit
          <input name="cost_per_unit" type="number" step="0.01" defaultValue="0" />
        </label>
        <button type="submit">Add inventory</button>
      </form>

      <DataTable
        headers={["Item", "Type", "Category", "Quantity", "Reorder", "Cost"]}
        rows={rows.map((item) => [
          item.name,
          item.inventory_type,
          item.category,
          `${item.current_quantity} ${item.unit}`,
          `${item.reorder_level} ${item.unit}`,
          formatMoney(item.cost_per_unit_cents ?? 0),
        ])}
      />
    </AdminShell>
  );
}
