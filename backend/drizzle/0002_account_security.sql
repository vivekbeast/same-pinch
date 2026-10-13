CREATE TYPE "public"."identity_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"subject_hash" text NOT NULL,
	"display" text NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "auth_identities_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_status" "kyc_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_subject_unique" ON "auth_identities" USING btree ("provider","subject_hash");