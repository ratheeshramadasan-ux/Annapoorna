"use client";

import { useState } from "react";
import { updateCustomer } from "@/app/actions";
import type { Customer } from "@/lib/types";

export default function CustomerEditForm({ customer }: { customer: Customer }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)}>
        Edit
      </button>
    );
  }

  return (
    <form action={updateCustomer} className="inline-form customer-edit-form">
      <input type="hidden" name="customer_id" value={customer.id} />
      <label>
        Name
        <input name="customer_name" defaultValue={customer.full_name} required />
      </label>
      <label>
        Phone
        <input name="customer_phone" type="tel" defaultValue={customer.phone} required />
      </label>
      <label>
        Email
        <input name="customer_email" type="email" defaultValue={customer.email ?? ""} />
      </label>
      <label>
        Preferred contact
        <select name="preferred_contact_method" defaultValue={customer.preferred_contact_method}>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={customer.status}>
          <option value="active">Active</option>
          <option value="pending_verification">Pending verification</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label>
        Notes
        <textarea name="notes" defaultValue={customer.notes ?? ""} rows={2} />
      </label>
      <span className="inline-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={() => setIsOpen(false)}>Cancel</button>
      </span>
    </form>
  );
}
