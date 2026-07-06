import type { MenuAvailability, MenuItem, MenuPrice, ThaliPlan } from "./types";

export type OrderType = "daily" | "weekly" | "monthly" | "bulk";

export function dayOfWeekFromDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`).getDay();
}

export function isWithinDateRange(
  dateValue: string,
  startDate?: string | null,
  endDate?: string | null,
) {
  if (startDate && dateValue < startDate) {
    return false;
  }
  if (endDate && dateValue > endDate) {
    return false;
  }
  return true;
}

export function isMenuItemAvailableOn(
  item: MenuItem,
  availability: MenuAvailability[],
  dateValue: string,
) {
  if (!isWithinDateRange(dateValue, item.menu_start_date, item.menu_end_date)) {
    return false;
  }
  const rules = availability.filter((rule) => rule.menu_item_id === item.id);
  if (rules.length === 0) {
    return true;
  }
  const day = dayOfWeekFromDate(dateValue);
  return rules.some((rule) => {
    if (!isWithinDateRange(dateValue, rule.start_date, rule.end_date)) {
      return false;
    }
    if (rule.specific_date) {
      return rule.specific_date === dateValue;
    }
    return rule.day_of_week === day;
  });
}

export function isThaliPlanAvailableOn(plan: ThaliPlan, dateValue: string) {
  if (!isWithinDateRange(dateValue, plan.start_date, plan.end_date)) {
    return false;
  }
  if (!plan.available_days) {
    return true;
  }
  const days = plan.available_days.split(",").map((value) => Number(value));
  return days.includes(dayOfWeekFromDate(dateValue));
}

export function effectivePrice(
  prices: MenuPrice[],
  dateValue: string,
  target: { menuItemId?: number; thaliPlanId?: number; priceType?: string },
  fallbackCents = 0,
) {
  const match = prices.find((price) => {
    if (target.menuItemId && price.menu_item_id !== target.menuItemId) {
      return false;
    }
    if (target.thaliPlanId && price.thali_plan_id !== target.thaliPlanId) {
      return false;
    }
    if (target.priceType && price.price_type !== target.priceType) {
      return false;
    }
    return isWithinDateRange(dateValue, price.effective_from, price.effective_to);
  });
  return match?.price_cents ?? fallbackCents;
}

export function selectedDateForOrderType(
  orderType: OrderType,
  dailyDate: string,
  weekStartDate: string,
  startDate: string,
  bulkDate: string,
) {
  if (orderType === "weekly") {
    return weekStartDate || dailyDate;
  }
  if (orderType === "monthly") {
    return startDate || dailyDate;
  }
  if (orderType === "bulk") {
    return bulkDate || dailyDate;
  }
  return dailyDate;
}
