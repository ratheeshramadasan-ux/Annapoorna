"use client";

import { useMemo, useState } from "react";
import { addHistoricalOrder } from "@/app/actions";
import { formatMoney } from "@/lib/format";
import { isMenuItemAvailableOn } from "@/lib/order-utils";
import type { Customer, CustomerPricingRule, MenuAvailability, MenuItem } from "@/lib/types";

function dateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AdminCalendarOrderForm({
  customers,
  menuItems,
  availability,
  customerPricingRules,
  today,
}: {
  customers: Customer[];
  menuItems: MenuItem[];
  availability: MenuAvailability[];
  customerPricingRules: CustomerPricingRule[];
  today: string;
}) {
  const initial = new Date(`${today}T12:00:00`);
  const [visibleMonth, setVisibleMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState(0);
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const selectedItem = menuItems.find((item) => item.id === menuItemId);

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: count }, (_, index) => dateValue(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const baseUnitPrice = selectedItem?.effective_price_cents ?? selectedItem?.base_price_cents ?? 0;
  const expectedTotal = selectedDates.reduce((sum, date) => {
    if (!selectedItem) return sum;
    const rule = customerPricingRules.find((candidate) => {
      if (candidate.customer_id !== customerId || quantity < candidate.minimum_quantity) return false;
      if (candidate.start_date && candidate.start_date > date) return false;
      if (candidate.end_date && candidate.end_date < date) return false;
      if (candidate.applies_to === "specific_item") return candidate.menu_item_id === selectedItem.id;
      if (candidate.applies_to === "category") return candidate.category_id === selectedItem.category_id;
      return candidate.applies_to === "all_items" || candidate.applies_to === "all";
    });
    let unitPrice = baseUnitPrice;
    if (rule?.pricing_method === "fixed_unit_price" && rule.fixed_unit_price_cents !== null) {
      unitPrice = rule.fixed_unit_price_cents;
    } else if (rule?.pricing_method === "percent_discount" && rule.discount_percent !== null) {
      unitPrice = Math.max(0, Math.round(baseUnitPrice * (1 - rule.discount_percent / 100)));
    }
    return sum + unitPrice * Math.max(1, quantity);
  }, 0);
  const hasSpecialPricing = customerPricingRules.some((rule) => rule.customer_id === customerId);

  function chooseMenu(nextId: number) {
    setMenuItemId(nextId);
    const item = menuItems.find((entry) => entry.id === nextId);
    setSelectedDates((dates) =>
      item
        ? dates.filter(
            (date) => date < today || isMenuItemAvailableOn(item, availability, date),
          )
        : [],
    );
  }

  return (
    <form action={addHistoricalOrder} className="calendar-order-form">
      <div className="calendar-order-fields">
        <label>
          Customer
          <select
            name="customer_id"
            required
            value={customerId || ""}
            onChange={(event) => setCustomerId(Number(event.target.value))}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name} - {customer.phone}
              </option>
            ))}
          </select>
        </label>
        <label>
          Menu item
          <select
            name="menu_item_id"
            required
            value={menuItemId || ""}
            onChange={(event) => chooseMenu(Number(event.target.value))}
          >
            {menuItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {formatMoney(item.effective_price_cents ?? item.base_price_cents)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity per date
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            required
          />
        </label>
        <label>
          Amount received
          <input name="received_amount" type="number" min="0" step="0.01" defaultValue="0" />
        </label>
        <label>
          Payment method
          <select name="payment_method" defaultValue="interac">
            <option value="interac">Interac</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Notes
          <input name="notes" />
        </label>
      </div>

      <input type="hidden" name="selected_dates" value={selectedDates.join(",")} />
      <div className="admin-order-calendar">
        <div className="calendar-toolbar">
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))
            }
          >
            Previous
          </button>
          <strong>
            {visibleMonth.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
          </strong>
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))
            }
          >
            Next
          </button>
        </div>
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-days">
          {calendarDays.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} />;
            const isHistoricalDate = date < today;
            const available = selectedItem
              ? isHistoricalDate || isMenuItemAvailableOn(selectedItem, availability, date)
              : false;
            const selected = selectedDates.includes(date);
            return (
              <button
                key={date}
                type="button"
                disabled={!available}
                className={selected ? "selected" : undefined}
                title={
                  available
                    ? isHistoricalDate
                      ? `${date} (historical entry)`
                      : date
                    : "Menu item is not available on this date"
                }
                onClick={() =>
                  setSelectedDates((dates) =>
                    selected ? dates.filter((entry) => entry !== date) : [...dates, date].sort(),
                  )
                }
              >
                {Number(date.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="calendar-order-summary">
        <span>{selectedDates.length} date{selectedDates.length === 1 ? "" : "s"} selected</span>
        <strong>
          Expected total: {formatMoney(expectedTotal)}
          {hasSpecialPricing ? " (special pricing applied)" : ""}
        </strong>
        <button type="submit" disabled={!selectedItem || selectedDates.length === 0}>
          Add order
        </button>
      </div>
    </form>
  );
}
