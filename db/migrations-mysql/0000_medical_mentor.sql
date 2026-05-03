CREATE TABLE `game_players` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`game_id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`attendance` varchar(20) DEFAULT 'unknown' NOT NULL,
	`availability_set_at` int,
	`availability_updated_at` int,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`season_id` varchar(36) NOT NULL,
	`opponent_id` varchar(36) NOT NULL,
	`date` varchar(10) NOT NULL,
	`time` varchar(8) NOT NULL,
	`location` varchar(255) NOT NULL,
	`home_or_away` varchar(10) NOT NULL,
	`our_score` int,
	`opponent_score` int,
	`status` varchar(20) DEFAULT 'scheduled' NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`opponent_id`) REFERENCES `opponents`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE TABLE `lineup_entries` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`game_id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`batting_order` int,
	`position` varchar(10),
	`lineup_status` varchar(20) NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE TABLE `opponents` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`notes` text,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`jersey_number` varchar(10) NOT NULL,
	`preferred_positions` text DEFAULT ('[]') NOT NULL,
	`phone` varchar(50),
	`email` varchar(255),
	`whatsapp` varchar(50),
	`notes` text,
	`availability_token` varchar(36) NOT NULL,
	`is_active` tinyint(1) DEFAULT 1 NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `season_roster` (
	`season_id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	PRIMARY KEY(`player_id`, `season_id`),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`start_date` varchar(10) NOT NULL,
	`end_date` varchar(10) NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) PRIMARY KEY NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(20) DEFAULT 'manager' NOT NULL,
	`is_active` tinyint(1) DEFAULT 1 NOT NULL,
	`created_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL,
	`updated_at` int DEFAULT (UNIX_TIMESTAMP()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_player_game_id_idx` ON `game_players` (`game_id`);--> statement-breakpoint
CREATE INDEX `game_player_player_id_idx` ON `game_players` (`player_id`);--> statement-breakpoint
CREATE INDEX `game_date_idx` ON `games` (`date`);--> statement-breakpoint
CREATE INDEX `game_season_status_idx` ON `games` (`season_id`, `status`);--> statement-breakpoint
CREATE INDEX `lineup_entry_game_id_idx` ON `lineup_entries` (`game_id`);--> statement-breakpoint
CREATE INDEX `lineup_entry_player_id_idx` ON `lineup_entries` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_availability_token_unique` ON `players` (`availability_token`);--> statement-breakpoint
CREATE INDEX `player_availability_token_idx` ON `players` (`availability_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
