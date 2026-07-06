import type { D1DatabaseLike } from "@/lib/types";

export interface Env {
  DB: D1DatabaseLike;
}

type PagesFunctionContext<EnvShape> = {
  env: EnvShape;
};

type PagesFunction<EnvShape> = (
  context: PagesFunctionContext<EnvShape>,
) => Promise<Response>;

function getCalgaryDayOfWeek() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    weekday: "long",
  });

  const day = formatter.format(new Date());

  const map: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  return map[day];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.DB;
  const dayOfWeek = getCalgaryDayOfWeek();

  const result = await db
    .prepare(
      `
      SELECT DISTINCT
        mi.id,
        mi.name,
        mi.description,
        mc.name AS category,
        mi.base_price_cents AS price_cents,
        mi.image_url,
        mi.sort_order,
        mi.food_type
      FROM menu_items mi
      LEFT JOIN menu_categories mc
        ON mc.id = mi.category_id
      LEFT JOIN menu_item_availability ma
        ON ma.menu_item_id = mi.id
      WHERE mi.is_active = 1
        AND mi.is_public = 1
        AND (
          ma.id IS NULL
          OR
          (
            ma.availability_type = 'weekly'
            AND ma.is_active = 1
            AND ma.day_of_week = ?
          )
          OR (
            ma.availability_type = 'date_range'
            AND ma.is_active = 1
            AND date('now') BETWEEN ma.start_date AND ma.end_date
          )
        )
      ORDER BY mi.sort_order ASC, mi.name ASC
      `
    )
    .bind(dayOfWeek)
    .all();

  return Response.json({
    items: result.results,
  });
};
