CREATE TABLE `flashcard_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`flashcard_id` text NOT NULL,
	`rating` text NOT NULL,
	`reviewed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`phrase` text NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`example` text DEFAULT '' NOT NULL,
	`notes` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`ease` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`due_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_reviewed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `phrase_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`phrase` text NOT NULL,
	`replacement_for` text,
	`meaning` text DEFAULT '' NOT NULL,
	`example` text DEFAULT '' NOT NULL,
	`reason` text NOT NULL,
	`source` text DEFAULT 'ai' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
