CREATE TABLE `question_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`question_text` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`categories` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`technologies` text DEFAULT '[]' NOT NULL,
	`difficulty` text DEFAULT 'senior' NOT NULL,
	`question_type` text DEFAULT 'scenario' NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`source` text DEFAULT 'ai' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
