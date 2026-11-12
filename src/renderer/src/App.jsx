import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import Timer from './components/Timer'

function App() {
  const [isActive, setIsActive] = useState(false)
  const [isAlarm, setIsAlarm] = useState(false)
  const [isMiniMode, setIsMiniMode] = useState(
    () => window.localStorage.getItem('tempo-mini-mode') === 'true'
  )

  useEffect(() => {
    window.localStorage.setItem('tempo-mini-mode', String(isMiniMode))
    window.api?.setMiniMode?.(isMiniMode)
  }, [isMiniMode])

  const toggleMiniMode = () => setIsMiniMode((current) => !current)

  return (
    <div className="w-screen h-screen min-h-0 p-1 box-border bg-transparent flex flex-col justify-center items-center overflow-hidden">
      <div
        className={`w-full h-full min-h-0 flex flex-col overflow-hidden glass-card ${
          isAlarm || isActive ? 'border-[var(--accent)]/30' : 'border-white/6'
        } ${isMiniMode ? 'mini-card' : ''}`}
      >
        <TopBar
          isActive={isActive}
          isAlarm={isAlarm}
          isMiniMode={isMiniMode}
          onToggleMiniMode={toggleMiniMode}
        />
        <Timer
          isActive={isActive}
          setIsActive={setIsActive}
          isAlarm={isAlarm}
          setIsAlarm={setIsAlarm}
          isMiniMode={isMiniMode}
          onToggleMiniMode={toggleMiniMode}
        />
      </div>
    </div>
  )
}

export default App
