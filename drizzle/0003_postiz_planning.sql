CREATE TABLE `publish_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`actor` text NOT NULL,
	`post_id` text NOT NULL,
	`title` text NOT NULL,
	`brand` text NOT NULL,
	`channel_id` text NOT NULL,
	`channel_name` text NOT NULL,
	`platform` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`caption` text NOT NULL,
	`fingerprint` text NOT NULL,
	`state` text NOT NULL,
	`remote_id` text,
	`preview_url` text,
	`message` text DEFAULT '' NOT NULL,
	`missing` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_publish_jobs_owner_created` ON `publish_jobs` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_publish_jobs_post_channel` ON `publish_jobs` (`owner`,`post_id`,`channel_id`);--> statement-breakpoint
CREATE TABLE `publish_media` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`owner` text NOT NULL,
	`asset_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_publish_media_job` ON `publish_media` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_publish_media_expiry` ON `publish_media` (`expires_at`);