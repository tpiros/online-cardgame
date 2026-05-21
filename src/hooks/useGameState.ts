import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { gameApi } from '../lib/game-api'
import type { CardId } from '../types/game'

interface OtherPlayer {
  id: string
  name: string
  status: string
  hand: number
  turn_finished: boolean
}

interface GameMessage {
  id: string
  type: string
  message: string
  player_id?: string
  created_at: string
}

interface TableData {
  id: string
  name: string
  status: string
  player_limit: number
  pack: CardId[]
  cards_on_table: CardId[]
  action_card: boolean
  request_action_card: boolean
  penalising_action_card: boolean
  forced_draw: number
  suite_request: string | null
  number_request: string | null
  current_player_index: number
}

interface MyPlayer {
  id: string
  name: string
  status: string
  hand: CardId[]
  turn_finished: boolean
}

interface GameState {
  table: TableData | null
  myPlayer: MyPlayer | null
  otherPlayers: OtherPlayer[]
  messages: GameMessage[]
  isMyTurn: boolean
  lastCardOnTable: CardId | null
  packCount: number
}

export function useGameState(tableId: string | null) {
  const [state, setState] = useState<GameState>({
    table: null,
    myPlayer: null,
    otherPlayers: [],
    messages: [],
    isMyTurn: false,
    lastCardOnTable: null,
    packCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchState = useCallback(async () => {
    if (!tableId) return
    setLoading(true)
    setError(null)
    try {
      const result = await gameApi.getGameState(tableId)
      const isMyTurn = !result.myPlayer?.turn_finished && result.table?.status === 'playing'
      setState({
        table: result.table,
        myPlayer: result.myPlayer,
        otherPlayers: result.otherPlayers || [],
        messages: result.messages || [],
        isMyTurn,
        lastCardOnTable: result.table?.cards_on_table?.[result.table.cards_on_table.length - 1] ?? null,
        packCount: result.table?.pack?.length ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch game state')
    } finally {
      setLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    if (!tableId) return

    fetchState()

    const channel = supabase.channel(`table-${tableId}`)
    channelRef.current = channel

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, () => {
        fetchState()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `table_id=eq.${tableId}` }, () => {
        fetchState()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_messages', filter: `table_id=eq.${tableId}` }, (payload) => {
        setState((prev) => ({
          ...prev,
          messages: [{ ...payload.new as GameMessage }, ...prev.messages].slice(0, 50),
        }))
        fetchState()
      })
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [tableId, fetchState])

  const playCard = useCallback(async (cardIndex: number, cardId: string) => {
    if (!tableId) return
    setError(null)
    try {
      const result = await gameApi.playCard(tableId, cardIndex, cardId)
      setState((prev) => ({
        ...prev,
        myPlayer: prev.myPlayer ? { ...prev.myPlayer, hand: result.hand, turn_finished: true } : null,
        isMyTurn: false,
        lastCardOnTable: cardId,
      }))
      if (result.winner) {
        setState((prev) => ({ ...prev, isMyTurn: false }))
      }
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to play card')
    }
  }, [tableId, fetchState])

  const drawCard = useCallback(async () => {
    if (!tableId) return
    setError(null)
    try {
      await gameApi.drawCard(tableId)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to draw card')
    }
  }, [tableId, fetchState])

  const takePenalty = useCallback(async () => {
    if (!tableId) return
    setError(null)
    try {
      await gameApi.takePenalty(tableId)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take penalty')
    }
  }, [tableId, fetchState])

  const suiteRequest = useCallback(async (suite: string) => {
    if (!tableId) return
    setError(null)
    try {
      await gameApi.suiteRequest(tableId, suite)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make suite request')
    }
  }, [tableId, fetchState])

  const numberRequest = useCallback(async (number: number) => {
    if (!tableId) return
    setError(null)
    try {
      await gameApi.numberRequest(tableId, number)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to make number request')
    }
  }, [tableId, fetchState])

  return { ...state, loading, error, playCard, drawCard, takePenalty, suiteRequest, numberRequest, refetch: fetchState }
}
