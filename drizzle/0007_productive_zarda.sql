CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`raw_text` text NOT NULL,
	`seniority` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`overall_status` text DEFAULT 'unknown' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`job_description_id` text NOT NULL,
	`text` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`match_status` text DEFAULT 'unknown' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`job_description_id`) REFERENCES `job_descriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`overview` text DEFAULT '' NOT NULL,
	`tech_stack` text DEFAULT '[]' NOT NULL,
	`responsibilities` text DEFAULT '' NOT NULL,
	`challenges` text DEFAULT '' NOT NULL,
	`solutions` text DEFAULT '' NOT NULL,
	`architecture` text DEFAULT '' NOT NULL,
	`performance` text DEFAULT '' NOT NULL,
	`leadership` text DEFAULT '' NOT NULL,
	`collaboration` text DEFAULT '' NOT NULL,
	`conflicts` text DEFAULT '' NOT NULL,
	`achievements` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
