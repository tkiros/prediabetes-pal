CREATE TABLE "gdm_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gdm_items_kind_check" CHECK ("gdm_items"."kind" IN ('ask','plan','meal','plan_photo'))
);
--> statement-breakpoint
CREATE TABLE "gdm_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"appointment_ciphertext" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gdm_items" ADD CONSTRAINT "gdm_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdm_profiles" ADD CONSTRAINT "gdm_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gdm_items_user_kind" ON "gdm_items" USING btree ("user_id","kind","created_at");