import { registerCustomer } from "@/app/actions";
import PublicShell from "@/components/PublicShell";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <PublicShell title="Create Account" active="track">
      <form action={registerCustomer} className="form-panel narrow-form">
        <h3>Customer registration</h3>
        <label>
          Full name
          <input name="full_name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" required />
        </label>
        <button className="gold-button" type="submit">
          Register
        </button>
        <p className="fine-print">
          This creates a simple customer record. Verification and password auth
          can be added later.
        </p>
      </form>
    </PublicShell>
  );
}
