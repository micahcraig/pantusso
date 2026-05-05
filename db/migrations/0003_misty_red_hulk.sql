PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `players_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`jersey_number` text,
	`preferred_positions` text DEFAULT '[]' NOT NULL,
	`phone` text,
	`email` text,
	`whatsapp` text,
	`notes` text,
	`availability_token` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);--> statement-breakpoint
INSERT INTO `players_new` SELECT * FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `players_new` RENAME TO `players`;--> statement-breakpoint
CREATE UNIQUE INDEX `players_availability_token_unique` ON `players` (`availability_token`);--> statement-breakpoint
CREATE INDEX `player_availability_token_idx` ON `players` (`availability_token`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
