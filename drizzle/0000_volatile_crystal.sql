CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`brand` text NOT NULL,
	`title` text NOT NULL,
	`format` text NOT NULL,
	`platform` text NOT NULL,
	`caption` text NOT NULL,
	`visual` text NOT NULL,
	`status` text NOT NULL,
	`date` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_posts_owner` ON `posts` (`owner`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`initialized_at` integer NOT NULL
);
