/*
  # Fix RLS policies with always-true checks

  1. Security Changes
    - Replace the overly permissive INSERT policy on `game_messages`
      that used `WITH CHECK (true)`. Now requires the player to belong
      to the table they are posting a message to.
    - Replace the overly permissive INSERT policy on `tables`
      that used `WITH CHECK (true)`. Now requires the user to exist
      as a player record (authenticated user with a player profile).
*/

-- Drop the permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON game_messages;
DROP POLICY IF EXISTS "Authenticated users can create tables" ON tables;

-- game_messages: only players seated at the table can insert messages
CREATE POLICY "Players can insert messages for their table"
  ON game_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
      AND players.table_id = game_messages.table_id
    )
  );

-- tables: only authenticated users with a player profile can create tables
CREATE POLICY "Players can create tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = auth.uid()
    )
  );
