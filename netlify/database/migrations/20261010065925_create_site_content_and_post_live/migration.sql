CREATE TABLE "post_live" (
	"post_id" text PRIMARY KEY,
	"url" text NOT NULL,
	"stats" jsonb DEFAULT '{}' NOT NULL,
	"caption" text,
	"thumbnail" text,
	"error" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"meta_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
