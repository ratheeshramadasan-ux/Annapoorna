import { loginCustomer } from "@/app/actions";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <PublicShell title="Customer Login" active="track">
      <form action={loginCustomer} className="form-panel narrow-form">
        <h3>Sign in</h3>
        {params.registered ? (
          <p className="notice">Registration saved. You can sign in now.</p>
        ) : null}
        {params.error ? (
          <p className="form-error">No customer matched that email or phone.</p>
        ) : null}
        <label>
          Email or phone
          <input name="email_or_phone" required />
        </label>
        <button className="gold-button" type="submit">
          Continue
        </button>
        <p className="fine-print">
          This opens your customer order history for matching registered details.
          Phone or email verification delivery can be connected later.
        </p>
      </form>
    </PublicShell>
  );
}
