"use client";

import { useState } from "react";
import { deleteOrder } from "@/app/actions";

type DeleteOrderButtonProps = {
  orderId: number;
  orderNumber: string;
  from: string;
  to: string;
};

export default function DeleteOrderButton({
  orderId,
  orderNumber,
  from,
  to,
}: DeleteOrderButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <form
      action={deleteOrder}
      className="inline-form delete-order-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete order ${orderNumber}? This will remove related payments, reviews, messages, and notifications.`,
        );
        if (!confirmed) {
          event.preventDefault();
          return;
        }
        setIsDeleting(true);
      }}
    >
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <button className="danger-button" type="submit" disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </form>
  );
}
