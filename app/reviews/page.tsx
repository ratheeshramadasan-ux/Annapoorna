import { requestReviewToken, submitVerifiedReview } from "@/app/actions";
import PublicShell from "@/components/PublicShell";
import { getApprovedReviews, getSettings, settingBool } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    submitted?: string;
    token?: string;
    error?: string;
    order?: string;
  }>;
}) {
  const params = await searchParams;
  const [reviews, settings] = await Promise.all([getApprovedReviews(), getSettings()]);
  const reviewsEnabled = settingBool(settings, "public_allow_reviews", true);
  const googleReviewUrl = settings.google_review_url;

  return (
    <PublicShell active="reviews" title="Reviews" eyebrow="Customer stories">
      {params.submitted ? (
        <p className="notice">
          Thank you. Your review is waiting for moderation.
          {googleReviewUrl ? (
            <>
              {" "}
              You can also share it on{" "}
              <a href={googleReviewUrl} target="_blank" rel="noreferrer">
                Google Reviews
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}
      {"token" in params ? (
        <p className="notice">
          A review verification code has been queued for your email or WhatsApp.
          Enter it below to submit your review.
        </p>
      ) : null}
      {"error" in params ? (
        <p className="form-error">
          {params.error === "already-reviewed"
            ? "A review has already been submitted for that order."
            : params.error === "invalid-token"
              ? "That review code is invalid or expired."
              : "We could not match that order with the email or phone provided."}
        </p>
      ) : null}
      <section className="reviews-grid">
        <div className="review-list">
          {reviews.length === 0 ? (
            <div className="empty-state">
              <h3>No approved reviews yet</h3>
              <p>Approved customer reviews will appear here.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <details key={review.id} className="review-card collapsible-card" open>
                <summary>
                  Rating {review.rating}/5{review.source === "google" ? " on Google" : ""}
                </summary>
                <p>{review.comment}</p>
                <span>
                  {review.customer_name}
                  {review.external_review_url ? (
                    <>
                      {" "}
                      <a href={review.external_review_url} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </>
                  ) : null}
                </span>
              </details>
            ))
          )}
          {googleReviewUrl ? (
            <a
              className="outline-dark-button"
              href={googleReviewUrl}
              target="_blank"
              rel="noreferrer"
            >
              Review Annapoorna on Google
            </a>
          ) : null}
        </div>
        {reviewsEnabled ? (
          <div className="review-verify-stack">
            <form action={requestReviewToken} className="form-panel">
              <h3>Verify your order</h3>
              <p>
                Reviews can only be submitted by customers with a matching order
                number and email or phone.
              </p>
              <label>
                Order number
                <input name="order_number" defaultValue={params.order ?? ""} required />
              </label>
              <label>
                Email or phone used on order
                <input name="email_or_phone" required />
              </label>
              <button className="outline-dark-button" type="submit">
                Send Review Code
              </button>
            </form>

            <form action={submitVerifiedReview} className="form-panel">
              <h3>Submit verified review</h3>
              <label>
                Order number
                <input name="order_number" defaultValue={params.order ?? ""} required />
              </label>
              <label>
                Email or phone used on order
                <input name="email_or_phone" required />
              </label>
              <label>
                Review code
                <input name="review_token" inputMode="numeric" required />
              </label>
            <label>
              Name
              <input name="customer_name" required />
            </label>
            <label>
              Rating
              <select name="rating" defaultValue="5" required>
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
            </label>
            <label>
              Comment
              <textarea name="comment" rows={5} required />
            </label>
            <button className="gold-button" type="submit">
              Submit Review
            </button>
            </form>
          </div>
        ) : (
          <div className="form-panel">
            <h3>Reviews are paused</h3>
            <p>Review submissions are currently disabled.</p>
            {googleReviewUrl ? (
              <a className="gold-button" href={googleReviewUrl} target="_blank" rel="noreferrer">
                Review on Google
              </a>
            ) : null}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
