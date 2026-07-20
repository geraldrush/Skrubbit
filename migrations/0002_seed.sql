-- Seed: the 7 products that were hardcoded in data/products.ts.
-- Generated from that file so the migrated catalogue matches exactly.

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('dishwashing-liquid', 'Dishwashing Liquid', 'Tough on grease, gentle on hands.', 'A concentrated, high-foam dishwashing liquid that cuts through grease and baked-on food fast. A little goes a long way, leaving dishes squeaky clean and sparkling.', 'kitchen', '/images/products/dishwashing-liquid.jpg', 1, '["Lemon","Apple","Original"]', '["Add a small squirt to warm water for everyday dishes.","Apply directly to stubborn, greasy pots and pans.","Safe for hand-washing glassware and cutlery."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('DW-750', 'dishwashing-liquid', '750 ml', 32.9, 0);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('DW-5L', 'dishwashing-liquid', '5 L', 129.9, 1);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('DW-25L', 'dishwashing-liquid', '25 L', 489, 2);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('pine-gel', 'Pine Gel', 'Fresh pine clean for every surface.', 'A thick, economical multi-purpose pine gel that cleans, deodorises and leaves a long-lasting fresh pine fragrance throughout the home. Ideal for floors, walls and hard surfaces.', 'floors', '/images/products/pine-gel.jpg', 1, '["Pine","Lavender","Ocean"]', '["Dilute in a bucket of water to mop floors.","Use neat on tough stains and high-traffic areas.","Great as a general surface and drain deodoriser."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('PG-2L', 'pine-gel', '2 L', 44.9, 0);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('PG-5L', 'pine-gel', '5 L', 94.9, 1);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('thick-bleach', 'Thick Bleach', 'Clings, whitens and disinfects.', 'A thick, clinging bleach that stays on vertical and angled surfaces for a deeper clean. Whitens, brightens and kills germs around the toilet, drains and hard surfaces.', 'disinfectants', '/images/products/thick-bleach.png', 1, '[]', '["Apply under the toilet rim and leave for 10 minutes.","Dilute for whitening and disinfecting surfaces.","Do not mix with other cleaning products."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TB-5L', 'thick-bleach', '5 L', 74.9, 0);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TB-20L', 'thick-bleach', '20 L', 249, 1);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TB-25L', 'thick-bleach', '25 L', 299, 2);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('bleach', 'Regular Bleach', 'Everyday whitening & disinfecting.', 'A versatile household bleach for laundry whitening, surface disinfecting and general hygiene. Economical bulk sizing for households and businesses.', 'disinfectants', '/images/products/bleach.png', 0, '[]', '["Dilute for laundry whitening and stain removal.","Disinfect surfaces, drains and bins.","Always dilute as directed; keep away from fabrics you don''t want lightened."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('BL-25L', 'bleach', '25 L', 219, 0);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('toilet-cleaner', 'Toilet Cleaner', 'A fresh, germ-free bathroom.', 'A powerful toilet cleaner that removes stains and limescale while killing germs and leaving a fresh fragrance. The angled bottle reaches right under the rim.', 'bathroom', '/images/products/toilet-cleaner.jpg', 1, '[]', '["Squeeze under the rim and around the bowl.","Leave for a few minutes, then brush and flush.","Use regularly to prevent stain build-up."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TC-750', 'toilet-cleaner', '750 ml', 34.9, 0);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TC-5L', 'toilet-cleaner', '5 L', 119, 1);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('TC-25L', 'toilet-cleaner', '25 L', 449, 2);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('fabric-softener', 'Fabric Softener', 'Soft, fresh, long-lasting fragrance.', 'A rich, concentrated fabric softener that leaves laundry beautifully soft, static-free and gorgeously fragrant wash after wash.', 'laundry', '/images/products/fabric-softener.jpg', 0, '["Spring Fresh","Lavender","Baby Soft"]', '["Add to the softener compartment of your machine.","For hand-washing, add to the final rinse.","Concentrated — no need to over-pour."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('FS-5L', 'fabric-softener', '5 L', 99.9, 0);
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('FS-25L', 'fabric-softener', '25 L', 379, 1);

INSERT OR IGNORE INTO products (slug, name, tagline, description, category, image, featured, scents, usage) VALUES ('mop-and-shine', 'Mop & Shine', 'Clean floors with a brilliant shine.', 'An all-in-one floor cleaner that cleans and adds a streak-free shine in a single pass. Leaves floors gleaming with a fresh, welcoming fragrance.', 'floors', '/images/products/mop-and-shine.png', 0, '[]', '["Dilute in water and mop as usual — no rinsing needed.","Safe on tiles, vinyl and sealed floors.","Buff lightly for extra shine."]');
INSERT OR IGNORE INTO variants (sku, product_slug, size, price, position) VALUES ('MS-5L', 'mop-and-shine', '5 L', 109, 0);

