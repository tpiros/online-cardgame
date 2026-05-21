
/*
  # Enable REPLICA IDENTITY FULL for realtime subscriptions

  Supabase Realtime filtered subscriptions (filter: col=eq.value) require
  REPLICA IDENTITY FULL on each table so the full row is available in the
  WAL stream for filter matching.
*/

ALTER TABLE tables REPLICA IDENTITY FULL;
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE game_messages REPLICA IDENTITY FULL;
