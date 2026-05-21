/*
  # Fix table management RLS policies

  1. Security Changes
    - Replace `tables` INSERT policy: allow any authenticated user to create
      a table (they don't need a pre-existing player row). The edge function
      handles player creation atomically.
    - Add DELETE policy on `tables`: only players at the table can delete it
      (needed for cleanup when last player leaves).
    - Replace `game_messages` INSERT policy: allow authenticated users who are
      at the table OR who are in the process of joining (table_id being set
      in the same transaction by the edge function). Since the edge function
      uses the service role key and bypasses RLS, the client-side INSERT
      policy only needs to cover the realtime subscription path. We relax
      to: authenticated users can insert messages if they have a player record
      (the edge function validates table membership).
    - Add DELETE policy on `players`: players can delete their own record
      (for cleanup on leave).
*/

-- Drop old policies
DROP POLICY IF EXISTS "Players can create tables" ON tables;
DROP POLICY IF EXISTS "Players can insert messages for their table" ON game_messages;

-- tables: any authenticated user can create a table
CREATE POLICY "Authenticated users can create tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- tables: players at the table can delete it
CREATE POLICY "Players at table can delete it"
  ON tables FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.table_id = tables.id
      AND players.id = auth.uid()
    )
  );

-- game_messages: authenticated users with a player record can insert messages
-- (the edge function validates table membership server-side)
CREATE POLICY "Authenticated players can insert messages"
  ON game_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
    )
  );

-- players: players can delete their own record
CREATE POLICY "Players can delete own data"
  ON players FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- players: allow reading all players (needed for lobby table counts and game state)
DROP POLICY IF EXISTS "Players can read own data" ON players;
CREATE POLICY "Players can read all players"
  ON players FOR SELECT
  TO authenticated
  USING (true);
