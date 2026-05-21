/*
  # Tighten RLS policies for tables

  1. Security Changes
    - Replace overly permissive table UPDATE/INSERT policies
    - Only allow players at a table to update it
    - Only authenticated users can create tables
    - Remove the "USING (true)" policies that were too broad
*/

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can update tables" ON tables;
DROP POLICY IF EXISTS "Authenticated users can insert tables" ON tables;

-- More restrictive policies
CREATE POLICY "Authenticated users can create tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players at table can update it"
  ON tables FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.table_id = tables.id
      AND players.id = auth.uid()
    )
  );
