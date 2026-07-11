"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMenuCategory,
  addMenuItem,
  updateMenuCategory,
  updateMenuItem,
} from "@/app/actions";
import ImageUploadField from "@/components/ImageUploadField";
import RichTextField from "@/components/RichTextField";
import { formatMoney } from "@/lib/format";
import type {
  MenuAvailability,
  MenuCategory,
  MenuItem,
  MenuItemIngredient,
  MenuPrice,
} from "@/lib/types";

type AdminMenuManagerProps = {
  saved?: string;
  savedItemId?: number | null;
  categories: MenuCategory[];
  items: MenuItem[];
  availability: MenuAvailability[];
  prices: MenuPrice[];
  recipes: MenuItemIngredient[];
};

const dayOptions = [
  [0, "Sun"],
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
] as const;

const servingUnits = ["plate", "cup", "litre", "piece", "box", "kg", "gram", "ml"];

function priceForItem(prices: MenuPrice[], itemId: number, priceType: MenuPrice["price_type"]) {
  const matches = prices
    .filter((price) => price.menu_item_id === itemId && price.price_type === priceType)
    .sort((a, b) => {
      if (!a.effective_to && b.effective_to) return -1;
      if (a.effective_to && !b.effective_to) return 1;
      if (a.effective_from !== b.effective_from) {
        return b.effective_from.localeCompare(a.effective_from);
      }
      return b.id - a.id;
    });
  return matches[0];
}

function priceInputValue(cents?: number | null) {
  return cents === undefined || cents === null ? "" : (cents / 100).toFixed(2);
}

function availabilityText(rules: MenuAvailability[]) {
  if (rules.length === 0) {
    return "All days";
  }
  return rules
    .map((rule) => dayOptions.find(([value]) => value === rule.day_of_week)?.[1])
    .filter(Boolean)
    .join(", ");
}

function recipeLines(recipes: MenuItemIngredient[]) {
  return recipes
    .map(
      (recipe) =>
        `${recipe.ingredient_name} | ${recipe.quantity_required} | ${recipe.unit} | ${recipe.quantity_basis}`,
    )
    .join("\n");
}

function plainText(value?: string | null) {
  if (!value) {
    return "";
  }
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeMenuImageUrl(value?: string | null) {
  if (!value) {
    return null;
  }
  return value;
}

export default function AdminMenuManager({
  saved,
  savedItemId,
  categories,
  items,
  availability,
  prices,
  recipes,
}: AdminMenuManagerProps) {
  const [selectedItemId, setSelectedItemId] = useState(savedItemId ?? items[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"categories" | "add" | "items">(
    saved === "category" ? "categories" : saved === "added" ? "add" : "items",
  );
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  useEffect(() => {
    if (savedItemId) {
      setSelectedItemId(savedItemId);
    }
  }, [savedItemId]);

  const selectedData = useMemo(() => {
    if (!selectedItem) {
      return null;
    }
    const itemAvailability = availability.filter((rule) => rule.menu_item_id === selectedItem.id);
    const itemRecipes = recipes.filter((recipe) => recipe.menu_item_id === selectedItem.id);
    const regularPrice = priceForItem(prices, selectedItem.id, "regular");
    const bulkPrice = priceForItem(prices, selectedItem.id, "bulk");
    return { itemAvailability, itemRecipes, regularPrice, bulkPrice };
  }, [availability, prices, recipes, selectedItem]);

  return (
    <div className="admin-menu-manager">
      <div className="admin-menu-tabs" role="tablist" aria-label="Menu management">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "categories"}
          className={activeTab === "categories" ? "selected" : undefined}
          onClick={() => setActiveTab("categories")}
        >
          Categories
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "add"}
          className={activeTab === "add" ? "selected" : undefined}
          onClick={() => setActiveTab("add")}
        >
          Add Item
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "items"}
          className={activeTab === "items" ? "selected" : undefined}
          onClick={() => setActiveTab("items")}
        >
          Existing Menu
        </button>
      </div>

      {saved === "category" ? (
        <p className="admin-flash">Menu category saved successfully.</p>
      ) : null}
      {saved === "added" ? (
        <p className="admin-flash">Menu item added successfully.</p>
      ) : null}

      {activeTab === "categories" ? (
      <section className="admin-menu-category-panel">
        <div className="admin-section-heading">
          <h3>Menu categories</h3>
          <span>Controls public grouping and sort order</span>
        </div>
        <form action={addMenuCategory} className="admin-category-add-form">
          <label>
            Category name
            <input name="name" placeholder="Snacks" required />
          </label>
          <label>
            Description
            <input name="description" placeholder="Homemade snacks and light bites" />
          </label>
          <label>
            Sort
            <input name="sort_order" type="number" defaultValue={categories.length + 1} />
          </label>
          <label className="checkbox-line">
            <input name="is_active" type="checkbox" defaultChecked />
            Active
          </label>
          <button type="submit">Add category</button>
        </form>
        <div className="admin-category-list">
          <div className="admin-category-header" aria-hidden="true">
            <span>Name</span>
            <span>Description</span>
            <span>Sort</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {categories.map((category) => (
            <form key={category.id} action={updateMenuCategory} className="admin-category-row">
              <input type="hidden" name="category_id" value={category.id} />
              <label>
                <span className="sr-only">Name</span>
                <input name="name" defaultValue={category.name} required />
              </label>
              <label>
                <span className="sr-only">Description</span>
                <input name="description" defaultValue={category.description ?? ""} />
              </label>
              <label>
                <span className="sr-only">Sort</span>
                <input name="sort_order" type="number" defaultValue={category.sort_order} />
              </label>
              <label className="checkbox-line">
                <input name="is_active" type="checkbox" defaultChecked={category.is_active === 1} />
                Active
              </label>
              <button type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>
      ) : null}

      {activeTab === "add" ? (
      <section className="admin-menu-add-panel">
        <h3>Add menu item</h3>
        <form action={addMenuItem} className="admin-form-grid menu-admin-form">
          <label>
            Category
            <select name="category_id" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.is_active === 1 ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Item name
            <input name="name" required />
          </label>
          <label>
            Item icon
            <input name="icon_text" maxLength={4} placeholder="🍛" />
          </label>
          <div className="form-field wide-field">
            <span>Description</span>
            <RichTextField name="description" />
          </div>
          <label>
            Image
            <ImageUploadField name="image_url" />
          </label>
          <MenuFields />
          <button type="submit">Add item</button>
        </form>
      </section>
      ) : null}

      {activeTab === "items" ? (
      <section className="admin-menu-workspace">
        <div className="admin-menu-grid-panel">
          <div className="admin-section-heading">
            <h3>Existing menu</h3>
            <span>{items.length} items</span>
          </div>
          <div className="admin-menu-grid">
            {items.length === 0 ? (
              <div className="empty-state">
                <h3>No menu items yet</h3>
                <p>Add your first item above.</p>
              </div>
            ) : (
              items.map((item) => {
                const itemAvailability = availability.filter((rule) => rule.menu_item_id === item.id);
                const regularPrice = priceForItem(prices, item.id, "regular");
                const bulkPrice = priceForItem(prices, item.id, "bulk");
                const isSelected = selectedItem?.id === item.id;
                const imageUrl = safeMenuImageUrl(item.image_url);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`admin-menu-card${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <span className="admin-menu-card-image">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt="" />
                      ) : (
                        <span>No image</span>
                      )}
                    </span>
                    <span className="admin-menu-card-body">
                      <strong>
                        {item.icon_text ? <span className="menu-item-icon-badge">{item.icon_text}</span> : null}
                        {item.name}
                      </strong>
                      <small>{item.category_name ?? "Uncategorized"}</small>
                      {item.description ? (
                        <small className="admin-menu-description-preview">
                          {plainText(item.description)}
                        </small>
                      ) : null}
                      <span>{regularPrice ? formatMoney(regularPrice.price_cents) : formatMoney(item.base_price_cents)}</span>
                      <small>{availabilityText(itemAvailability)}</small>
                      <span className="admin-menu-badges">
                        {item.is_active === 1 ? <em>Active</em> : <em>Inactive</em>}
                        {item.is_public === 1 ? <em>Public</em> : <em>Hidden</em>}
                        {item.public_sold_out === 1 ? <em>Sold out</em> : null}
                        {bulkPrice ? <em>Bulk</em> : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <aside className="admin-menu-edit-panel">
          <div className="admin-section-heading">
            <h3>Edit selected item</h3>
            {selectedItem ? <span>{selectedItem.name}</span> : null}
          </div>
          {saved === "updated" ? (
            <p className="admin-flash menu-edit-flash">Menu item updated successfully.</p>
          ) : null}
          {selectedItem && selectedData ? (
            <form key={selectedItem.id} action={updateMenuItem} className="admin-menu-edit-form">
              <input type="hidden" name="item_id" value={selectedItem.id} />
              <label>
                Category
                <select name="category_id" defaultValue={selectedItem.category_id ?? ""}>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.is_active === 1 ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Item name
                <input name="name" defaultValue={selectedItem.name} required />
              </label>
              <label>
                Item icon
                <input name="icon_text" maxLength={4} defaultValue={selectedItem.icon_text ?? ""} placeholder="🍛" />
              </label>
              <div className="form-field wide-field">
                <span>Description</span>
                <RichTextField
                  name="description"
                  defaultValue={selectedItem.description ?? ""}
                />
              </div>
              <label>
                Image
                <ImageUploadField name="image_url" defaultValue={selectedItem.image_url ?? ""} />
              </label>
              <MenuFields
                item={selectedItem}
                regularPrice={selectedData.regularPrice}
                bulkPrice={selectedData.bulkPrice}
                itemAvailability={selectedData.itemAvailability}
                itemRecipes={selectedData.itemRecipes}
              />
              <div className="admin-menu-status-row">
                <label className="checkbox-line">
                  <input name="is_active" type="checkbox" defaultChecked={selectedItem.is_active === 1} />
                  Active
                </label>
                <label className="checkbox-line">
                  <input name="is_public" type="checkbox" defaultChecked={selectedItem.is_public === 1} />
                  Public
                </label>
                <label className="checkbox-line">
                  <input name="public_sold_out" type="checkbox" defaultChecked={selectedItem.public_sold_out === 1} />
                  Sold out
                </label>
              </div>
              <button type="submit">Save selected item</button>
            </form>
          ) : (
            <div className="empty-state">
              <h3>Select a menu item</h3>
              <p>Choose an item from the grid to edit details.</p>
            </div>
          )}
        </aside>
      </section>
      ) : null}
    </div>
  );
}

function MenuFields({
  item,
  regularPrice,
  bulkPrice,
  itemAvailability = [],
  itemRecipes = [],
}: {
  item?: MenuItem;
  regularPrice?: MenuPrice;
  bulkPrice?: MenuPrice;
  itemAvailability?: MenuAvailability[];
  itemRecipes?: MenuItemIngredient[];
}) {
  return (
    <>
      <label>
        Food type
        <select name="food_type" defaultValue={item?.food_type ?? "veg"}>
          <option value="veg">Veg</option>
          <option value="nonveg">Non-Veg</option>
        </select>
      </label>
      <label>
        Serving unit
        <select name="serving_unit" defaultValue={item?.serving_unit ?? "plate"}>
          {servingUnits.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>
      <label>
        Serving definition
        <input name="serving_definition" defaultValue={item?.serving_definition ?? ""} placeholder="1 plate = 4 vada" />
      </label>
      <label>
        Menu start
        <input name="menu_start_date" type="date" defaultValue={item?.menu_start_date ?? ""} />
      </label>
      <label>
        Menu end
        <input name="menu_end_date" type="date" defaultValue={item?.menu_end_date ?? ""} />
      </label>
      <label>
        Regular price
        <input
          name="regular_price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={priceInputValue(regularPrice?.price_cents ?? item?.base_price_cents)}
        />
      </label>
      <label>
        Regular price effective from
        <input name="regular_price_effective_from" type="date" required defaultValue={regularPrice?.effective_from ?? ""} />
      </label>
      <label>
        Bulk price
        <input name="bulk_price" type="number" step="0.01" min="0" defaultValue={priceInputValue(bulkPrice?.price_cents)} />
      </label>
      <label>
        Bulk price effective from
        <input name="bulk_price_effective_from" type="date" defaultValue={bulkPrice?.effective_from ?? ""} />
      </label>
      <label className="checkbox-line">
        <input name="bulk_order_eligible" type="checkbox" defaultChecked={item?.bulk_order_eligible === 1} />
        Bulk eligible
      </label>
      <label>
        Min bulk qty
        <input name="min_bulk_quantity" type="number" min="0" defaultValue={item?.min_bulk_quantity ?? ""} />
      </label>
      <label>
        Max bulk qty
        <input name="max_bulk_quantity" type="number" min="0" defaultValue={item?.max_bulk_quantity ?? ""} />
      </label>
      <label>
        Notice hours
        <input name="bulk_notice_hours" type="number" min="0" defaultValue={item?.bulk_notice_hours ?? 24} />
      </label>
      <fieldset className="admin-fieldset wide-field">
        <legend>Availability days</legend>
        {dayOptions.map(([value, label]) => (
          <label key={value} className="checkbox-line">
            <input
              name="availability_days"
              type="checkbox"
              value={value}
              defaultChecked={itemAvailability.some((rule) => rule.day_of_week === value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="wide-field">
        Ingredients per serving
        <textarea
          name="ingredient_lines"
          rows={4}
          defaultValue={recipeLines(itemRecipes)}
          placeholder={"Urad dal | 120 | gram | per plate\nOil | 20 | ml | per plate"}
        />
      </label>
    </>
  );
}
