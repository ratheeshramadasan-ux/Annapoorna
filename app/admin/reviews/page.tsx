import { moderateReview } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { all } from "@/lib/db";
import type { Review } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminReview = Review & {
  order_number: string | null;
  rejected_reason: string | null;
  is_verified_customer: number;
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<DateRangeSearchParams>;
}) {
  await requireAdminSession();
  const range = resolveDateRange(await searchParams);
  const reviews = await all<AdminReview>(
    `SELECT r.id, r.customer_name, r.rating, r.comment, r.moderation_status,
            r.is_verified_customer, r.rejected_reason, r.created_at,
            o.order_number
     FROM reviews r
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE date(r.created_at) BETWEEN ? AND ?
     ORDER BY r.created_at DESC
     LIMIT 200`,
    [range.from, range.to],
  );

  return (
    <AdminShell title="Reviews">
      <DateRangeFilter basePath="/admin/reviews" from={range.from} to={range.to} label="Review date range" />
      <DataTable
        headers={["Customer", "Order", "Rating", "Comment", "Status", "Moderate"]}
        rows={reviews.map((review) => [
          review.customer_name,
          review.order_number ?? "Unknown",
          `${review.rating}/5${review.is_verified_customer ? " verified" : ""}`,
          review.comment,
          review.moderation_status,
          <form key={review.id} action={moderateReview} className="inline-form">
            <input type="hidden" name="review_id" value={review.id} />
            <select name="moderation_status" defaultValue={review.moderation_status}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              name="rejected_reason"
              defaultValue={review.rejected_reason ?? ""}
              placeholder="Reason or note"
            />
            <button type="submit">Save</button>
          </form>,
        ])}
      />
    </AdminShell>
  );
}
