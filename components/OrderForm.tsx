"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
  Holiday,
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
  holidays: Holiday[];
  settings: Record<string, string>;
  error?: string;
};

const orderTypes: Array<{ key: OrderType; label: string; description: string }> = [
  { key: "daily", label: "Daily Order", description: "Choose one pickup date." },
  { key: "weekly", label: "Weekly Thali", description: "Choose a week and days." },
  { key: "monthly", label: "Monthly Thali", description: "Choose a date range." },
  { key: "bulk", label: "Bulk Order", description: "Event orders with notice." },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayPlus(daysToAdd: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function firstValidOrderDate(
  settings: Record<string, string>,
  pickupSlots: PickupSlot[],
  holidays: Holiday[],
  noticeHours = Number(settings.order_cutoff_hours_before_pickup ?? 24),
) {
  const sameDayEnabled = settings.same_day_order_enabled === "true";
  for (let daysToAdd = sameDayEnabled ? 0 : 1; daysToAdd <= 60; daysToAdd += 1) {
    const date = todayPlus(daysToAdd);
    if (holidayForDate(date, holidays)) {
      continue;
    }
    const day = dateFromValue(date).getDay();
    const slotsForDay = pickupSlots.filter((slot) => slot.day_of_week === day || slot.day_of_week === null);
    const slot = slotsForDay[0] ?? pickupSlots[0];
    const pickupDateTime = new Date(`${date}T${slot?.start_time ?? "12:00"}:00`);
    if (pickupDateTime.getTime() - Date.now() >= noticeHours * 60 * 60 * 1000) {
      return date;
    }
  }
  return todayPlus(2);
}

function dateFromValue(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValueString: string, daysToAdd: number) {
  const date = dateFromValue(dateValueString);
  date.setDate(date.getDate() + daysToAdd);
  return dateValue(date);
}

function holidayForDate(dateValueString: string, holidays: Holiday[]) {
  return holidays.find((holiday) => {
    if (holiday.is_active !== 1) {
      return false;
    }
    const endDate = holiday.end_date || holiday.holiday_date;
    return dateValueString >= holiday.holiday_date && dateValueString <= endDate;
  });
}

function weekdaysInWindow(startDate: string, durationDays: number, holidays: Holiday[]) {
  return Array.from({ length: durationDays }, (_, index) => {
    const date = dateFromValue(startDate);
    date.setDate(date.getDate() + index);
    return date;
  })
    .filter((date) => {
      const day = date.getDay();
      return day >= 1 && day <= 5;
    })
    .map((date) => ({
      value: dateValue(date),
      label: `${weekdayLabels[date.getDay()]} ${date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`,
      holiday: holidayForDate(dateValue(date), holidays),
    }));
}

function planFoodType(plan: ThaliPlan) {
  const text = `${plan.name} ${plan.description ?? ""}`.toLowerCase();
  return text.includes("nonveg") ||
    text.includes("non-veg") ||
    text.includes("chicken") ||
    text.includes("fish") ||
    text.includes("egg")
    ? "nonveg"
    : "veg";
}

export default function OrderForm({
  categories,
  items,
  availability,
  prices,
  thaliPlans,
  pickupSlots,
  holidays,
  settings,
  error,
}: OrderFormProps) {
  const regularNoticeHours = Number(settings.order_cutoff_hours_before_pickup ?? 24);
  const bulkNoticeHours = Math.max(
    regularNoticeHours,
    ...items.filter((item) => item.bulk_order_eligible === 1).map((item) => item.bulk_notice_hours ?? 24),
  );
  const initialValidDate = firstValidOrderDate(settings, pickupSlots, holidays, regularNoticeHours);
  const initialBulkDate = firstValidOrderDate(settings, pickupSlots, holidays, bulkNoticeHours);
  const [orderType, setOrderType] = useState<OrderType>("daily");
  const [dailyDate, setDailyDate] = useState(initialValidDate);
  const [weekStartDate, setWeekStartDate] = useState(initialValidDate);
  const [startDate, setStartDate] = useState(initialValidDate);
  const [bulkDate, setBulkDate] = useState(initialBulkDate);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [planQuantities, setPlanQuantities] = useState<Record<number, number>>({});
  const [slotId, setSlotId] = useState(String(pickupSlots[0]?.id ?? ""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
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
  const selectedEndDate =
    orderType === "weekly"
      ? addDays(weekStartDate, 13)
      : orderType === "monthly"
        ? addDays(startDate, 39)
        : selectedDate;
  const selectableDates =
    orderType === "weekly"
      ? weekdaysInWindow(weekStartDate, 14, holidays)
      : orderType === "monthly"
        ? weekdaysInWindow(startDate, 40, holidays)
        : [];
  const selectedHoliday = holidayForDate(selectedDate, holidays);
  const defaultVegThaliImage = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "veg"
  )?.image_url ?? "/assets/veg-thali.png";

  const defaultNonVegThaliImage = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "nonveg"
  )?.image_url ?? "/assets/veg-thali.png";
  const defaultVegThaliDescription = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "veg"
  )?.description;
  const defaultNonVegThaliDescription = items.find(
    (item) => item.category_name === "Thali" && item.food_type === "nonveg"
  )?.description;

  const showPlans = orderType === "daily" || orderType === "weekly" || orderType === "monthly";
  const visiblePlans = thaliPlans.filter(
    (plan) => plan.plan_type === orderType && isThaliPlanAvailableOn(plan, selectedDate),
  );
  useEffect(() => {
    setSelectedDays([]);
  }, [orderType]);

  useEffect(() => {
    if (orderType === "weekly") {
      setSelectedDays(
        weekdaysInWindow(weekStartDate, 14, holidays)
          .filter((date) => !date.holiday)
          .slice(0, 5)
          .map((date) => date.value),
      );
    }
  }, [holidays, orderType, weekStartDate]);

  useEffect(() => {
    if (orderType === "monthly") {
      setSelectedDays(
        weekdaysInWindow(startDate, 40, holidays)
          .filter((date) => !date.holiday)
          .slice(0, 20)
          .map((date) => date.value),
      );
    }
  }, [holidays, orderType, startDate]);

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (orderType === "weekly" || orderType === "monthly") {
          return false;
        }
        if (item.public_sold_out === 1) {
          return false;
        }
        if (orderType === "bulk" && item.bulk_order_eligible !== 1) {
          return false;
        }
        return isMenuItemAvailableOn(item, availability, selectedDate);
      }),
    [availability, items, orderType, selectedDate],
  );
  const visibleCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          items: visibleItems.filter((item) => item.category_id === category.id),
        }))
        .filter((entry) => entry.items.length > 0),
    [categories, visibleItems],
  );
  const activeCategory =
    visibleCategories.find((entry) => entry.category.id === activeCategoryId) ??
    visibleCategories[0] ??
    null;

  useEffect(() => {
    if (
      activeCategoryId &&
      visibleCategories.some((entry) => entry.category.id === activeCategoryId)
    ) {
      return;
    }
    setActiveCategoryId(visibleCategories[0]?.category.id ?? null);
  }, [activeCategoryId, visibleCategories]);

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
      <input type="hidden" name="selected_end_date" value={selectedEndDate} />
      <input type="hidden" name="selected_days" value={selectedDays.join(",")} />
      {error ? <p className="form-error order-form-error">{error}</p> : null}
      {selectedHoliday ? (
        <p className="form-error order-form-error">
          {formatPickupDate(selectedDate)} is blocked for {selectedHoliday.name}. Please choose another date.
        </p>
      ) : null}

      <div className="order-main-column">
        <div className="order-setup-pane">
          <section className="order-step customer-details-step setup-customer-step">
            <p>Step 1</p>
            <h3>Customer details</h3>
            <div className="two-column-fields customer-field-grid">
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
              <textarea name="customer_notes" rows={3} />
            </label>
          </section>

          <section className="order-step order-type-step">
            <p>Step 2</p>
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

          <section className="order-step date-step">
            <p>Step 3</p>
            <h3>Select date or plan window</h3>
            {orderType === "daily" ? (
              <label>
                Order date
                <input
                  name="daily_date"
                  type="date"
                  min={initialValidDate}
                  value={dailyDate}
                  onChange={(event) => setDailyDate(event.target.value)}
                />
              </label>
            ) : null}
            {orderType === "weekly" ? (
              <>
                <label>
                  Week start date
                  <input
                    name="week_start_date"
                    type="date"
                    min={initialValidDate}
                    value={weekStartDate}
                    onChange={(event) => setWeekStartDate(event.target.value)}
                  />
                </label>
                <DateSelector
                  dates={selectableDates}
                  selectedDays={selectedDays}
                  setSelectedDays={setSelectedDays}
                  maxSelected={5}
                  summary={`Choose up to 5 weekdays between ${formatPickupDate(weekStartDate)} and ${formatPickupDate(selectedEndDate)}.`}
                />
              </>
            ) : null}
            {orderType === "monthly" ? (
              <>
                <div className="two-column-fields">
                  <label>
                    Start date
                    <input
                      name="monthly_start_date"
                      type="date"
                      min={initialValidDate}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </label>
                  <div className="date-window-note">
                    <span>Plan window</span>
                    <strong>{formatPickupDate(startDate)} to {formatPickupDate(selectedEndDate)}</strong>
                  </div>
                </div>
                <DateSelector
                  dates={selectableDates}
                  selectedDays={selectedDays}
                  setSelectedDays={setSelectedDays}
                  maxSelected={20}
                  summary="Choose up to 20 weekdays within the 40-day monthly window."
                />
              </>
            ) : null}
            {orderType === "bulk" ? (
              <label>
                Event/order date
                <input
                  name="bulk_date"
                  type="date"
                  min={initialBulkDate}
                  value={bulkDate}
                  onChange={(event) => setBulkDate(event.target.value)}
                />
              </label>
            ) : null}
          </section>

          <section className="order-step fulfillment-step setup-fulfillment-step">
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
                <span>Available</span>
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
              <p className="pickup-note">Pickup only.</p>
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
        </div>

        <section className="order-step menu-order-step">
          <p>Step 5</p>
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
                const foodType = planFoodType(plan);
                const planImage = foodType === "nonveg" ? defaultNonVegThaliImage : defaultVegThaliImage;
                const fallbackDescription =
                  foodType === "nonveg" ? defaultNonVegThaliDescription : defaultVegThaliDescription;

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
                          <FoodTypeIcon type={foodType} />
                          <h4>{plan.name}</h4>
                          <span>{plan.plan_type}</span>
                        </div>
                        {fallbackDescription ? (
                          <div
                            className="menu-description"
                            dangerouslySetInnerHTML={{ __html: fallbackDescription }}
                          />
                        ) : plan.description ? (
                          <p>{plan.description}</p>
                        ) : null}
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

          {activeCategory ? (
            <section className="menu-section compact-menu-section">
              <div className="category-tabs" role="tablist" aria-label="Menu categories">
                {visibleCategories.map(({ category, items: categoryItems }) => (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory.category.id === category.id}
                    className={activeCategory.category.id === category.id ? "selected" : undefined}
                    onClick={() => setActiveCategoryId(category.id)}
                  >
                    <span>{category.name}</span>
                    <strong>{categoryItems.length}</strong>
                  </button>
                ))}
              </div>
                <div className="section-title">
                  <h3>{activeCategory.category.name}</h3>
                  {activeCategory.category.description ? <p>{activeCategory.category.description}</p> : null}
                </div>
                <div className="compact-menu-list">
                {activeCategory.items.map((item) => {
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
                            <FoodTypeIcon type={item.food_type === "nonveg" ? "nonveg" : "veg"} />
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
                </div>
              </section>
          ) : null}
          {visibleItems.length === 0 && visiblePlans.length === 0 ? (
            <div className="empty-state">
              <h3>No available items</h3>
              <p>Try another date or order type.</p>
            </div>
          ) : null}
        </section>
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
        <button className="gold-button full-button" type="submit" disabled={isSubmitting || Boolean(selectedHoliday)}>
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

function FoodTypeIcon({ type }: { type: "veg" | "nonveg" }) {
  return (
    <span className={`food-type-badge ${type}`} title={type === "veg" ? "Vegetarian" : "Non-Vegetarian"}>
      <span className="food-type-icon" />
      <span>{type === "veg" ? "Veg" : "Non-Veg"}</span>
    </span>
  );
}

function DateSelector({
  dates,
  selectedDays,
  setSelectedDays,
  maxSelected,
  summary,
}: {
  dates: Array<{ value: string; label: string; holiday?: Holiday }>;
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
  maxSelected: number;
  summary: string;
}) {
  return (
    <div className="date-selector-wrap">
      <p className="date-selector-summary">
        {summary} Selected {selectedDays.length}/{maxSelected}.
      </p>
      <div className="day-selector">
      {dates.map(({ value, label, holiday }) => (
        <label key={value} className="checkbox-line">
          <input
            type="checkbox"
            checked={selectedDays.includes(value)}
            onChange={(event) => {
              if (!event.target.checked) {
                setSelectedDays(selectedDays.filter((day) => day !== value));
                return;
              }
              if (!selectedDays.includes(value)) {
                setSelectedDays([...selectedDays, value].slice(0, maxSelected));
              }
            }}
            disabled={Boolean(holiday) || (!selectedDays.includes(value) && selectedDays.length >= maxSelected)}
          />
          {holiday ? `${label} - blocked: ${holiday.name}` : label}
        </label>
      ))}
      </div>
    </div>
  );
}
