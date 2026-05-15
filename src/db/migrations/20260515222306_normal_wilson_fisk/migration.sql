CREATE TABLE "card_datas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_printings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"card_id" uuid NOT NULL,
	"set_id" varchar(15) NOT NULL,
	"riftbound_id" varchar(32),
	"riftcodex_id" varchar(32),
	"tcgplayer_id" integer,
	"image_url" varchar(2047),
	"artist" varchar(255),
	"traits" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" varchar(15) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"riftcodex_id" varchar(32),
	"tcg_player_id" varchar(15),
	"card_count" smallint,
	"release_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"printing_id" uuid NOT NULL,
	"discord_user_id" varchar(255) NOT NULL,
	"direction" smallint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_printings" ADD CONSTRAINT "card_printings_card_id_card_datas_id_fkey" FOREIGN KEY ("card_id") REFERENCES "card_datas"("id");--> statement-breakpoint
ALTER TABLE "card_printings" ADD CONSTRAINT "card_printings_set_id_sets_id_fkey" FOREIGN KEY ("set_id") REFERENCES "sets"("id");--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_printing_id_card_printings_id_fkey" FOREIGN KEY ("printing_id") REFERENCES "card_printings"("id");