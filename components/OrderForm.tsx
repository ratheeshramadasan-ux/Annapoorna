"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { submitOrder } from "@/app/actions";
import { formatMoney, formatPickupDate } from "@/lib/format";
import {
  effectivePrice,
  isMenuItemAvailableOn,
  isThaliPlanAvailableOn,
  selectedDateForOrderType,
  type OrderType,
} from "@/lib/order-utils";
import type {
  MenuAvailability,
  MenuCategory,
  MenuItem,
  MenuPrice,
  PickupSlot,
  PricingRule,
  ThaliPlan,
} from "@/lib/types";

type OrderFormProps = {
  categories: MenuCategory[];
  items: MenuItem[];
  availability: MenuAvailability[];
  prices: MenuPrice[];
  thaliPlans: ThaliPlan[];
  pricingRules: PricingRule[];
  pickupSlots: PickupSlot[];
  settings: Record<string, string>;
};

const orderTypes: Array<{ key: OrderType; label: string; description: string }> = [
  { key: "daily", label: "Daily Thali", description: "Choose one pickup date." },
  { key: "weekly", label: "Weekly Thali", description: "Choose a week and days." },
  { key: "monthly", label: "Monthly Thali", description: "Choose a date range." },
  { key: "bulk", label: "Bulk Order", description: "Event orders with notice." },
];

const days = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

function todayPlus(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

export default function OrderForm({
  categories,
  items,
  availability,
  prices,
  thaliPlans,
  pickupSlots,
  settings,
}: OrderFormProps) {
  const [orderType, setOrderType] = useState<OrderType>("daily");
  const [dailyDate, setDailyDate] = useState(todayPlus(1));
  const [weekStartDate, setWeekStartDate] = useState(todayPlus(1));
  const [startDate, setStartDate] = useState(todayPlus(1));
  const [endDate, setEndDate] = useState(todayPlus(30));
  const [bulkDate, setBulkDate] = useState(todayPlus(3));
  const [selectedDays, setSelectedDays] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [planQuantities, setPlanQuantities] = useState<Record<number, number>>({});
  const [slotId, setSlotId] = useState(String(pickupSlots[0]?.id ?? ""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionToken = useRef(
    globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const deliveryEnabled = settings.delivery_enabled === "true";
  const selectedDate = selectedDateForOrderType(
    orderType,
    dailyDate,
    weekStartDate,
    startDate,
    bulkDate,
  );
  const defaultVegThaliImage = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "veg"
  )?.image_url ?? "/assets/veg-thali.png";

  const defaultNonVegThaliImage = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "nonveg"
  )?.image_url ?? "/assets/veg-thali.png";

  const showPlans = orderType === "daily" || orderType === "weekly" || orderType === "monthly";
  const visiblePlans = thaliPlans.filter(
    (plan) => plan.plan_type === orderType && isThaliPlanAvailableOn(plan, selectedDate),
  );
  const visibleItems = items.filter((item) => {
    if (item.public_sold_out === 1) {
      return false;
    }
    if (orderType === "bulk" && item.bulk_order_eligible !== 1) {
      return false;
    }
    if ((orderType === "weekly" || orderType === "monthly") && item.category_name !== "Thali") {
      return false;
    }
    return isMenuItemAvailableOn(item, availability, selectedDate);
  });

  const summary = useMemo(() => {
    const itemLines = visibleItems
      .map((item) => {
        const quantity = itemQuantities[item.id] ?? 0;
        const price = effectivePrice(
          prices,
          selectedDate,
          {
            menuItemId: item.id,
            priceType: orderType === "bulk" ? "bulk" : "regular",
          },
          item.base_price_cents,
        );
        return { id: `item-${item.id}`, name: item.name, quantity, price };
      })
      .filter((line) => line.quantity > 0);
    const planLines = visiblePlans
      .map((plan) => {
        const quantity = planQuantities[plan.id] ?? 0;
        const price = effectivePrice(
          prices,
          selectedDate,
          { thaliPlanId: plan.id, priceType: "subscription" },
          plan.effective_price_cents ?? 0,
        );
        return { id: `plan-${plan.id}`, name: plan.name, quantity, price };
      })
      .filter((line) => line.quantity > 0);
    const lines = [...planLines, ...itemLines];
    return {
      lines,
      total: lines.reduce((sum, line) => sum + line.quantity * line.price, 0),
    };
  }, [
    itemQuantities,
    orderType,
    planQuantities,
    prices,
    selectedDate,
    visibleItems,
    visiblePlans,
  ]);

  function selectOrderType(type: OrderType) {
    setOrderType(type);
  }

  function handleOrderTypeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + orderTypes.length) % orderTypes.length;
    selectOrderType(orderTypes[nextIndex].key);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  }

  return (
    <form
      action={submitOrder}
      className="step-order-form"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input type="hidden" name="submission_token" value={submissionToken.current} />
      <input type="hidden" name="order_type" value={orderType} />
      <input type="hidden" name="selected_start_date" value={selectedDate} />
      <input type="hidden" name="selected_end_date" value={orderType === "monthly" ? endDate : selectedDate} />
      <input type="hidden" name="selected_days" value={selectedDays.join(",")} />

      <div className="order-main-column">
        <div className="order-top-grid">
          <section className="order-step">
            <p>Step 1</p>
            <h3>Select order type</h3>
            <div className="segmented-grid order-type-tabs" role="tablist" aria-label="Order type">
              {orderTypes.map((type, index) => (
                <button
                  key={type.key}
                  type="button"
                  role="tab"
                  aria-selected={orderType === type.key}
                  className={orderType === type.key ? "selected" : undefined}
                  onClick={() => selectOrderType(type.key)}
                  onKeyDown={(event) => handleOrderTypeKeyDown(event, index)}
                >
                  <strong>{type.label}</strong>
                  <span>{type.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="order-step">
            <p>Step 2</p>
            <h3>Select date or plan window</h3>
            {orderType === "daily" ? (
              <label>
                Order date
                <input name="daily_date" type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
              </label>
            ) : null}
            {orderType === "weekly" ? (
              <>
                <label>
                  Week start date
                  <input name="week_start_date" type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} />
                </label>
                <DaySelector selectedDays={selectedDays} setSelectedDays={setSelectedDays} />
              </>
            ) : null}
            {orderType === "monthly" ? (
              <>
                <div className="two-column-fields">
                  <label>
                    Start date
                    <input name="monthly_start_date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label>
                    End date
                    <input name="monthly_end_date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                </div>
                <DaySelector selectedDays={selectedDays} setSelectedDays={setSelectedDays} />
              </>
            ) : null}
            {orderType === "bulk" ? (
              <label>
                Event/order date
                <input name="bulk_date" type="date" value={bulkDate} onChange={(event) => setBulkDate(event.target.value)} />
              </label>
            ) : null}
          </section>
        </div>

        <section className="order-step">
          <p>Step 3</p>
          <h3>Available menu</h3>
          {showPlans && visiblePlans.length > 0 ? (
            <div className="menu-section">
              <div className="section-title">
                <h3>Thali Plans</h3>
                <p>Available for {formatPickupDate(selectedDate)}</p>
              </div>
              {visiblePlans.map((plan) => {
                const price = effectivePrice(
                  prices,
                  selectedDate,
                  { thaliPlanId: plan.id, priceType: "subscription" },
                  plan.effective_price_cents ?? 0,
                );
                const isPlanNonVeg = plan.name.toLowerCase().includes("nonveg") || plan.name.toLowerCase().includes("non-veg");
                const planImage = isPlanNonVeg ? defaultNonVegThaliImage : defaultVegThaliImage;

                return (
                  <article key={plan.id} className="menu-row">
                    <div className="menu-row-content">
                      <div className="menu-row-image">
                        {planImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={planImage} alt={plan.name} />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>
                      <div>
                        <div className="menu-row-title">
                          <h4>{plan.name}</h4>
                          <span>{plan.plan_type}</span>
                        </div>
                        {plan.description ? <p>{plan.description}</p> : null}
                      </div>
                    </div>
                    <QuantityBox
                      name={`thali_quantity_${plan.id}`}
                      value={planQuantities[plan.id] ?? 0}
                      price={price}
                      onChange={(value) =>
                        setPlanQuantities((current) => ({ ...current, [plan.id]: value }))
                      }
                    />
                  </article>
                );
              })}
            </div>
          ) : null}

          {categories.map((category) => {
            const categoryItems = visibleItems.filter((item) => item.category_id === category.id);
            if (categoryItems.length === 0) {
              return null;
            }
            return (
              <section key={category.id} className="menu-section">
                <div className="section-title">
                  <h3>{category.name}</h3>
                  {category.description ? <p>{category.description}</p> : null}
                </div>
                {categoryItems.map((item) => {
                  const price = effectivePrice(
                    prices,
                    selectedDate,
                    {
                      menuItemId: item.id,
                      priceType: orderType === "bulk" ? "bulk" : "regular",
                    },
                    item.base_price_cents,
                  );
                  return (
                    <article key={item.id} className="menu-row">
                      <div className="menu-row-content">
                        <div className="menu-row-image">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt="" />
                          ) : (
                            <span>No image</span>
                          )}
                        </div>
                        <div>
                          <div className="menu-row-title">
                            <span
                              className={`food-type-icon ${item.food_type}`}
                              title={item.food_type === "veg" ? "Vegetarian" : "Non-Vegetarian"}
                            />
                            <h4>{item.name}</h4>
                            {orderType === "bulk" ? <span>Bulk eligible</span> : null}
                          </div>
                          {item.description ? (
                            <div
                              className="menu-description"
                              dangerouslySetInnerHTML={{ __html: item.description }}
                            />
                          ) : null}
                          <div className="bulk-line">
                            <span>{item.serving_unit}</span>
                            {item.serving_definition ? <span>{item.serving_definition}</span> : null}
                            {orderType === "bulk" && item.min_bulk_quantity ? (
                              <span>Min {item.min_bulk_quantity}</span>
                            ) : null}
                            {orderType === "bulk" ? (
                              <span>{item.bulk_notice_hours}h notice</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <QuantityBox
                        name={`quantity_${item.id}`}
                        value={itemQuantities[item.id] ?? 0}
                        min={orderType === "bulk" ? item.min_bulk_quantity ?? 0 : 0}
                        max={item.max_bulk_quantity ?? 1000}
                        price={price}
                        onChange={(value) =>
                          setItemQuantities((current) => ({ ...current, [item.id]: value }))
                        }
                      />
                    </article>
                  );
                })}
              </section>
            );
          })}
          {visibleItems.length === 0 && visiblePlans.length === 0 ? (
            <div className="empty-state">
              <h3>No available items</h3>
              <p>Try another date or order type.</p>
            </div>
          ) : null}
        </section>

        <div className="order-bottom-grid">
          <section className="order-step">
            <p>Step 4</p>
            <h3>Fulfillment</h3>
            <div className="segmented-grid fulfillment-grid" role="tablist" aria-label="Fulfillment method">
              <button
                type="button"
                role="tab"
                aria-selected={fulfillment === "pickup"}
                className={fulfillment === "pickup" ? "selected" : undefined}
                onClick={() => setFulfillment("pickup")}
              >
                <strong>Pickup</strong>
                <span>Always available</span>
              </button>
              {deliveryEnabled ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={fulfillment === "delivery"}
                  className={fulfillment === "delivery" ? "selected" : undefined}
                  onClick={() => setFulfillment("delivery")}
                >
                  <strong>Delivery</strong>
                  <span>{settings.delivery_service_area_note || "Address required"}</span>
                </button>
              ) : null}
            </div>
            <input type="hidden" name="fulfillment_method" value={fulfillment} />
            {!deliveryEnabled ? (
              <p className="pickup-note">Currently available for pickup only.</p>
            ) : null}
            {fulfillment === "pickup" ? (
              <label>
                Pickup slot
                <select name="pickup_slot_id" value={slotId} onChange={(event) => setSlotId(event.target.value)}>
                  {pickupSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.name} ({slot.start_time}-{slot.end_time})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="two-column-fields">
                <label>
                  Delivery address
                  <input name="delivery_address" required={fulfillment === "delivery"} />
                </label>
                <label>
                  City
                  <input name="delivery_city" required={fulfillment === "delivery"} />
                </label>
                <label>
                  Postal code
                  <input name="delivery_postal_code" required={fulfillment === "delivery"} />
                </label>
                <label>
                  Instructions
                  <input name="delivery_instructions" />
                </label>
              </div>
            )}
          </section>

          <section className="order-step">
            <p>Step 5</p>
            <h3>Customer details</h3>
            <div className="two-column-fields">
              <label>
                Name
                <input name="customer_name" required />
              </label>
              <label>
                Phone
                <input name="customer_phone" type="tel" required />
              </label>
              <label>
                Email
                <input name="customer_email" type="email" />
              </label>
              <label>
                Allergy notes
                <input name="allergy_notes" />
              </label>
            </div>
            <label>
              Order notes
              <textarea name="customer_notes" rows={4} />
            </label>
          </section>
        </div>
      </div>

      <aside className="checkout-panel order-summary-panel">
        <p>Step 6</p>
        <h3>Summary</h3>
        <div className="line-list">
          <div>
            <span>Order type</span>
            <strong>{orderType}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatPickupDate(selectedDate)}</strong>
          </div>
          <div>
            <span>Fulfillment</span>
            <strong>{fulfillment}</strong>
          </div>
          {summary.lines.map((line) => (
            <div key={line.id}>
              <span>
                {line.quantity} x {line.name}
              </span>
              <strong>{formatMoney(line.quantity * line.price)}</strong>
            </div>
          ))}
        </div>
        <div className="order-total">
          <span>Total amount</span>
          <strong>{formatMoney(summary.total)}</strong>
        </div>
        <button className="gold-button full-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Order"}
        </button>
        <p className="fine-print">Orders are created as pending for confirmation.</p>
      </aside>
    </form>
  );
}

function QuantityBox({
  name,
  value,
  price,
  min = 0,
  max = 1000,
  onChange,
}: {
  name: string;
  value: number;
  price: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="item-controls">
      <strong>{formatMoney(price)}</strong>
      <label>
        <span>Qty</span>
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
        />
      </label>
    </div>
  );
}

function DaySelector({
  selectedDays,
  setSelectedDays,
}: {
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
}) {
  return (
    <div className="day-selector">
      {days.map(([value, label]) => (
        <label key={value} className="checkbox-line">
          <input
            type="checkbox"
            checked={selectedDays.includes(value)}
            onChange={(event) =>
              setSelectedDays(
                event.target.checked
                  ? [...selectedDays, value]
                  : selectedDays.filter((day) => day !== value),
              )
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
}
