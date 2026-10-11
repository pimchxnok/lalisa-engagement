ALTER TABLE "comment_styles" ADD COLUMN "targets" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "style_lines" ADD COLUMN "system" text DEFAULT 'comment' NOT NULL;--> statement-breakpoint
DROP INDEX "style_lines_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "style_lines_unique" ON "style_lines" ("style_id","system","lang","length","text");--> statement-breakpoint
UPDATE "style_lines" SET "system" = 'story' WHERE "style_id" = 'story';--> statement-breakpoint
UPDATE "comment_styles" SET "targets" = jsonb_build_object('story:en:short', "bank_size", 'story:th:short', "bank_size") WHERE "id" = 'story' AND "targets" = '{}'::jsonb;--> statement-breakpoint
UPDATE "comment_styles" SET "targets" = jsonb_build_object('comment:en:short', "bank_size", 'comment:en:medium', "bank_size", 'comment:th:short', "bank_size", 'comment:th:medium', "bank_size") WHERE "id" <> 'story' AND "targets" = '{}'::jsonb;
