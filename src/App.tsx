import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/AuthForm'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'
import { GameBoard } from './components/GameBoard'

type View = 'lobby' | 'waiting' | 'playing'

export default function App() {
  const { user, loading } = useAuth()
  const [view, setView] = useState<View>('lobby')
  const [tableId, setTableId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="text-white text-lg animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  const handleJoinTable = (id: string) => {
    setTableId(id)
    setView('waiting')
  }

  const handleGameStart = () => {
    setView('playing')
  }

  const handleLeave = () => {
    setTableId(null)
    setView('lobby')
  }

  switch (view) {
    case 'lobby':
      return <Lobby onJoinTable={handleJoinTable} />
    case 'waiting':
      return tableId ? (
        <WaitingRoom tableId={tableId} onGameStart={handleGameStart} onLeave={handleLeave} />
      ) : null
    case 'playing':
      return tableId ? (
        <GameBoard tableId={tableId} onLeave={handleLeave} />
      ) : null
  }
}
