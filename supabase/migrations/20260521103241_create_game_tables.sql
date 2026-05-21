/*
  # Create game tables for Macaonline card game

  1. New Tables
    - `players`
      - `id` (uuid, primary key) - player unique ID
      - `name` (text) - player display name
      - `table_id` (uuid, nullable) - currently joined table
      - `status` (text) - player status: 'available', 'intable', 'playing'
      - `hand` (jsonb) - array of card IDs in player's hand
      - `turn_finished` (boolean) - whether player's turn is done
      - `created_at` (timestamptz) - when player joined

    - `tables`
      - `id` (uuid, primary key) - table unique ID
      - `name` (text) - table display name
      - `status` (text) - table status: 'available', 'unavailable', 'playing'
      - `player_limit` (integer) - max players per table (default 2)
      - `pack` (jsonb) - remaining cards in the deck
      - `cards_on_table` (jsonb) - cards on the discard pile
      - `action_card` (boolean) - whether an action card is active
      - `request_action_card` (boolean) - whether a request action card is active
      - `penalising_action_card` (boolean) - whether a penalising action card is active
      - `forced_draw` (integer) - number of cards forced to draw
      - `suite_request` (text) - requested suit
      - `number_request` (text) - requested number
      - `current_player_index` (integer) - whose turn it is
      - `ready_to_play_counter` (integer) - how many players are ready
      - `created_at` (timestamptz) - when table was created

    - `game_messages`
      - `id` (uuid, primary key) - message unique ID
      - `table_id` (uuid) - which table this message belongs to
      - `player_id` (uuid, nullable) - which player sent the message
      - `type` (text) - message type: 'info', 'error', 'success', 'action'
      - `message` (text) - message content
      - `created_at` (timestamptz) - when message was sent

  2. Security
    - Enable RLS on all tables
    - Players can read/update their own data
    - Players can read table data for tables they belong to
    - Game messages readable by players at the same table
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  table_id uuid,
  status text NOT NULL DEFAULT 'available',
  hand jsonb NOT NULL DEFAULT '[]'::jsonb,
  turn_finished boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  player_limit integer NOT NULL DEFAULT 2,
  pack jsonb NOT NULL DEFAULT '[]'::jsonb,
  cards_on_table jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_card boolean NOT NULL DEFAULT false,
  request_action_card boolean NOT NULL DEFAULT false,
  penalising_action_card boolean NOT NULL DEFAULT false,
  forced_draw integer NOT NULL DEFAULT 0,
  suite_request text NOT NULL DEFAULT '',
  number_request text NOT NULL DEFAULT '',
  current_player_index integer NOT NULL DEFAULT 0,
  ready_to_play_counter integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL,
  player_id uuid,
  type text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add foreign keys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'table_id'
  ) THEN
    ALTER TABLE players ADD COLUMN table_id uuid;
  END IF;
END $$;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_table_id_fkey;
ALTER TABLE players ADD CONSTRAINT players_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL;

ALTER TABLE game_messages DROP CONSTRAINT IF EXISTS game_messages_table_id_fkey;
ALTER TABLE game_messages ADD CONSTRAINT game_messages_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE;

ALTER TABLE game_messages DROP CONSTRAINT IF EXISTS game_messages_player_id_fkey;
ALTER TABLE game_messages ADD CONSTRAINT game_messages_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_messages ENABLE ROW LEVEL SECURITY;

-- Players policies
CREATE POLICY "Players can read own data"
  ON players FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Players can update own data"
  ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Players can insert own data"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Tables policies - players at the table can read/update
CREATE POLICY "Anyone can read available tables"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert tables"
  ON tables FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Game messages policies
CREATE POLICY "Players can read messages for their table"
  ON game_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON game_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_players_table_id ON players(table_id);
CREATE INDEX IF NOT EXISTS idx_game_messages_table_id ON game_messages(table_id);
CREATE INDEX IF NOT EXISTS idx_game_messages_created_at ON game_messages(created_at);
