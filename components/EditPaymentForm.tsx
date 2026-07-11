"use client";

import { useState } from "react";
import { updatePaymentRecord } from "@/app/actions";

export default function EditPaymentForm({
  payment,
  from,
  to,
  query,
}: {
  payment: {
    id: number;
    payment_date: string;
    payment_method: string;
    payment_status: string;
    received_amount_cents: number;
    payment_reference: string | null;
    notes: string | null;
  };
  from: string;
  to: string;
  query?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return <button type="button" onClick={() => setEditing(true)}>Edit</button>;
  }

  return (
    <form action={updatePaymentRecord} className="inline-form payment-edit-form">
      <input type="hidden" name="payment_id" value={payment.id} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="q" value={query ?? ""} />
      <label>
        Payment date
        <input name="payment_date" type="date" defaultValue={payment.payment_date} required />
      </label>
      <label>
        Method
        <select name="payment_method" defaultValue={payment.payment_method}>
          <option value="interac">Interac</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
          <option value="manual">Manual</option>
        </select>
      </label>
      <label>
        Status
        <select name="payment_status" defaultValue={payment.payment_status}>
          <option value="pending_verification">Pending verification</option>
          <option value="partial">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="verified">Verified</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      <label>
        Received amount
        <input
          name="received_amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={(payment.received_amount_cents / 100).toFixed(2)}
          required
        />
      </label>
      <label>
        Reference
        <input name="payment_reference" defaultValue={payment.payment_reference ?? ""} />
      </label>
      <label>
        Notes
        <textarea name="notes" defaultValue={payment.notes ?? ""} rows={2} />
      </label>
      <span className="inline-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
      </span>
    </form>
  );
}
