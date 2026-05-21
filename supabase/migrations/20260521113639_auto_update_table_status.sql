
/*
  # Auto-update table status via trigger

  Instead of relying on the edge function to correctly set table status,
  a trigger on the players table automatically updates the parent table's
  status whenever a player joins or leaves:
  - 0 players: 'available'
  - 1 player (< limit): 'available'
  - >= limit players: 'unavailable'
  - 'playing' status is never overridden by this trigger (game in progress)
*/

CREATE OR REPLACE FUNCTION update_table_status()
RETURNS TRIGGER AS $$
DECLARE
  tid uuid;
  pcount int;
  plimit int;
  current_status text;
BEGIN
  -- Determine which table_id changed
  IF TG_OP = 'DELETE' THEN
    tid := OLD.table_id;
  ELSE
    tid := NEW.table_id;
    -- Also handle old table_id when player moves tables
    IF TG_OP = 'UPDATE' AND OLD.table_id IS NOT NULL AND OLD.table_id <> NEW.table_id THEN
      SELECT COUNT(*), t.player_limit, t.status
        INTO pcount, plimit, current_status
        FROM players p, tables t
        WHERE p.table_id = OLD.table_id AND t.id = OLD.table_id
        GROUP BY t.player_limit, t.status;
      IF current_status NOT IN ('playing') THEN
        UPDATE tables SET status = CASE WHEN COALESCE(pcount, 0) >= plimit THEN 'unavailable' ELSE 'available' END
        WHERE id = OLD.table_id;
      END IF;
    END IF;
  END IF;

  IF tid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(p.id), t.player_limit, t.status
    INTO pcount, plimit, current_status
    FROM tables t
    LEFT JOIN players p ON p.table_id = t.id
    WHERE t.id = tid
    GROUP BY t.player_limit, t.status;

  -- Don't override 'playing' status
  IF current_status NOT IN ('playing') THEN
    UPDATE tables
      SET status = CASE WHEN COALESCE(pcount, 0) >= plimit THEN 'unavailable' ELSE 'available' END
      WHERE id = tid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_table_status ON players;
CREATE TRIGGER trg_update_table_status
AFTER INSERT OR UPDATE OF table_id OR DELETE ON players
FOR EACH ROW EXECUTE FUNCTION update_table_status();
