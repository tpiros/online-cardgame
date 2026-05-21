import { useState } from 'react'
import { useGameState } from '../hooks/useGameState'
import { CardComponent } from './CardComponent'
import { isCardPlayable, isPenalisingActionCardPlayable, getCardNumber } from '../lib/game-logic'
import type { CardId } from '../types/game'

interface GameBoardProps {
  tableId: string
  onLeave: () => void
}

export function GameBoard({ tableId, onLeave }: GameBoardProps) {
  const {
    table, myPlayer, otherPlayers, messages, isMyTurn,
    lastCardOnTable, packCount, error, playCard, drawCard, takePenalty, suiteRequest,
  } = useGameState(tableId)

  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [showSuiteDialog, setShowSuiteDialog] = useState(false)
  const [suiteInput, setSuiteInput] = useState('')

  if (!table || !myPlayer) {
    return (
      <div className="game-page">
        <div className="game-loading">
          <span className="auth-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </div>
    )
  }

  const hand: CardId[] = myPlayer.hand || []
  const isPenalising = table.penalising_action_card && table.action_card
  const isRequesting = table.request_action_card && table.action_card

  const canPlayCard = (card: CardId): boolean => {
    if (!lastCardOnTable) return true
    if (isPenalising) return isPenalisingActionCardPlayable(card, lastCardOnTable)
    return isCardPlayable(card, lastCardOnTable)
  }

  const handlePlayCard = (index: number, card: CardId) => {
    if (!isMyTurn) return
    if (!canPlayCard(card)) return

    const num = getCardNumber(card)
    if (num === 1 && !isPenalising) {
      setSelectedCard(index)
      setShowSuiteDialog(true)
      return
    }

    playCard(index, card)
    setSelectedCard(null)
  }

  const handleSuiteSubmit = () => {
    if (selectedCard !== null && suiteInput) {
      suiteRequest(suiteInput.toUpperCase())
      playCard(selectedCard, hand[selectedCard])
      setShowSuiteDialog(false)
      setSuiteInput('')
      setSelectedCard(null)
    }
  }

  const opponent = otherPlayers[0]
  const gameFinished = table.status !== 'playing' && myPlayer.hand.length === 0

  return (
    <div className="game-page">
      {/* Top Bar */}
      <header className="game-topbar">
        <div className="game-topbar-left">
          <div className="game-table-name">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
            {table.name}
          </div>
          <div className={`game-turn-badge ${isMyTurn ? 'game-turn-active' : 'game-turn-waiting'}`}>
            <span className="game-turn-dot" />
            {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
          </div>
        </div>
        <div className="game-topbar-right">
          <div className="game-deck-count">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
            {packCount}
          </div>
          <button onClick={onLeave} className="game-leave-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Leave
          </button>
        </div>
      </header>

      {/* Error Toast */}
      {error && (
        <div className="game-error-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {/* Game Table */}
      <div className="game-table">
        {/* Opponent */}
        <div className="game-opponent-area">
          <div className="game-player-info">
            <div className="game-player-avatar game-player-avatar-opponent">
              {opponent?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="game-player-name">{opponent?.name || 'Opponent'}</div>
              <div className="game-player-cards">
                {opponent?.hand ?? 0} card{(opponent?.hand ?? 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="game-opponent-hand">
            {Array.from({ length: opponent?.hand ?? 0 }).map((_, i) => (
              <div key={i} className="game-opponent-card" style={{ marginLeft: i > 0 ? -20 : 0 }}>
                <CardComponent card="1H" faceDown size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Center Table */}
        <div className="game-center">
          {/* Draw Pile */}
          <button
            onClick={drawCard}
            disabled={!isMyTurn || isPenalising}
            className={`game-draw-pile ${isMyTurn && !isPenalising ? 'game-draw-pile-active' : ''}`}
          >
            <div className="game-draw-stack">
              <div className="game-draw-card game-draw-card-3" />
              <div className="game-draw-card game-draw-card-2" />
              <div className="game-draw-card game-draw-card-1" />
            </div>
            <span className="game-draw-label">Draw</span>
          </button>

          {/* Discard Pile */}
          <div className="game-discard">
            {lastCardOnTable ? (
              <div className="game-discard-card">
                <CardComponent card={lastCardOnTable} size="lg" />
              </div>
            ) : (
              <div className="game-discard-empty">
                <span>No cards played yet</span>
              </div>
            )}
            {table.suite_request && (
              <div className="game-suite-request">
                Requested: {table.suite_request}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isMyTurn && (
          <div className="game-actions">
            {isPenalising && (
              <button onClick={takePenalty} className="game-action-btn game-action-penalty">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v10M4.93 4.93l2.83 2.83M2 12h10M4.93 19.07l2.83-2.83M12 22v-10M19.07 19.07l-2.83-2.83M22 12H12M19.07 4.93l-2.83 2.83" />
                </svg>
                Take {table.forced_draw} Cards
              </button>
            )}
            {isRequesting && !table.suite_request && (
              <button onClick={() => setShowSuiteDialog(true)} className="game-action-btn game-action-request">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Request Suit
              </button>
            )}
          </div>
        )}

        {/* Player Hand */}
        <div className="game-player-area">
          <div className="game-player-info">
            <div className="game-player-avatar game-player-avatar-me">
              {myPlayer.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="game-player-name">{myPlayer.name}</div>
              <div className="game-player-cards">
                {hand.length} card{hand.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div className="game-hand">
            {hand.map((card, index) => (
              <div
                key={`${card}-${index}`}
                className={`game-hand-card ${isMyTurn && canPlayCard(card) ? 'game-hand-card-playable' : ''}`}
                style={{ marginLeft: index > 0 ? -12 : 0 }}
              >
                <CardComponent
                  card={card}
                  playable={isMyTurn && canPlayCard(card)}
                  selected={selectedCard === index}
                  onClick={() => handlePlayCard(index, card)}
                  size="md"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Log */}
      <div className="game-log">
        <div className="game-log-inner">
          {messages.length === 0 ? (
            <div className="game-log-empty">Game log will appear here</div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`game-log-entry game-log-${msg.type}`}>
                <span className="game-log-dot" />
                {msg.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Suite Request Dialog */}
      {showSuiteDialog && (
        <div className="game-overlay" onClick={() => { setShowSuiteDialog(false); setSuiteInput(''); setSelectedCard(null) }}>
          <div className="game-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="game-dialog-title">Request a Suit</h3>
            <p className="game-dialog-sub">Choose the suit you want your opponent to play</p>
            <div className="game-suit-grid">
              {(['H', 'C', 'S', 'D'] as const).map((suit) => {
                const symbols: Record<string, string> = { H: '\u2665', C: '\u2663', S: '\u2660', D: '\u2666' }
                const colors: Record<string, string> = { H: '#dc2626', C: '#1e293b', S: '#1e293b', D: '#dc2626' }
                const names: Record<string, string> = { H: 'Hearts', C: 'Clubs', S: 'Spades', D: 'Diamonds' }
                return (
                  <button
                    key={suit}
                    onClick={() => setSuiteInput(suit)}
                    className={`game-suit-btn ${suiteInput === suit ? 'game-suit-btn-selected' : ''}`}
                  >
                    <span style={{ color: colors[suit], fontSize: 32 }}>{symbols[suit]}</span>
                    <span className="game-suit-name">{names[suit]}</span>
                  </button>
                )
              })}
            </div>
            <div className="game-dialog-actions">
              <button
                onClick={() => { setShowSuiteDialog(false); setSuiteInput(''); setSelectedCard(null) }}
                className="game-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSuiteSubmit}
                disabled={!suiteInput}
                className="game-dialog-confirm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win/Lose Overlay */}
      {gameFinished && (
        <div className="game-overlay">
          <div className="game-result">
            {myPlayer.hand.length === 0 ? (
              <>
                <div className="game-result-icon game-result-win">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
                <h2 className="game-result-title game-result-win-text">Victory!</h2>
                <p className="game-result-sub">You played all your cards</p>
              </>
            ) : (
              <>
                <div className="game-result-icon game-result-lose">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h2 className="game-result-title game-result-lose-text">Defeated</h2>
                <p className="game-result-sub">Better luck next time</p>
              </>
            )}
            <button onClick={onLeave} className="game-result-btn">
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
