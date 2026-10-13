CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user" uuid NOT NULL,
	"to_user" uuid NOT NULL,
	"answer_id" uuid,
	"reply_to" uuid,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	CONSTRAINT "notes_not_self" CHECK ("notes"."from_user" <> "notes"."to_user"),
	CONSTRAINT "notes_kind" CHECK ("notes"."kind" in ('same_brain', 'haha_same', 'never_thought', 'hello', 'good_one', 'thanks'))
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_from_user_users_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_to_user_users_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_reply_fk" FOREIGN KEY ("reply_to") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_inbox_idx" ON "notes" USING btree ("to_user","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notes_one_per_answer" ON "notes" USING btree ("from_user","answer_id") WHERE "notes"."reply_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notes_one_reply" ON "notes" USING btree ("reply_to") WHERE "notes"."reply_to" is not null;