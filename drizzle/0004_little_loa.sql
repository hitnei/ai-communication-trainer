CREATE TABLE `communication_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`key` text NOT NULL,
	`description` text NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`first_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_id` text NOT NULL,
	`session_id` text NOT NULL,
	`attempt_id` text,
	`evidence` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`memory_id`) REFERENCES `communication_memories`(`id`) ON UPDATE no action ON DELETE cascade
);
