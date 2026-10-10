CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"season" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"hashtags" jsonb DEFAULT '[]' NOT NULL,
	"mentions" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_ticks" (
	"post_id" text,
	"visitor_id" text,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "comment_ticks_pkey" PRIMARY KEY("post_id","visitor_id")
);
--> statement-breakpoint
CREATE TABLE "custom_lines" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"type_id" text NOT NULL,
	"lang" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_types" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"definition" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_marks" (
	"post_id" text,
	"visitor_id" text,
	"kind" text,
	CONSTRAINT "post_marks_pkey" PRIMARY KEY("post_id","visitor_id","kind")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"campaign_id" text DEFAULT '' NOT NULL,
	"platform" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"account" text DEFAULT '' NOT NULL,
	"title" text,
	"caption" text DEFAULT '' NOT NULL,
	"thumbnail" text,
	"stats" jsonb NOT NULL,
	"comment_goal" integer,
	"tier_id" text,
	"posted_at" text DEFAULT '' NOT NULL,
	"extra_mentions" jsonb,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_events" (
	"id" serial PRIMARY KEY,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"hero_image" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"credits" text DEFAULT '' NOT NULL,
	"last_synced_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text
);
--> statement-breakpoint
CREATE TABLE "used_lines" (
	"line_id" text PRIMARY KEY,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_events_lookup" ON "rate_events" ("scope","key","at");