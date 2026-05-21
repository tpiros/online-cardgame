import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { gameApi } from '../lib/game-api'

interface WaitingRoomProps {
  tableId: string
  onGameStart: () => void
  onLeave: () => void
}

export function WaitingRoom({ tableId, onGameStart, onLeave }: WaitingRoomProps) {
  const [playerCount, setPlayerCount] = useState(0)
  const [playerNames, setPlayerNames] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase.from('players').select('name').eq('table_id', tableId)
      if (data) {
        setPlayerCount(data.length)
        setPlayerNames(data.map((p) => p.name))
      }
    }
    fetchPlayers()

    const channel = supabase.channel(`waiting-${tableId}`)
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `table_id=eq.${tableId}` }, () => {
        fetchPlayers()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, (payload) => {
        if (payload.new.status === 'playing') {
          onGameStart()
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, () => {
        onLeave()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tableId, onGameStart, onLeave])

  const handleStart = async () => {
    setStarting(true)
    try {
      await gameApi.startGame(tableId)
      onGameStart()
    } catch (err) {
      console.error(err)
    } finally {
      setStarting(false)
    }
  }

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await gameApi.leaveTable(tableId)
      onLeave()
    } catch (err) {
      console.error(err)
    } finally {
      setLeaving(false)
    }
  }

  const progress = (playerCount / 2) * 100

  return (
    <div className="waiting-page">
      <div className="waiting-card">
        {/* Animated card decoration */}
        <div className="waiting-deco">
          <div className="waiting-deco-card waiting-deco-card-1">
            <span style={{ color: '#dc2626', fontSize: 32 }}>{'\u2665'}</span>
          </div>
          <div className="waiting-deco-card waiting-deco-card-2">
            <span style={{ color: '#1e293b', fontSize: 32 }}>{'\u2660'}</span>
          </div>
          <div className="waiting-deco-card waiting-deco-card-3">
            <span style={{ color: '#dc2626', fontSize: 32 }}>{'\u2666'}</span>
          </div>
        </div>

        <h2 className="waiting-title">Waiting for Players</h2>

        {/* Progress bar */}
        <div className="waiting-progress-track">
          <div
            className="waiting-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="waiting-count">{playerCount}/2 players joined</p>

        {/* Player list */}
        <div className="waiting-players">
          {playerNames.map((name, i) => (
            <div key={i} className="waiting-player" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="waiting-player-avatar">
                {name[0]?.toUpperCase()}
              </div>
              <span className="waiting-player-name">{name}</span>
              <span className="waiting-player-ready">Ready</span>
            </div>
          ))}
          {playerCount < 2 && (
            <div className="waiting-player waiting-player-empty">
              <div className="waiting-player-avatar waiting-player-avatar-empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span className="waiting-player-name" style={{ opacity: 0.4 }}>Waiting...</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="waiting-actions">
          {playerCount >= 2 && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="waiting-start-btn"
            >
              {starting ? (
                <span className="lobby-btn-loading">
                  <span className="auth-spinner" /> Starting...
                </span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Game
                </>
              )}
            </button>
          )}
          <button onClick={handleLeave} disabled={leaving} className="waiting-leave-btn">
            {leaving ? 'Leaving...' : 'Leave Table'}
          </button>
        </div>
      </div>
    </div>
  )
}
