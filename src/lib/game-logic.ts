import type { CardId, Suit } from '../types/game'

const SUITS: Suit[] = ['H', 'C', 'S', 'D']

export function createPack(): CardId[] {
  const pack: CardId[] = []
  for (const suit of SUITS) {
    for (let num = 1; num <= 13; num++) {
      pack.push(`${num}${suit}`)
    }
  }
  return pack.concat([...pack]) // double deck (104 cards)
}

export function shufflePack(pack: CardId[]): CardId[] {
  const shuffled = [...pack]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function drawCards(
  pack: CardId[],
  amount: number,
  hand: CardId[],
  initial: boolean
): { drawn: CardId[]; pack: CardId[]; hand: CardId[] } {
  const drawn = pack.slice(0, amount)
  const newPack = pack.slice(amount)
  const newHand = initial ? hand : [...hand, ...drawn]
  return { drawn, pack: newPack, hand: newHand }
}

export function playCard(hand: CardId[], index: number, table: CardId[]): { hand: CardId[]; table: CardId[]; playedCard: CardId } {
  const playedCard = hand[index]
  const newHand = [...hand]
  newHand.splice(index, 1)
  return { hand: newHand, table: [...table, playedCard], playedCard }
}

export function getCardNumber(card: CardId): number {
  return parseInt(card)
}

export function getCardSuit(card: CardId): Suit {
  return card.slice(-1) as Suit
}

export function isCardPlayable(card: CardId, lastCard: CardId): boolean {
  return getCardNumber(card) === getCardNumber(lastCard) || getCardSuit(card) === getCardSuit(lastCard)
}

export function isPenalisingActionCardPlayable(card: CardId, lastCard: CardId): boolean {
  return getCardNumber(card) === 2 && getCardNumber(lastCard) === 2
}

export function isRequestActionCardPlayable(card: CardId, lastCard: CardId): boolean {
  const num = getCardNumber(card)
  const lastNum = getCardNumber(lastCard)
  return (num === 1 && lastNum === 1) || (num === 13 && lastNum === 13)
}

export function isActionCard(card: CardId): boolean {
  const num = getCardNumber(card)
  return num === 1 || num === 2 || num === 13
}

export function isPenalisingCard(card: CardId): boolean {
  return getCardNumber(card) === 2
}

export function isRequestCard(card: CardId): boolean {
  const num = getCardNumber(card)
  return num === 1 || num === 13
}

export function hasCardInHand(hand: CardId[], card: CardId): boolean {
  return hand.some(c => getCardNumber(c) === getCardNumber(card))
}

export function hasSuitInHand(hand: CardId[], suit: string): boolean {
  return hand.some(c => getCardSuit(c) === suit)
}

export function isWinning(hand: CardId[]): boolean {
  return hand.length === 0
}

export function getCardDisplayName(card: CardId): string {
  const num = getCardNumber(card)
  const suit = getCardSuit(card)
  const suitNames: Record<string, string> = { H: 'Hearts', C: 'Clubs', S: 'Spades', D: 'Diamonds' }
  const numberNames: Record<number, string> = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }
  const name = numberNames[num] || String(num)
  return `${name} of ${suitNames[suit]}`
}
