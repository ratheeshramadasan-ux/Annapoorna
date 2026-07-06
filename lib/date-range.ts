export type DateRangeSearchParams = {
  from?: string;
  to?: string;
};

function localDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayLocal() {
  return localDateParts(new Date());
}

export function currentWeekRange() {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Edmonton",
    weekday: "short",
  }).format(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: localDateParts(start), to: localDateParts(end) };
}

export function resolveDateRange(params?: DateRangeSearchParams) {
  const fallback = currentWeekRange();
  return {
    from: params?.from || fallback.from,
    to: params?.to || fallback.to,
  };
}
