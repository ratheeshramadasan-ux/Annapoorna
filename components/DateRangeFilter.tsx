import { currentWeekRange, todayLocal } from "@/lib/date-range";

type DateRangeFilterProps = {
  from: string;
  to: string;
  basePath: string;
  label?: string;
};

export default function DateRangeFilter({
  from,
  to,
  basePath,
  label = "Date range",
}: DateRangeFilterProps) {
  const today = todayLocal();
  const week = currentWeekRange();

  return (
    <form className="date-range-filter" action={basePath}>
      <div>
        <strong>{label}</strong>
        <span>
          <a href={`${basePath}?from=${today}&to=${today}`}>Today</a>
          <a href={`${basePath}?from=${week.from}&to=${week.to}`}>Current week</a>
          <a href={basePath}>Reset</a>
        </span>
      </div>
      <label>
        From
        <input name="from" type="date" defaultValue={from} />
      </label>
      <label>
        To
        <input name="to" type="date" defaultValue={to} />
      </label>
      <button type="submit">Apply</button>
    </form>
  );
}
