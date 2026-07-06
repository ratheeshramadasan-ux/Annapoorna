"use client";

import { useState } from "react";
import { updateOrderPayment } from "@/app/actions";

type OrderPaymentFormProps = {
  orderId: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  amountReceivedCents?: number | null;
  totalCents: number;
  from: string;
  to: string;
};

export default function OrderPaymentForm({
  orderId,
  paymentStatus,
  paymentMethod,
  amountReceivedCents,
  totalCents,
  from,
  to,
}: OrderPaymentFormProps) {
  const [status, setStatus] = useState(paymentStatus);
  const showMethod = status === "paid" || status === "verified" || status === "refunded";
  const defaultAmount = ((amountReceivedCents ?? totalCents) / 100).toFixed(2);

  return (
    <form action={updateOrderPayment} className="inline-form">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <select
        name="payment_status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="unpaid">Unpaid</option>
        <option value="pending_verification">Pending verification</option>
        <option value="paid">Paid</option>
        <option value="verified">Verified</option>
        <option value="refunded">Refunded</option>
      </select>
      {showMethod ? (
        <>
          <select
            name="payment_method"
            defaultValue={paymentMethod ?? "interac"}
            aria-label="Payment method"
          >
            <option value="interac">Interac</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <input
            name="received_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultAmount}
            aria-label="Amount received"
          />
        </>
      ) : (
        <>
          <input type="hidden" name="payment_method" value="none" />
          <input type="hidden" name="received_amount" value="0" />
        </>
      )}
      <button type="submit">Save</button>
    </form>
  );
}
