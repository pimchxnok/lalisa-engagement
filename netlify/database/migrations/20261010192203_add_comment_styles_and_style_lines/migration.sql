CREATE TABLE "comment_styles" (
	"id" text PRIMARY KEY,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"keywords" jsonb DEFAULT '[]' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"bank_size" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_lines" (
	"id" serial PRIMARY KEY,
	"style_id" text NOT NULL,
	"lang" text NOT NULL,
	"length" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "style_lines_unique" ON "style_lines" ("style_id","lang","length","text");--> statement-breakpoint
INSERT INTO "comment_styles" ("id", "position", "name", "keywords", "prompt", "bank_size") VALUES
('hype', 0, 'Over-the-top hype', '["iconic","queen","superstar","masterpiece","broke the internet","screaming"]', 'Big, dramatic, excited praise for LISA that still sounds like a real fan.', 50),
('sweet', 1, 'Sweet & natural', '["smile","proud","love","happy","beautiful","thank you"]', 'Warm, casual comments to LISA that read like a friend talking.', 50),
('concept', 2, 'Campaign concept', '["campaign","collection","ambassador","collaboration","brand"]', 'Praise LISA as the face of the campaign and the brand she represents.', 50),
('fashion', 3, 'Fashion & styling', '["look","outfit","styling","silhouette","details","runway"]', 'Talk about LISA''s look, outfit, hair, makeup and styling details.', 50),
('story', 4, 'Story caption (short)', '["queen","iconic","stunning","shining"]', 'Very short captions for sharing a post about LISA to an Instagram Story.', 50)
ON CONFLICT ("id") DO NOTHING;
