CREATE TABLE `audio_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`relative_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`duration_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`audio_recording_id` text,
	`text` text NOT NULL,
	`source` text NOT NULL,
	`language` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`audio_recording_id`) REFERENCES `audio_recordings`(`id`) ON UPDATE no action ON DELETE set null
);
