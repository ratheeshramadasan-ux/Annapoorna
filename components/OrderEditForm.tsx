"use client";

import { useState } from "react";
import { updateOrderDetails } from "@/app/actions";
import type { Order } from "@/lib/types";

type OrderEditFormProps = {
  order: Order;
  from: string;
  to: string;
};

export default function OrderEditForm({ order, from, to }: OrderEditFormProps) {
  const [open, setOpen] = useState(false);
  const [fulfillment, setFulfillment] = useState(order.fulfillment_method || "pickup");

  return (
    <div className="order-edit-wrap">
      <button type="button" className="outline-dark-button compact-action" onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Edit"}
      </button>
      {open ? (
        <form action={updateOrderDetails} className="order-edit-form">
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <label>
            Customer
            <input name="customer_name" defaultValue={order.customer_name} required />
          </label>
          <label>
            Phone
            <input name="customer_phone" type="tel" defaultValue={order.customer_phone} required />
          </label>
          <label>
            Email
            <input name="customer_email" type="email" defaultValue={order.customer_email ?? ""} />
          </label>
          <label>
            Pickup date
            <input name="pickup_date" type="date" defaultValue={order.pickup_date} required />
          </label>
          <label>
            Pickup time
            <input name="pickup_time" type="time" defaultValue={order.pickup_time} required />
          </label>
          <label>
            Fulfillment
            <select
              name="fulfillment_method"
              value={fulfillment}
              onChange={(event) => setFulfillment(event.target.value)}
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
          <label className="wide-field">
            Selected days
            <input name="selected_days" defaultValue={order.selected_days ?? ""} placeholder="YYYY-MM-DD,YYYY-MM-DD" />
          </label>
          {fulfillment === "delivery" ? (
            <>
              <label>
                Address
                <input name="delivery_address" defaultValue={order.delivery_address ?? ""} />
              </label>
              <label>
                City
                <input name="delivery_city" defaultValue={order.delivery_city ?? ""} />
              </label>
              <label>
                Postal code
                <input name="delivery_postal_code" defaultValue={order.delivery_postal_code ?? ""} />
              </label>
              <label>
                Instructions
                <input name="delivery_instructions" defaultValue={order.delivery_instructions ?? ""} />
              </label>
            </>
          ) : null}
          <label className="wide-field">
            Allergy notes
            <input name="allergy_notes" defaultValue={order.allergy_notes ?? ""} />
          </label>
          <label className="wide-field">
            Customer notes
            <textarea name="customer_notes" rows={3} defaultValue={order.customer_notes ?? ""} />
          </label>
          <button type="submit">Save order</button>
        </form>
      ) : null}
    </div>
  );
}
