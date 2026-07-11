"use client";

import { useState } from "react";
import { deletePayment } from "@/app/actions";

export default function DeletePaymentButton({
  paymentId,
  customerName,
  paymentDate,
  from,
  to,
}: {
  paymentId: number;
  customerName: string;
  paymentDate: string;
  from: string;
  to: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <form
      action={deletePayment}
      className="inline-form"
      onSubmit={(event) => {
        if (!window.confirm(`Delete the ${paymentDate} payment for ${customerName}? This cannot be undone.`)) {
          event.preventDefault();
          return;
        }
        setIsDeleting(true);
      }}
    >
      <input type="hidden" name="payment_id" value={paymentId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <button className="danger-button" type="submit" disabled={isDeleting}>
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}
