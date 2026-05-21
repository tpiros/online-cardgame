
/*
  # Add tables to supabase_realtime publication

  Tables must be added to the supabase_realtime publication for
  Postgres Changes subscriptions to receive events from them.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE tables, players, game_messages;
