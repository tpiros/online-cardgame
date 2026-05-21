import type { CardId } from '../types/game'
import { getCardNumber, getCardSuit } from '../lib/game-logic'

interface CardProps {
  card: CardId
  onClick?: () => void
  playable?: boolean
  faceDown?: boolean
  selected?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SUIT_SYMBOLS: Record<string, string> = {
  H: '\u2665',
  C: '\u2663',
  S: '\u2660',
  D: '\u2666',
}

const SUIT_COLORS: Record<string, string> = {
  H: '#dc2626',
  C: '#1e293b',
  S: '#1e293b',
  D: '#dc2626',
}

const NUMBER_NAMES: Record<number, string> = {
  1: 'A', 11: 'J', 12: 'Q', 13: 'K',
}

const SIZE_MAP = {
  sm: { w: 48, h: 68, text: 10, suit: 16, corner: 8 },
  md: { w: 80, h: 112, text: 14, suit: 28, corner: 12 },
  lg: { w: 112, h: 156, text: 18, suit: 40, corner: 16 },
}

export function CardComponent({ card, onClick, playable = false, faceDown = false, selected = false, size = 'md' }: CardProps) {
  const s = SIZE_MAP[size]

  if (faceDown) {
    return (
      <div
        className="card-facedown"
        style={{ width: s.w, height: s.h, borderRadius: s.corner }}
      >
        <div className="card-facedown-inner" style={{ borderRadius: s.corner - 2 }}>
          <svg width={s.suit} height={s.suit} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.5 8.5L21 9.5L16.5 14L17.5 21L12 17.5L6.5 21L7.5 14L3 9.5L9.5 8.5L12 2Z" fill="rgba(255,255,255,0.15)" />
          </svg>
        </div>
      </div>
    )
  }

  const num = getCardNumber(card)
  const suit = getCardSuit(card)
  const displayNum = NUMBER_NAMES[num] || String(num)
  const suitSymbol = SUIT_SYMBOLS[suit]
  const color = SUIT_COLORS[suit]

  return (
    <button
      onClick={onClick}
      disabled={!playable}
      className={`card ${playable ? 'card-playable' : ''} ${selected ? 'card-selected' : ''}`}
      style={{ width: s.w, height: s.h, borderRadius: s.corner }}
    >
      <div className="card-inner" style={{ borderRadius: s.corner - 2 }}>
        {/* Top-left corner */}
        <div className="card-corner card-corner-top" style={{ fontSize: s.text, padding: s.corner / 3 }}>
          <span className="card-corner-num" style={{ color }}>{displayNum}</span>
          <span style={{ color, fontSize: s.text * 0.85, lineHeight: 1 }}>{suitSymbol}</span>
        </div>

        {/* Center suit */}
        <div className="card-center-suit" style={{ fontSize: s.suit, color }}>
          {suitSymbol}
        </div>

        {/* Bottom-right corner (rotated) */}
        <div className="card-corner card-corner-bottom" style={{ fontSize: s.text, padding: s.corner / 3 }}>
          <span className="card-corner-num" style={{ color }}>{displayNum}</span>
          <span style={{ color, fontSize: s.text * 0.85, lineHeight: 1 }}>{suitSymbol}</span>
        </div>
      </div>
    </button>
  )
}
