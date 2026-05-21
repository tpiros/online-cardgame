import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUITS = ["H", "C", "S", "D"];

function createPack(): string[] {
  const pack: string[] = [];
  for (const suit of SUITS) {
    for (let num = 1; num <= 13; num++) {
      pack.push(`${num}${suit}`);
    }
  }
  return pack.concat([...pack]);
}

function shufflePack(pack: string[]): string[] {
  const shuffled = [...pack];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardNumber(card: string): number {
  return parseInt(card);
}

function getCardSuit(card: string): string {
  return card.slice(-1);
}

function isActionCard(card: string): boolean {
  const num = getCardNumber(card);
  return num === 1 || num === 2 || num === 13;
}

function isPenalisingCard(card: string): boolean {
  return getCardNumber(card) === 2;
}

function isCardPlayable(card: string, lastCard: string): boolean {
  return getCardNumber(card) === getCardNumber(lastCard) || getCardSuit(card) === getCardSuit(lastCard);
}

function isPenalisingActionCardPlayable(card: string, lastCard: string): boolean {
  return getCardNumber(card) === 2 && getCardNumber(lastCard) === 2;
}

function isWinning(hand: string[]): boolean {
  return hand.length === 0;
}

function replenishPack(pack: string[], cardsOnTable: string[]): { pack: string[]; cardsOnTable: string[] } {
  if (pack.length < 1) {
    const lastCard = cardsOnTable[cardsOnTable.length - 1];
    const discarded = cardsOnTable.slice(0, -1);
    return { pack: shufflePack(discarded), cardsOnTable: [lastCard] };
  }
  return { pack, cardsOnTable };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    const userId = user.id;
    const userName = user.user_metadata?.name || user.email?.split("@")[0] || "Player";

    const ensurePlayer = async () => {
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingPlayer) {
        await supabase.from("players").insert({
          id: userId,
          name: userName,
          status: "available",
          hand: [],
        });
      }
    };

    switch (action) {
      case "create-table": {
        const { name } = body;
        await ensurePlayer();

        const pack = shufflePack(createPack());
        const { data: table, error } = await supabase
          .from("tables")
          .insert({ name: name || "Game Table", pack, status: "available" })
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from("players")
          .update({ table_id: table.id, status: "intable" })
          .eq("id", userId);

        await supabase.from("game_messages").insert({
          table_id: table.id,
          player_id: userId,
          type: "info",
          message: `${userName} created the table`,
        });

        const { data: updatedTable } = await supabase
          .from("tables")
          .select("*")
          .eq("id", table.id)
          .single();

        return new Response(JSON.stringify({ table: updatedTable }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "join-table": {
        const { tableId } = body;
        await ensurePlayer();

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        if (!table) {
          return new Response(JSON.stringify({ error: "Table not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { count: playerCount } = await supabase
          .from("players")
          .select("*", { count: "exact", head: true })
          .eq("table_id", tableId)
          .in("status", ["intable", "playing"]);

        if (table.status !== "available" || (playerCount ?? 0) >= table.player_limit) {
          return new Response(JSON.stringify({ error: "Table is full or in progress" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase
          .from("players")
          .update({ table_id: tableId, status: "intable" })
          .eq("id", userId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "info",
          message: `${userName} joined the table`,
        });

        const { data: updatedTable } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        return new Response(JSON.stringify({ table: updatedTable, playerCount: (playerCount ?? 0) + 1 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "leave-table": {
        const { tableId } = body;
        await ensurePlayer();

        await supabase
          .from("players")
          .update({ table_id: null, status: "available", hand: [], turn_finished: false })
          .eq("id", userId);

        const { count: remainingCount } = await supabase
          .from("players")
          .select("*", { count: "exact", head: true })
          .eq("table_id", tableId);

        if ((remainingCount ?? 0) === 0) {
          await supabase.from("game_messages").delete().eq("table_id", tableId);
          await supabase.from("tables").delete().eq("id", tableId);
        } else {
          const { data: tableData } = await supabase
            .from("tables")
            .select("status")
            .eq("id", tableId)
            .single();

          if (tableData && tableData.status !== "playing") {
            await supabase
              .from("tables")
              .update({ status: "available" })
              .eq("id", tableId);
          }

          await supabase.from("game_messages").insert({
            table_id: tableId,
            player_id: userId,
            type: "info",
            message: `${userName} left the table`,
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "start-game": {
        const { tableId } = body;

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        if (!table) throw new Error("Table not found");

        // Idempotent: if already playing, just return success
        if (table.status === "playing") {
          return new Response(JSON.stringify({ alreadyStarted: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: players } = await supabase
          .from("players")
          .select("*")
          .eq("table_id", tableId);

        if (!players || players.length < 2) {
          return new Response(JSON.stringify({ error: "Need 2 players to start" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let pack = [...table.pack];
        const firstCard = pack[0];
        pack = pack.slice(1);

        for (const player of players) {
          const hand = pack.slice(0, 5);
          pack = pack.slice(5);
          await supabase
            .from("players")
            .update({ hand, status: "playing", turn_finished: false })
            .eq("id", player.id);
        }

        const startingPlayerIndex = Math.floor(Math.random() * players.length);
        const firstCardNum = getCardNumber(firstCard);
        const actionCardActive = isActionCard(firstCard);
        const penalisingActive = isPenalisingCard(firstCard);
        // If the first card is a 2, start with forced_draw = 2
        const initialForcedDraw = penalisingActive ? 2 : 0;
        // If the first card is an Ace, the starting player must request a suit
        const requestActive = firstCardNum === 1;

        await supabase
          .from("tables")
          .update({
            status: "playing",
            pack,
            cards_on_table: [firstCard],
            action_card: actionCardActive,
            penalising_action_card: penalisingActive,
            request_action_card: requestActive,
            forced_draw: initialForcedDraw,
            suite_request: null,
            number_request: null,
            current_player_index: startingPlayerIndex,
            ready_to_play_counter: players.length,
          })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          type: "success",
          message: "Game started!",
        });

        return new Response(
          JSON.stringify({
            startingPlayerId: players[startingPlayerIndex].id,
            firstCard,
            actionCardActive,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "play-card": {
        const { tableId, cardIndex, cardId } = body;

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("id", userId)
          .single();

        if (!table || !player) throw new Error("Table or player not found");
        if (player.turn_finished) {
          return new Response(JSON.stringify({ error: "Not your turn" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const hand: string[] = player.hand || [];
        const serverIndex = hand.indexOf(cardId);
        if (serverIndex === -1 || serverIndex !== cardIndex) {
          return new Response(JSON.stringify({ error: "Invalid card" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const cardsOnTable: string[] = table.cards_on_table || [];
        const lastCard = cardsOnTable[cardsOnTable.length - 1];
        const cardNum = getCardNumber(cardId);
        const cardSuit = getCardSuit(cardId);

        // Validate card playability based on active game state
        if (table.action_card && table.penalising_action_card) {
          // 2 is active: must play a 2 to counter, or use take-penalty action
          if (!isPenalisingActionCardPlayable(cardId, lastCard)) {
            return new Response(JSON.stringify({ error: "Must play a 2 or take the penalty" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else if (table.request_action_card && table.suite_request) {
          // Ace suit request active: must match requested suit, or counter with another Ace
          if (cardNum !== 1 && cardSuit !== table.suite_request) {
            return new Response(JSON.stringify({ error: `Must play ${table.suite_request} suit or an Ace` }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else if (table.request_action_card && table.number_request) {
          // King number request active: must match requested number, or counter with another King
          const requestedNum = parseInt(table.number_request);
          if (cardNum !== 13 && cardNum !== requestedNum) {
            return new Response(JSON.stringify({ error: `Must play a ${table.number_request} or a King` }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else if (!isCardPlayable(cardId, lastCard)) {
          return new Response(JSON.stringify({ error: "Card not playable" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const newHand = [...hand];
        newHand.splice(serverIndex, 1);
        const newCardsOnTable = [...cardsOnTable, cardId];

        // Compute new action state based on the played card
        let actionCard = false;
        let penalisingActionCard = false;
        let requestActionCard = false;
        let forcedDraw = 0;
        let suiteRequest: string | null = null;
        let numberRequest: string | null = null;

        if (cardNum === 2) {
          actionCard = true;
          penalisingActionCard = true;
          forcedDraw = (table.forced_draw || 0) + 2;
        } else if (cardNum === 1) {
          // Ace: player must follow up with a suite-request action
          actionCard = true;
          requestActionCard = true;
        } else if (cardNum === 13) {
          // King: player must follow up with a number-request action
          actionCard = true;
          requestActionCard = true;
        }
        // All other cards: all flags stay false/null (reset)

        const { data: allPlayers } = await supabase
          .from("players")
          .select("*")
          .eq("table_id", tableId);

        const currentIdx = allPlayers!.findIndex((p) => p.id === userId);
        const nextPlayerIndex = (currentIdx + 1) % allPlayers!.length;

        await supabase.from("players").update({ hand: newHand, turn_finished: true }).eq("id", userId);

        for (const p of allPlayers!) {
          if (p.id !== userId) {
            await supabase.from("players").update({ turn_finished: false }).eq("id", p.id);
          }
        }

        await supabase
          .from("tables")
          .update({
            cards_on_table: newCardsOnTable,
            action_card: actionCard,
            penalising_action_card: penalisingActionCard,
            request_action_card: requestActionCard,
            forced_draw: forcedDraw,
            suite_request: suiteRequest,
            number_request: numberRequest,
            current_player_index: nextPlayerIndex,
          })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "action",
          message: `${userName} played ${cardId}`,
        });

        const winner = isWinning(newHand);
        if (winner) {
          await supabase.from("tables").update({ status: "finished" }).eq("id", tableId);
          await supabase.from("game_messages").insert({
            table_id: tableId,
            player_id: userId,
            type: "success",
            message: `${userName} wins!`,
          });
        }

        return new Response(
          JSON.stringify({
            hand: newHand,
            cardsOnTable: newCardsOnTable,
            winner,
            nextPlayerIndex,
            actionCard,
            penalisingActionCard,
            forcedDraw,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "draw-card": {
        const { tableId } = body;

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("id", userId)
          .single();

        if (!table || !player) throw new Error("Table or player not found");
        if (player.turn_finished) {
          return new Response(JSON.stringify({ error: "Not your turn" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Cannot draw freely when a penalty 2 is active — must use take-penalty
        if (table.action_card && table.penalising_action_card) {
          return new Response(JSON.stringify({ error: "Must take the penalty or play a 2" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let pack: string[] = [...(table.pack || [])];
        let cardsOnTable: string[] = [...(table.cards_on_table || [])];
        const hand: string[] = [...(player.hand || [])];

        ({ pack, cardsOnTable } = replenishPack(pack, cardsOnTable));

        const drawn = pack.slice(0, 1);
        pack = pack.slice(1);
        const newHand = [...hand, ...drawn];

        const { data: allPlayers } = await supabase
          .from("players")
          .select("*")
          .eq("table_id", tableId);

        const currentIdx = allPlayers!.findIndex((p) => p.id === userId);
        const nextPlayerIndex = (currentIdx + 1) % allPlayers!.length;

        await supabase.from("players").update({ hand: newHand, turn_finished: true }).eq("id", userId);

        for (const p of allPlayers!) {
          if (p.id !== userId) {
            await supabase.from("players").update({ turn_finished: false }).eq("id", p.id);
          }
        }

        await supabase
          .from("tables")
          .update({
            pack,
            cards_on_table: cardsOnTable,
            current_player_index: nextPlayerIndex,
            action_card: false,
            penalising_action_card: false,
            request_action_card: false,
            forced_draw: 0,
            suite_request: null,
            number_request: null,
          })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "info",
          message: `${userName} drew a card`,
        });

        return new Response(
          JSON.stringify({ hand: newHand, pack, cardsOnTable, nextPlayerIndex }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "take-penalty": {
        const { tableId } = body;

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("id", userId)
          .single();

        if (!table || !player) throw new Error("Table or player not found");
        if (player.turn_finished) {
          return new Response(JSON.stringify({ error: "Not your turn" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let pack: string[] = [...(table.pack || [])];
        let cardsOnTable: string[] = [...(table.cards_on_table || [])];
        const hand: string[] = [...(player.hand || [])];
        const forcedDraw = table.forced_draw || 2;

        ({ pack, cardsOnTable } = replenishPack(pack, cardsOnTable));

        const drawn = pack.slice(0, forcedDraw);
        pack = pack.slice(forcedDraw);
        const newHand = [...hand, ...drawn];

        const { data: allPlayers } = await supabase
          .from("players")
          .select("*")
          .eq("table_id", tableId);

        const currentIdx = allPlayers!.findIndex((p) => p.id === userId);
        const nextPlayerIndex = (currentIdx + 1) % allPlayers!.length;

        await supabase.from("players").update({ hand: newHand, turn_finished: true }).eq("id", userId);

        for (const p of allPlayers!) {
          if (p.id !== userId) {
            await supabase.from("players").update({ turn_finished: false }).eq("id", p.id);
          }
        }

        await supabase
          .from("tables")
          .update({
            pack,
            cards_on_table: cardsOnTable,
            action_card: false,
            penalising_action_card: false,
            request_action_card: false,
            forced_draw: 0,
            suite_request: null,
            number_request: null,
            current_player_index: nextPlayerIndex,
          })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "action",
          message: `${userName} took ${forcedDraw} penalty cards`,
        });

        return new Response(
          JSON.stringify({ hand: newHand, nextPlayerIndex }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "suite-request": {
        const { tableId, suite } = body;

        await supabase
          .from("tables")
          .update({ suite_request: suite, number_request: null, request_action_card: true, action_card: true })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "action",
          message: `${userName} requested suit: ${suite}`,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "number-request": {
        const { tableId, number } = body;

        await supabase
          .from("tables")
          .update({ number_request: String(number), suite_request: null, request_action_card: true, action_card: true })
          .eq("id", tableId);

        await supabase.from("game_messages").insert({
          table_id: tableId,
          player_id: userId,
          type: "action",
          message: `${userName} requested number: ${number}`,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-game-state": {
        const { tableId } = body;

        const { data: table } = await supabase
          .from("tables")
          .select("*")
          .eq("id", tableId)
          .single();

        const { data: players } = await supabase
          .from("players")
          .select("id, name, status, hand, turn_finished")
          .eq("table_id", tableId);

        const { data: messages } = await supabase
          .from("game_messages")
          .select("*")
          .eq("table_id", tableId)
          .order("created_at", { ascending: false })
          .limit(50);

        const myPlayer = players?.find((p) => p.id === userId);
        const otherPlayers = players?.filter((p) => p.id !== userId);

        return new Response(
          JSON.stringify({
            table,
            myPlayer,
            otherPlayers: otherPlayers?.map((p) => ({
              ...p,
              hand: (p.hand as string[])?.length ?? 0,
            })),
            messages,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
