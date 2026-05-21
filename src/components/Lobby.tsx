import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { gameApi } from '../lib/game-api'
import { useAuth } from '../hooks/useAuth'

interface TableInfo {
  id: string
  name: string
  status: string
  player_limit: number
  created_at: string
}

interface LobbyProps {
  onJoinTable: (tableId: string) => void
}

export function Lobby({ onJoinTable }: LobbyProps) {
  const { user, signOut } = useAuth()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [tableName, setTableName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTables()
    const channel = supabase.channel('lobby')
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('created_at', { ascending: false })
    setTables(data || [])
    setLoading(false)
  }

  const createTable = async () => {
    setCreating(true)
    setError(null)
    try {
      const result = await gameApi.createTable(tableName || 'Game Table')
      await joinTable(result.table.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  const joinTable = async (tableId: string) => {
    setJoining(tableId)
    setError(null)
    try {
      await gameApi.joinTable(tableId)
      onJoinTable(tableId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join table')
    } finally {
      setJoining(null)
    }
  }

  const playerName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Player'

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    available: { label: 'Open', color: 'lobby-status-open', dot: 'lobby-dot-open' },
    unavailable: { label: 'Full', color: 'lobby-status-full', dot: 'lobby-dot-full' },
    playing: { label: 'In Progress', color: 'lobby-status-playing', dot: 'lobby-dot-playing' },
  }

  return (
    <div className="lobby-page">
      {/* Header */}
      <header className="lobby-header">
        <div className="lobby-header-left">
          <div className="lobby-brand">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M7 8h2v8H7V8zm4-3h2v14h-2V5zm4 5h2v9h-2v-9z" fill="#10b981" />
            </svg>
            <span className="lobby-brand-text">Macaonline</span>
          </div>
        </div>
        <div className="lobby-header-right">
          <div className="lobby-user-badge">
            <div className="lobby-user-avatar">{playerName[0]?.toUpperCase()}</div>
            <span className="lobby-user-name">{playerName}</span>
          </div>
          <button onClick={signOut} className="lobby-signout-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="lobby-main">
        {/* Create Table Section */}
        <section className="lobby-create">
          <div className="lobby-create-card">
            <div className="lobby-create-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h2 className="lobby-create-title">Create a Table</h2>
            </div>
            <div className="lobby-create-form">
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Table name (optional)"
                className="lobby-input"
                onKeyDown={(e) => e.key === 'Enter' && createTable()}
              />
              <button
                onClick={createTable}
                disabled={creating}
                className="lobby-create-btn"
              >
                {creating ? (
                  <span className="lobby-btn-loading">
                    <span className="auth-spinner" /> Creating...
                  </span>
                ) : 'Create Table'}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="lobby-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Tables List */}
        <section className="lobby-tables">
          <div className="lobby-tables-header">
            <h2 className="lobby-tables-title">Game Tables</h2>
            <span className="lobby-tables-count">{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="lobby-empty">
              <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
              <p>Loading tables...</p>
            </div>
          ) : tables.length === 0 ? (
            <div className="lobby-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <rect x="2" y="4" width="20" height="16" rx="2" />
              </svg>
              <p>No tables yet</p>
              <p className="lobby-empty-sub">Create one to start playing!</p>
            </div>
          ) : (
            <div className="lobby-table-grid">
              {tables.map((table) => {
                const cfg = statusConfig[table.status] || statusConfig.available
                const canJoin = table.status === 'available'
                return (
                  <div key={table.id} className={`lobby-table-card ${canJoin ? 'lobby-table-joinable' : ''}`}>
                    <div className="lobby-table-card-top">
                      <div className="lobby-table-icon">
                        {table.name[0]?.toUpperCase()}
                      </div>
                      <div className="lobby-table-info">
                        <h3 className="lobby-table-name">{table.name}</h3>
                        <div className={`lobby-status ${cfg.color}`}>
                          <span className={`lobby-status-dot ${cfg.dot}`} />
                          {cfg.label}
                        </div>
                      </div>
                    </div>
                    <div className="lobby-table-card-bottom">
                      <div className="lobby-table-players">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>0 / {table.player_limit}</span>
                      </div>
                      <button
                        onClick={() => joinTable(table.id)}
                        disabled={joining === table.id || !canJoin}
                        className="lobby-join-btn"
                      >
                        {joining === table.id ? (
                          <span className="auth-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        ) : canJoin ? 'Join' : '---'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
