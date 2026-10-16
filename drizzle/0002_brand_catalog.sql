CREATE TABLE `brand_catalogs` (
	`owner` text PRIMARY KEY NOT NULL,
	`initialized_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`code` text NOT NULL,
	`color` text NOT NULL,
	`light` text NOT NULL,
	`category` text NOT NULL,
	`voice` text NOT NULL,
	`visual` text NOT NULL,
	`facts` text NOT NULL,
	`cta` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_brands_owner_name` ON `brands` (`owner`,`name_key`);--> statement-breakpoint
CREATE TRIGGER posts_require_brand_insert BEFORE INSERT ON posts
WHEN EXISTS (SELECT 1 FROM brand_catalogs WHERE owner=NEW.owner)
 AND NOT EXISTS (SELECT 1 FROM brands WHERE owner=NEW.owner AND id=NEW.brand)
BEGIN SELECT RAISE(ABORT,'brand_not_found'); END;
--> statement-breakpoint
CREATE TRIGGER posts_require_brand_update BEFORE UPDATE OF brand,owner ON posts
WHEN EXISTS (SELECT 1 FROM brand_catalogs WHERE owner=NEW.owner)
 AND NOT EXISTS (SELECT 1 FROM brands WHERE owner=NEW.owner AND id=NEW.brand)
BEGIN SELECT RAISE(ABORT,'brand_not_found'); END;
--> statement-breakpoint
CREATE TRIGGER brands_protect_posts BEFORE DELETE ON brands
WHEN EXISTS (SELECT 1 FROM posts WHERE owner=OLD.owner AND brand=OLD.id)
BEGIN SELECT RAISE(ABORT,'brand_has_posts'); END;
