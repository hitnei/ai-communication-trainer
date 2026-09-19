CREATE TABLE `interview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`categories` text NOT NULL,
	`technologies` text DEFAULT '[]' NOT NULL,
	`duration_minutes` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`pending_question` text,
	`pending_kind` text,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `interview_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`audio_recording_id` text,
	`transcript_id` text,
	`feedback_payload` text,
	`prompt_version` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
