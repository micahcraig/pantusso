CREATE TABLE `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`game_id` text,
	`player_id` text,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_log_season_created_idx` ON `activity_log` (`season_id`,`created_at`);