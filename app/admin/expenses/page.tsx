import { addExpense } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, todayLocal, type DateRangeSearchParams } from "@/lib/date-range";
import { all, formatMoney } from "@/lib/db";

export const dynamic = "force-dynamic";

type ExpenseCategory = {
  id: number;
  name: string;
};

type ExpenseRow = {
  expense_date: string;
  category_snapshot: string | null;
  category_name: string | null;
  vendor: string | null;
  description: string;
  amount_cents: number;
  payment_method: string | null;
};

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  await requireAdminSession();
  const range = resolveDateRange(await searchParams);
  const [rows, categories] = await Promise.all([
    all<ExpenseRow>(
      `SELECT e.*, ec.name AS category_name
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.expense_date BETWEEN ? AND ?
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT 100`,
      [range.from, range.to],
    ),
    all<ExpenseCategory>(
      "SELECT id, name FROM expense_categories WHERE is_active = 1 ORDER BY sort_order, name",
    ),
  ]);

  return (
    <AdminShell title="Expenses">
      <DateRangeFilter basePath="/admin/expenses" from={range.from} to={range.to} label="Expense date range" />
      <form action={addExpense} className="admin-form-grid">
        <label>
          Date
          <input name="expense_date" type="date" required defaultValue={todayLocal()} />
        </label>
        <label>
          Category
          <select name="category_id">
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vendor
          <input name="vendor" />
        </label>
        <label>
          Description
          <input name="description" required />
        </label>
        <label>
          Amount
          <input name="amount" type="number" step="0.01" min="0" required />
        </label>
        <label>
          Method
          <input name="payment_method" />
        </label>
        <label>
          Notes
          <input name="notes" />
        </label>
        <button type="submit">Add expense</button>
      </form>

      <DataTable
        headers={["Date", "Category", "Vendor", "Description", "Method", "Amount"]}
        rows={rows.map((expense) => [
          expense.expense_date,
          expense.category_snapshot ?? expense.category_name ?? "",
          expense.vendor ?? "",
          expense.description,
          expense.payment_method ?? "",
          formatMoney(expense.amount_cents),
        ])}
      />
    </AdminShell>
  );
}
