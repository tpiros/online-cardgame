export type Suit = 'H' | 'C' | 'S' | 'D'
export type CardId = string // e.g. "1S", "13H", "7C"

export interface Card {
  id: CardId
  number: number // 1-13
  suit: Suit
}

export type PlayerStatus = 'available' | 'intable' | 'playing'
export type TableStatus = 'available' | 'unavailable' | 'playing'

export interface Player {
  id: string
  name: string
  tableId: string | null
  hand: CardId[]
  status: PlayerStatus
  turnFinished: boolean
}

export interface TableState {
  id: string
  name: string
  status: TableStatus
  players: Player[]
  playerLimit: number
  pack: CardId[]
  cardsOnTable: CardId[]
  actionCard: boolean
  requestActionCard: boolean
  penalisingActionCard: boolean
  forcedDraw: number
  suiteRequest: string
  numberRequest: string
  currentPlayerIndex: number
  readyToPlayCounter: number
}

export interface GameMessage {
  type: 'info' | 'error' | 'success' | 'action'
  message: string
  timestamp: number
}
