import { moderateReview, syncGoogleReviews } from "@/app/actions";
import AdminShell from "@/components/AdminShell";
import DataTable from "@/components/DataTable";
import DateRangeFilter from "@/components/DateRangeFilter";
import { requireAdminSession } from "@/lib/auth";
import { resolveDateRange, type DateRangeSearchParams } from "@/lib/date-range";
import { all, getSettings } from "@/lib/db";
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
  searchParams: Promise<DateRangeSearchParams & {
    google?: string;
    inserted?: string;
    updated?: string;
  }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const range = resolveDateRange(params);
  const [reviews, settings] = await Promise.all([
    all<AdminReview>(
      `SELECT r.id, r.customer_name, r.rating, r.comment, r.moderation_status,
            r.is_verified_customer, r.rejected_reason, r.created_at,
            r.source, r.external_review_url, r.google_update_time,
            o.order_number
     FROM reviews r
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE date(r.created_at) BETWEEN ? AND ?
     ORDER BY r.created_at DESC
     LIMIT 200`,
      [range.from, range.to],
    ),
    getSettings(),
  ]);
  const googleSyncEnabled = settings.google_reviews_sync_enabled === "true";
  const googleStatus =
    params.google === "synced"
      ? `Google reviews synced. Added ${params.inserted ?? "0"}, updated ${params.updated ?? "0"}.`
      : params.google === "failed"
        ? `Google review sync failed: ${settings.google_reviews_last_sync_status || "check credentials and location IDs."}`
        : params.google === "missing-location"
          ? "Add Google account ID and location ID in Settings before syncing."
          : params.google === "disabled"
            ? "Enable Google review sync in Settings first."
            : "";

  return (
    <AdminShell title="Reviews">
      {googleStatus ? <p className={params.google === "failed" ? "form-error" : "admin-flash"}>{googleStatus}</p> : null}
      <form action={syncGoogleReviews} className="delivery-settings-card">
        <div>
          <h3>Google Review Sync</h3>
          <p>
            Imports Google Business Profile reviews into the portal. Last sync:{" "}
            {settings.google_reviews_last_sync_at || "Never"}
          </p>
        </div>
        <button type="submit" disabled={!googleSyncEnabled}>
          Sync Google Reviews
        </button>
      </form>
      <DateRangeFilter basePath="/admin/reviews" from={range.from} to={range.to} label="Review date range" />
      <DataTable
        headers={["Customer", "Source", "Order", "Rating", "Comment", "Status", "Moderate"]}
        rows={reviews.map((review) => [
          review.customer_name,
          review.source === "google" ? "Google" : "Portal",
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
