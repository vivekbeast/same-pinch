CREATE TYPE "public"."avatar" AS ENUM('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12');--> statement-breakpoint
CREATE TYPE "public"."badge_id" AS ENUM('first_pinch', 'bhasha_bridge', 'double_pinch', 'fire_starter', 'week_of_flames', 'burnt_hunter', 'sound_mind', 'vibe_twin', 'explorer', 'bharat_synced', 'india_brain', 'sharp_eye');--> statement-breakpoint
CREATE TYPE "public"."candidate_status" AS ENUM('new', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."daily_grade" AS ENUM('top', 'top5', 'none');--> statement-breakpoint
CREATE TYPE "public"."event_name" AS ENUM('app_open', 'pack_start', 'round_drop', 'pack_collect', 'daily_done', 'share', 'install_accept', 'payout_request', 'vitals');--> statement-breakpoint
CREATE TYPE "public"."lang" AS ENUM('en', 'hi', 'kn', 'ta', 'te', 'mr');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('earn', 'payout', 'reversal', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."ledger_status" AS ENUM('credited', 'pending_review', 'pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prompt_kind" AS ENUM('image', 'sound', 'vibe', 'question');--> statement-breakpoint
CREATE TYPE "public"."region_kind" AS ENUM('state', 'ut');--> statement-breakpoint
CREATE TYPE "public"."round_result" AS ENUM('exact', 'bhasha', 'near', 'miss', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('food', 'weather', 'city_sounds', 'festivals', 'college', 'travel', 'feelings');--> statement-breakpoint
CREATE TYPE "public"."ui_lang" AS ENUM('en', 'hi', 'kn', 'ta');--> statement-breakpoint
CREATE TYPE "public"."zone" AS ENUM('north', 'south', 'east', 'west', 'central', 'northeast');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"pack_id" uuid,
	"prompt_id" uuid NOT NULL,
	"words" text[] NOT NULL,
	"langs" "lang"[] NOT NULL,
	"concept_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"author_state" text,
	"author_device_hash" text,
	"author_gold_acc" real,
	"played_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_ms" integer,
	"partner_answer_id" uuid,
	"result" "round_result",
	"gold_correct" boolean,
	"match_concepts" text[] DEFAULT '{}'::text[] NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"earn_paise" integer DEFAULT 0 NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "answers_one_per_round" UNIQUE("user_id","pack_id","prompt_id"),
	CONSTRAINT "answers_words_count" CHECK (cardinality("answers"."words") between 0 and 3),
	CONSTRAINT "answers_langs_match_words" CHECK (cardinality("answers"."langs") = cardinality("answers"."words")),
	CONSTRAINT "answers_result_required" CHECK ("answers"."is_seed" or "answers"."result" is not null),
	CONSTRAINT "answers_skipped_iff_empty" CHECK ("answers"."result" is null or (("answers"."result" = 'skipped') = (cardinality("answers"."words") = 0))),
	CONSTRAINT "answers_seed_has_no_pack" CHECK (not "answers"."is_seed" or "answers"."pack_id" is null),
	CONSTRAINT "answers_xp_nonneg" CHECK ("answers"."xp" >= 0),
	CONSTRAINT "answers_earn_nonneg" CHECK ("answers"."earn_paise" >= 0),
	CONSTRAINT "answers_response_ms_nonneg" CHECK ("answers"."response_ms" is null or "answers"."response_ms" >= 0),
	CONSTRAINT "answers_gold_acc_range" CHECK ("answers"."author_gold_acc" is null or "answers"."author_gold_acc" between 0 and 1),
	CONSTRAINT "answers_not_own_partner" CHECK ("answers"."partner_answer_id" is null or "answers"."partner_answer_id" <> "answers"."id")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" "badge_id" PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"rule" jsonb NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "badges_sort_unique" UNIQUE("sort")
);
--> statement-breakpoint
CREATE TABLE "concept_edges" (
	"a" text NOT NULL,
	"b" text NOT NULL,
	CONSTRAINT "concept_edges_a_b_pk" PRIMARY KEY("a","b"),
	CONSTRAINT "concept_edges_ordered" CHECK ("concept_edges"."a" < "concept_edges"."b")
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" text PRIMARY KEY NOT NULL,
	"gloss" text NOT NULL,
	CONSTRAINT "concepts_id_format" CHECK ("concepts"."id" ~ '^c_[a-z0-9_]+$')
);
--> statement-breakpoint
CREATE TABLE "daily_answers" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"idx" smallint NOT NULL,
	"word" text NOT NULL,
	"lang" "lang" NOT NULL,
	"concept_id" text,
	"grade" "daily_grade" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_answers_user_id_day_idx_pk" PRIMARY KEY("user_id","day","idx"),
	CONSTRAINT "daily_answers_word_length" CHECK (char_length("daily_answers"."word") between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "daily_set_prompts" (
	"day" date NOT NULL,
	"idx" smallint NOT NULL,
	"prompt_id" uuid NOT NULL,
	CONSTRAINT "daily_set_prompts_day_idx_pk" PRIMARY KEY("day","idx"),
	CONSTRAINT "daily_set_prompts_once" UNIQUE("day","prompt_id"),
	CONSTRAINT "daily_set_prompts_idx_range" CHECK ("daily_set_prompts"."idx" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "daily_sets" (
	"day" date PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_sets_number_unique" UNIQUE("number"),
	CONSTRAINT "daily_sets_number_positive" CHECK ("daily_sets"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"name" "event_name" NOT NULL,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_props_size" CHECK ("events"."props" is null or octet_length("events"."props"::text) <= 1024)
);
--> statement-breakpoint
CREATE TABLE "game_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "ledger_status" NOT NULL,
	"pack_id" uuid,
	"payout_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_sign_by_kind" CHECK (("ledger"."kind" = 'earn' and "ledger"."amount_paise" > 0)
       or ("ledger"."kind" in ('payout', 'reversal') and "ledger"."amount_paise" < 0)
       or ("ledger"."kind" = 'adjustment' and "ledger"."amount_paise" <> 0)),
	CONSTRAINT "ledger_status_by_kind" CHECK (("ledger"."kind" = 'earn' and "ledger"."status" in ('credited', 'pending_review'))
       or ("ledger"."kind" = 'payout' and "ledger"."status" in ('pending', 'paid', 'failed'))
       or ("ledger"."kind" in ('reversal', 'adjustment') and "ledger"."status" = 'credited')),
	CONSTRAINT "ledger_reversal_has_note" CHECK ("ledger"."kind" not in ('reversal', 'adjustment') or "ledger"."note" is not null)
);
--> statement-breakpoint
CREATE TABLE "lexicon" (
	"term" text NOT NULL,
	"lang" "lang" NOT NULL,
	"concept_id" text NOT NULL,
	CONSTRAINT "lexicon_term_lang_concept_id_pk" PRIMARY KEY("term","lang","concept_id"),
	CONSTRAINT "lexicon_term_length" CHECK (char_length("lexicon"."term") between 1 and 24)
);
--> statement-breakpoint
CREATE TABLE "lexicon_candidates" (
	"term_a" text NOT NULL,
	"lang_a" "lang" NOT NULL,
	"term_b" text NOT NULL,
	"lang_b" "lang" NOT NULL,
	"seen" integer DEFAULT 1 NOT NULL,
	"status" "candidate_status" DEFAULT 'new' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lexicon_candidates_term_a_lang_a_term_b_lang_b_pk" PRIMARY KEY("term_a","lang_a","term_b","lang_b"),
	CONSTRAINT "lexicon_candidates_canonical_order" CHECK (("lexicon_candidates"."term_a", "lexicon_candidates"."lang_a"::text) < ("lexicon_candidates"."term_b", "lexicon_candidates"."lang_b"::text)),
	CONSTRAINT "lexicon_candidates_seen_positive" CHECK ("lexicon_candidates"."seen" >= 1)
);
--> statement-breakpoint
CREATE TABLE "low_info_words" (
	"term" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_rounds" (
	"pack_id" uuid NOT NULL,
	"idx" smallint NOT NULL,
	"prompt_id" uuid NOT NULL,
	CONSTRAINT "pack_rounds_pack_id_idx_pk" PRIMARY KEY("pack_id","idx"),
	CONSTRAINT "pack_rounds_prompt_once" UNIQUE("pack_id","prompt_id"),
	CONSTRAINT "pack_rounds_idx_range" CHECK ("pack_rounds"."idx" between 0 and 9)
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"collected_at" timestamp with time zone,
	"played_day" date,
	"paid" boolean,
	"flagged" boolean DEFAULT false NOT NULL,
	"summary" jsonb,
	CONSTRAINT "packs_collect_consistent" CHECK (("packs"."collected_at" is null and "packs"."summary" is null and "packs"."paid" is null and "packs"."played_day" is null)
       or ("packs"."collected_at" is not null and "packs"."summary" is not null and "packs"."paid" is not null and "packs"."played_day" is not null))
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"upi_masked" text NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "payouts_min_amount" CHECK ("payouts"."amount_paise" >= 5000),
	CONSTRAINT "payouts_settled_consistent" CHECK (("payouts"."status" = 'pending') = ("payouts"."settled_at" is null))
);
--> statement-breakpoint
CREATE TABLE "prompt_burnt" (
	"prompt_id" uuid NOT NULL,
	"concept_id" text NOT NULL,
	"burnt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_burnt_prompt_id_concept_id_pk" PRIMARY KEY("prompt_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "prompt_kind" NOT NULL,
	"asset_key" text,
	"text_key" text NOT NULL,
	"text_params" jsonb,
	"theme" "theme",
	"is_gold" boolean DEFAULT false NOT NULL,
	"gold_concepts" text[],
	"active" boolean DEFAULT true NOT NULL,
	"burnt_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_asset_matches_kind" CHECK (("prompts"."kind" = 'question') = ("prompts"."asset_key" is null)),
	CONSTRAINT "prompts_asset_key_format" CHECK ("prompts"."asset_key" is null or "prompts"."asset_key" ~ '^[a-z0-9-]{2,40}$'),
	CONSTRAINT "prompts_gold_concepts" CHECK ((not "prompts"."is_gold" and "prompts"."gold_concepts" is null)
       or ("prompts"."is_gold" and "prompts"."gold_concepts" is not null and cardinality("prompts"."gold_concepts") between 1 and 4))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_bucket_window_start_pk" PRIMARY KEY("key","bucket","window_start"),
	CONSTRAINT "rate_limits_count_positive" CHECK ("rate_limits"."count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "region_kind" NOT NULL,
	"zone" "zone" NOT NULL,
	CONSTRAINT "regions_code_format" CHECK ("regions"."code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"renewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_expiry_after_creation" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" uuid NOT NULL,
	"badge_id" "badge_id" NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badges_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "user_days" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"packs" smallint DEFAULT 0 NOT NULL,
	"paid_packs" smallint DEFAULT 0 NOT NULL,
	"earn_paise" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"freeze_used" boolean DEFAULT false NOT NULL,
	"repaired" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_days_user_id_day_pk" PRIMARY KEY("user_id","day"),
	CONSTRAINT "user_days_paid_le_packs" CHECK ("user_days"."paid_packs" between 0 and "user_days"."packs"),
	CONSTRAINT "user_days_earn_nonneg" CHECK ("user_days"."earn_paise" >= 0),
	CONSTRAINT "user_days_xp_nonneg" CHECK ("user_days"."xp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_regions" (
	"user_id" uuid NOT NULL,
	"state_code" text NOT NULL,
	"pinch_count" integer DEFAULT 1 NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_regions_user_id_state_code_pk" PRIMARY KEY("user_id","state_code"),
	CONSTRAINT "user_regions_count_positive" CHECK ("user_regions"."pinch_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"avatar" "avatar" DEFAULT 'a1' NOT NULL,
	"ui_lang" "ui_lang" DEFAULT 'en' NOT NULL,
	"state_code" text,
	"city" text,
	"tz" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"flame" integer DEFAULT 0 NOT NULL,
	"flame_best" integer DEFAULT 0 NOT NULL,
	"freezes" smallint DEFAULT 0 NOT NULL,
	"last_play_day" date,
	"last_repair_day" date,
	"gold_streak" integer DEFAULT 0 NOT NULL,
	"restore_code_hash" text,
	"device_hash" text,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"is_seed" boolean DEFAULT false NOT NULL,
	"age_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_handle_format" CHECK ("users"."handle" ~ '^[a-z0-9_]{3,20}$'),
	CONSTRAINT "users_city_length" CHECK ("users"."city" is null or char_length("users"."city") between 1 and 60),
	CONSTRAINT "users_xp_nonneg" CHECK ("users"."xp" >= 0),
	CONSTRAINT "users_flame_nonneg" CHECK ("users"."flame" >= 0),
	CONSTRAINT "users_flame_best" CHECK ("users"."flame_best" >= "users"."flame"),
	CONSTRAINT "users_freezes_range" CHECK ("users"."freezes" between 0 and 2),
	CONSTRAINT "users_gold_streak_nonneg" CHECK ("users"."gold_streak" >= 0),
	CONSTRAINT "users_settings_object" CHECK (jsonb_typeof("users"."settings") = 'object')
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_author_state_regions_code_fk" FOREIGN KEY ("author_state") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_partner_fk" FOREIGN KEY ("partner_answer_id") REFERENCES "public"."answers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_a_concepts_id_fk" FOREIGN KEY ("a") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_edges" ADD CONSTRAINT "concept_edges_b_concepts_id_fk" FOREIGN KEY ("b") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_prompt_fk" FOREIGN KEY ("day","idx") REFERENCES "public"."daily_set_prompts"("day","idx") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_set_prompts" ADD CONSTRAINT "daily_set_prompts_day_daily_sets_day_fk" FOREIGN KEY ("day") REFERENCES "public"."daily_sets"("day") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_set_prompts" ADD CONSTRAINT "daily_set_prompts_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexicon" ADD CONSTRAINT "lexicon_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_rounds" ADD CONSTRAINT "pack_rounds_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_rounds" ADD CONSTRAINT "pack_rounds_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_burnt" ADD CONSTRAINT "prompt_burnt_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_burnt" ADD CONSTRAINT "prompt_burnt_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_days" ADD CONSTRAINT "user_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_state_code_regions_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_state_code_regions_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_partner_pool_idx" ON "answers" USING btree ("prompt_id","received_at" DESC NULLS LAST) WHERE not "answers"."flagged" and cardinality("answers"."words") > 0;--> statement-breakpoint
CREATE INDEX "answers_user_received_idx" ON "answers" USING btree ("user_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "answers_pack_idx" ON "answers" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "answers_user_gold_idx" ON "answers" USING btree ("user_id","received_at") WHERE "answers"."gold_correct" is not null;--> statement-breakpoint
CREATE INDEX "concept_edges_b_idx" ON "concept_edges" USING btree ("b");--> statement-breakpoint
CREATE INDEX "daily_answers_day_idx" ON "daily_answers" USING btree ("day","idx");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_name_created_idx" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "ledger_user_created_idx" ON "ledger" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_one_earn_per_pack" ON "ledger" USING btree ("pack_id") WHERE "ledger"."kind" = 'earn';--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_one_debit_per_payout" ON "ledger" USING btree ("payout_id") WHERE "ledger"."kind" = 'payout';--> statement-breakpoint
CREATE INDEX "lexicon_term_idx" ON "lexicon" USING btree ("term");--> statement-breakpoint
CREATE INDEX "lexicon_concept_idx" ON "lexicon" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "lexicon_candidates_review_idx" ON "lexicon_candidates" USING btree ("status","seen" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "packs_user_created_idx" ON "packs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "packs_user_uncollected_idx" ON "packs" USING btree ("user_id") WHERE "packs"."collected_at" is null;--> statement-breakpoint
CREATE INDEX "payouts_user_created_idx" ON "payouts" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payouts_pending_idx" ON "payouts" USING btree ("created_at") WHERE "payouts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "prompts_active_idx" ON "prompts" USING btree ("kind","is_gold") WHERE "prompts"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_asset_key_unique" ON "prompts" USING btree ("asset_key");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_days_day_idx" ON "user_days" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_unique" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "users_restore_code_hash_unique" ON "users" USING btree ("restore_code_hash");--> statement-breakpoint
CREATE INDEX "users_device_hash_idx" ON "users" USING btree ("device_hash");--> statement-breakpoint
CREATE INDEX "users_state_city_idx" ON "users" USING btree ("state_code","city");