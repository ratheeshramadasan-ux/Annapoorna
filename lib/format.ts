export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export function formatPickupDate(value: string) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function nextPickupDate(dayOfWeek: number | null) {
  const now = new Date();
  const today = now.getDay();
  const target = dayOfWeek ?? today;
  let daysToAdd = (target - today + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 1;
  }
  const date = new Date(now);
  date.setDate(now.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}
