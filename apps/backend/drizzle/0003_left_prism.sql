CREATE TABLE "integrations" (
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"account_label" text DEFAULT '' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_ciphertext" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_user_id_source_pk" PRIMARY KEY("user_id","source")
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;