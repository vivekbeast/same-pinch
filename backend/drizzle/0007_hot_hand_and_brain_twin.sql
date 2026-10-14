ALTER TYPE "public"."badge_id" ADD VALUE 'brain_twin';--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "hot" boolean DEFAULT false NOT NULL;