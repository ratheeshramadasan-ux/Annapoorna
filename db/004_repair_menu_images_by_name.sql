-- Repair menu item images that were accidentally saved as the Veg Thali fallback.
-- This keeps D1 lightweight by storing static asset paths, not base64 image data.

UPDATE menu_items SET image_url = '/assets/nonveg-thali.png'
WHERE image_url = '/assets/veg-thali.png'
  AND (lower(name) LIKE '%nonveg thali%' OR lower(name) LIKE '%non-veg thali%' OR lower(name) LIKE '%chicken thali%');

UPDATE menu_items SET image_url = '/assets/Butter Chicken.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%butter chicken%';

UPDATE menu_items SET image_url = '/assets/Chicken Biryani.jpeg'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%chicken biryani%';

UPDATE menu_items SET image_url = '/assets/Chicken Puff.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%chicken puff%';

UPDATE menu_items SET image_url = '/assets/Dal Vada.png'
WHERE image_url = '/assets/veg-thali.png'
  AND (lower(name) LIKE '%dal%vada%' OR lower(name) LIKE '%parippu%vada%');

UPDATE menu_items SET image_url = '/assets/Egg Puff.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%egg puff%';

UPDATE menu_items SET image_url = '/assets/Ghee roast .png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%ghee roast%';

UPDATE menu_items SET image_url = '/assets/Idli Sambar.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%idli sambar%';

UPDATE menu_items SET image_url = '/assets/Idli-dosa batter.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%idli%dosa%batter%';

UPDATE menu_items SET image_url = '/assets/Kerala Chicken Biryani.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%kerala chicken biryani%';

UPDATE menu_items SET image_url = '/assets/Kerala Mutton Biryani.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%kerala mutton biryani%';

UPDATE menu_items SET image_url = '/assets/Medu Vada Battter.png'
WHERE image_url = '/assets/veg-thali.png'
  AND (lower(name) LIKE '%medu vada batter%' OR lower(name) LIKE '%medu vada battter%');

UPDATE menu_items SET image_url = '/assets/Medu Vada.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%medu vada%';

UPDATE menu_items SET image_url = '/assets/Onion Pakoda.png'
WHERE image_url = '/assets/veg-thali.png'
  AND (lower(name) LIKE '%onion pakora%' OR lower(name) LIKE '%onion pakoda%');

UPDATE menu_items SET image_url = '/assets/Pahadi Chicken curry.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%pahadi chicken%';

UPDATE menu_items SET image_url = '/assets/Put Kadala.jpeg'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%put kadala%';

UPDATE menu_items SET image_url = '/assets/Puttu and Kadala Curry.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%puttu%kadala%';

UPDATE menu_items SET image_url = '/assets/Sabudana Vada.png'
WHERE image_url = '/assets/veg-thali.png' AND lower(name) LIKE '%sabudana vada%';
