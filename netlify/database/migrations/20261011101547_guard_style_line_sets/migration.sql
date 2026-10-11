-- Only real sets can be written from now on: comment Short / Medium and story Short, in English or Thai.
-- NOT VALID keeps every line saved before this (e.g. old "long" drafts) untouched; only new rows are checked.
ALTER TABLE "style_lines" ADD CONSTRAINT "style_lines_valid_set" CHECK ("lang" IN ('en', 'th') AND (("system" = 'comment' AND "length" IN ('short', 'medium')) OR ("system" = 'story' AND "length" = 'short'))) NOT VALID;
