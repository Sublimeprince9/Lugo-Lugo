insert into public.events (
  id, slug, name, venue, starts_at, ends_at, map_config, is_published
) values (
  '00000000-0000-4000-8000-000000000001',
  'uma-fair-2026',
  'UMA Fair 2026',
  'UMA Showgrounds, Lugogo',
  '2026-10-01T00:00:00+03:00',
  '2026-10-31T23:59:59+03:00',
  '{"width":960,"height":700,"renderer":"pixi"}'::jsonb,
  true
);

insert into public.zones (id, event_id, name, map_bounds) values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Main Hall', '{"x":50,"y":145,"w":280,"h":180}'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Catering Lane', '{"x":548,"y":145,"w":300,"h":180}'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', 'Brew Hall', '{"x":530,"y":330,"w":340,"h":150}'),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', 'Innovation Hub', '{"x":80,"y":400,"w":300,"h":150}'),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', 'Agri Court', '{"x":450,"y":400,"w":300,"h":180}'),
  ('00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', 'Maker District', '{"x":650,"y":400,"w":280,"h":180}');

insert into public.stalls (
  id, event_id, zone_id, stall_number, title, category, description,
  whatsapp_number, map_x, map_y, checkin_coins, price_range
) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'A12', 'Nile Glass Atelier', 'Luxury', 'Handcrafted glassware, home accents and premium gift baskets.', '+256700123456', 224, 302, 60, 'UGX 180k - 1.4M'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'B07', 'Kampala Bites', 'Food', 'Street-food favourites and local delicacies from across Uganda.', '+256772555111', 450, 320, 60, 'UGX 5k - 28k'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'C04', 'Sunrise Sips', 'Drinks', 'Cold-pressed juices, smoothies and artisanal sodas.', '+256750888222', 640, 343, 60, 'UGX 3k - 14k'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'D09', 'Agri Lab', 'Science', 'Climate-smart farming demos and agritech experiments.', '+256774400333', 333, 439, 60, 'UGX 12k - 120k'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000015', 'E18', 'Royal Rice Fields', 'Farming', 'Seed varieties, soil health products and local crop cultivation kits.', '+256788666444', 550, 452, 60, 'UGX 8k - 90k'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000016', 'F03', 'Pixels & Circuits', 'Tech', 'Robotics demos, consumer gadgets and app prototypes.', '+256756777555', 713, 475, 60, 'UGX 25k - 450k'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'A18', 'Kampala Craft House', 'Luxury', 'Premium handmade baskets, textiles and limited-run home decor.', '+256788121212', 258, 375, 60, 'UGX 35k - 420k'),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'B12', 'Hot Pot Corner', 'Food', 'Grilled favourites, shawarma and festival comfort food.', '+256755222333', 550, 393, 60, 'UGX 7k - 30k'),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'C11', 'Mango Mash', 'Drinks', 'Fresh fruit blends and premium mocktails for the crowd.', '+256774333444', 767, 430, 60, 'UGX 4k - 18k'),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'D21', 'Bio Garden Lab', 'Science', 'Plant research, composting hacks and regenerative agriculture stories.', '+256700333222', 405, 511, 60, 'UGX 10k - 80k'),
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000015', 'E22', 'FarmFresh Co-op', 'Farming', 'Local farmer co-op products, pulses and climate resilient seeds.', '+256701444121', 650, 539, 60, 'UGX 9k - 75k'),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000016', 'F15', 'Pico Labs', 'Tech', 'Wearables, smart farming tools and urban innovation prototypes.', '+256756111777', 767, 548, 60, 'UGX 20k - 500k');

insert into public.rewards (stall_id, title, kind, coin_value, claim_limit, requires_verified_phone)
values
  ('00000000-0000-4000-8000-000000000101', 'Gate Pass Reward', 'voucher', 0, 100, true),
  ('00000000-0000-4000-8000-000000000102', 'Kampala Bites Coupon', 'voucher', 0, 100, false);
