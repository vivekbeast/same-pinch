ALTER TABLE "answers" DROP CONSTRAINT "answers_skipped_iff_empty";--> statement-breakpoint
DROP INDEX "answers_partner_pool_idx";--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "pinch_x" smallint;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "pinch_y" smallint;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "spot_match" boolean;--> statement-breakpoint
CREATE INDEX "answers_partner_pool_idx" ON "answers" USING btree ("prompt_id","received_at" DESC NULLS LAST) WHERE not "answers"."flagged" and (cardinality("answers"."words") > 0 or "answers"."pinch_x" is not null);--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_pinch_valid" CHECK (("answers"."pinch_x" is null and "answers"."pinch_y" is null)
       or ("answers"."pinch_x" between 0 and 1000 and "answers"."pinch_y" between 0 and 1000));--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_skipped_iff_empty" CHECK ("answers"."result" is null or (("answers"."result" = 'skipped') = (cardinality("answers"."words") = 0 and "answers"."pinch_x" is null)));