"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { recordPayment } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import type { Customer, Order } from "@/lib/types";

function PaymentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Recording payment…" : "Record payment"}
    </button>
  );
}

export default function AdminPaymentForm({
  orders,
  customers,
  paymentDate,
}: {
  orders: Order[];
  customers: Customer[];
  paymentDate: string;
}) {
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");

  function populateCustomer(customer: Customer | undefined) {
    setCustomerId(customer ? String(customer.id) : "");
    setName(customer?.full_name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
  }

  return (
    <form action={recordPayment} className="admin-form-grid">
      <label>
        Payment date
        <input name="payment_date" type="date" defaultValue={paymentDate} required />
      </label>
      <label>
        Order optional
        <select
          name="order_id"
          defaultValue=""
          onChange={(event) => {
            const order = orders.find((item) => item.id === Number(event.target.value));
            if (!order) return;
            setCustomerId(order.customer_id ? String(order.customer_id) : "");
            setName(order.customer_name);
            setPhone(order.customer_phone);
            setEmail(order.customer_email ?? "");
            setAmount((order.total_cents / 100).toFixed(2));
          }}
        >
          <option value="">Unlinked past payment</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.order_number} - {formatMoney(order.total_cents)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Existing customer
        <select
          value={customerId}
          onChange={(event) =>
            populateCustomer(customers.find((customer) => customer.id === Number(event.target.value)))
          }
        >
          <option value="">Enter customer manually</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name} - {customer.phone}
            </option>
          ))}
        </select>
        <input type="hidden" name="customer_id" value={customerId} />
      </label>
      <label>
        Customer name
        <input name="customer_name" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Customer phone
        <input name="customer_phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label>
        Customer email
        <input name="customer_email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Method
        <select name="payment_method" defaultValue="interac">
          <option value="interac">Interac</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>
        Status
        <select name="payment_status" defaultValue="verified">
          <option value="pending_verification">Pending verification</option>
          <option value="partial">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="verified">Verified</option>
        </select>
      </label>
      <label>
        Received amount
        <input
          name="received_amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      <label>
        Reference
        <input name="payment_reference" />
      </label>
      <label>
        Notes
        <input name="notes" />
      </label>
      <PaymentSubmitButton />
    </form>
  );
}
