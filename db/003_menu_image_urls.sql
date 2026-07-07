-- Restore lightweight static image paths for menu items.
-- Keep image files in public/assets instead of storing base64 image data in D1.

UPDATE menu_items SET image_url = '/assets/veg-thali.png'
WHERE lower(name) IN ('veg thali', 'regular veg thali', 'daily veg thali');

UPDATE menu_items SET image_url = '/assets/Dal Vada.png'
WHERE lower(name) IN ('dal \ parippu vada', 'dal vada', 'parippu vada');

UPDATE menu_items SET image_url = '/assets/Sabudana Vada.png'
WHERE lower(name) = 'sabudana vada';

UPDATE menu_items SET image_url = '/assets/Medu Vada.png'
WHERE lower(name) = 'medu vada';

UPDATE menu_items SET image_url = '/assets/Onion Pakoda.png'
WHERE lower(name) IN ('onion pakora', 'onion pakoda');

UPDATE menu_items SET image_url = '/assets/Chicken Puff.png'
WHERE lower(name) = 'chicken puff';

UPDATE menu_items SET image_url = '/assets/Egg Puff.png'
WHERE lower(name) = 'egg puff';

UPDATE menu_items SET image_url = '/assets/Idli Sambar.png'
WHERE lower(name) = 'idli sambar';

UPDATE menu_items SET image_url = '/assets/Puttu and Kadala Curry.png'
WHERE lower(name) IN ('puttu and kadala curry', 'put kadala');

UPDATE menu_items SET image_url = '/assets/Butter Chicken.png'
WHERE lower(name) = 'butter chicken';

UPDATE menu_items SET image_url = '/assets/Pahadi Chicken curry.png'
WHERE lower(name) IN ('pahadi chicken', 'pahadi chicken curry');

UPDATE menu_items SET image_url = '/assets/Kerala Chicken Biryani.png'
WHERE lower(name) = 'kerala chicken biryani';

UPDATE menu_items SET image_url = '/assets/Kerala Mutton Biryani.png'
WHERE lower(name) = 'kerala mutton biryani';

UPDATE menu_items SET image_url = '/assets/Idli-dosa batter.png'
WHERE lower(name) IN ('idli dosa batter', 'idli-dosa batter');

UPDATE menu_items SET image_url = '/assets/Medu Vada Battter.png'
WHERE lower(name) IN ('medu vada batter', 'medu vada battter');
