"use client";

import { useEffect, useState } from "react";

type MenuItem = {
  id: number;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  image_url: string;
  food_type: string;
};

export default function TodayMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMenu() {
      const response = await fetch("/api/menu/today");
      const data = await response.json();
      setItems(data.items || []);
      setLoading(false);
    }

    loadMenu();
  }, []);

  if (loading) {
    return <p className="text-center py-10">Loading today&apos;s menu...</p>;
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <p className="text-orange-600 font-semibold">Fresh Homemade Food</p>
        <h2 className="text-4xl font-bold text-gray-900">
          Today&apos;s Available Menu
        </h2>
        <p className="text-gray-600 mt-3">
          Pre-order required 1 day in advance.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-orange-50 p-8 text-center">
          <h3 className="text-xl font-semibold">No items available today</h3>
          <p className="text-gray-600 mt-2">
            Please message us on WhatsApp for availability.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const price = item.price_cents / 100;

            const message = encodeURIComponent(
              `Hi Annapoorna, I would like to order:\n\nItem: ${item.name}\nPrice: $${price.toFixed(
                2
              )}\n\nPlease confirm availability.`
            );

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white shadow-sm overflow-hidden border"
              >
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-56 w-full object-cover"
                />

                <div className="p-5">
                  <p className="text-sm text-orange-600 font-semibold">
                    {item.category}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`food-type-icon ${item.food_type}`}
                      title={item.food_type === "veg" ? "Vegetarian" : "Non-Vegetarian"}
                    />
                    <h3 className="text-xl font-bold">{item.name}</h3>
                  </div>

                  <p className="text-gray-600 mt-2">{item.description}</p>

                  <div className="flex items-center justify-between mt-5">
                    <p className="text-2xl font-bold">
                      {price > 0 ? `$${price.toFixed(2)}` : "Included"}
                    </p>

                    <a
                      href={`https://wa.me/14034814101?text=${message}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-green-600 px-5 py-2 text-white font-semibold hover:bg-green-700"
                    >
                      Order
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}