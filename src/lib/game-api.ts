import { supabase } from './supabase'

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-server`

async function callGameServer(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  })

  const result = await response.json()
  if (result.error) throw new Error(result.error)
  return result
}

export const gameApi = {
  createTable: (name: string) => callGameServer('create-table', { name }),
  joinTable: (tableId: string) => callGameServer('join-table', { tableId }),
  leaveTable: (tableId: string) => callGameServer('leave-table', { tableId }),
  startGame: (tableId: string) => callGameServer('start-game', { tableId }),
  playCard: (tableId: string, cardIndex: number, cardId: string) =>
    callGameServer('play-card', { tableId, cardIndex, cardId }),
  drawCard: (tableId: string) => callGameServer('draw-card', { tableId }),
  takePenalty: (tableId: string) => callGameServer('take-penalty', { tableId }),
  suiteRequest: (tableId: string, suite: string) =>
    callGameServer('suite-request', { tableId, suite }),
  getGameState: (tableId: string) => callGameServer('get-game-state', { tableId }),
}
