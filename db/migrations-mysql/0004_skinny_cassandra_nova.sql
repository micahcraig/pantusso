CREATE TABLE `activity_log` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`season_id` varchar(36) NOT NULL,
	`game_id` varchar(36),
	`player_id` varchar(36),
	`event_type` varchar(100) NOT NULL,
	`payload` text NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE INDEX `activity_log_season_created_idx` ON `activity_log` (`season_id`, `created_at`);
