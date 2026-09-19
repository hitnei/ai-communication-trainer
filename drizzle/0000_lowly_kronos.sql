CREATE TABLE `feedback_items` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`role` text NOT NULL,
	`prompt_version` text NOT NULL,
	`stage` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `practice_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `practice_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`text_answer` text,
	`audio_recording_id` text,
	`transcript_id` text,
	`feedback_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`goal` text NOT NULL,
	`exercise_type` text,
	`prompt` text NOT NULL,
	`question_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`current_role` text,
	`years_experience` integer,
	`target_role` text,
	`target_markets` text,
	`primary_skills` text,
	`secondary_skills` text,
	`english_goal` text,
	`transcript_mode` text DEFAULT 'after' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
