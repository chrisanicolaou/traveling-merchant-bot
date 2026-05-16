-- Merge any pre-existing duplicate trade rows so the new unique constraint can be applied.
WITH ranked AS (
	SELECT
		id,
		ROW_NUMBER() OVER (
			PARTITION BY discord_user_id, direction, printing_id
			ORDER BY id
		) AS rn,
		SUM(quantity) OVER (
			PARTITION BY discord_user_id, direction, printing_id
		) AS total_qty
	FROM trades
)
UPDATE trades t
SET quantity = r.total_qty
FROM ranked r
WHERE t.id = r.id AND r.rn = 1;
--> statement-breakpoint
DELETE FROM trades t
USING (
	SELECT id
	FROM (
		SELECT
			id,
			ROW_NUMBER() OVER (
				PARTITION BY discord_user_id, direction, printing_id
				ORDER BY id
			) AS rn
		FROM trades
	) s
	WHERE rn > 1
) r
WHERE t.id = r.id;
--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_direction_printing_unique" UNIQUE("discord_user_id","direction","printing_id");