import { useState } from 'react'
import { Minus, X, Pin, PinOff } from 'lucide-react'
import logo from '../assets/logo.svg'

function TopBar({ isActive, isAlarm }) {
  const [isPinned, setIsPinned] = useState(true)

  const handleMinimize = () => {
    window.electron?.ipcRenderer?.send('minimize-window')
  }

  const handleClose = () => {
    window.electron?.ipcRenderer?.send('close-window')
  }

  const handleTogglePin = async () => {
    if (window.electron?.ipcRenderer?.invoke) {
      try {
        const pinned = await window.electron.ipcRenderer.invoke('toggle-always-on-top')
        setIsPinned(pinned)
      } catch {
        setIsPinned(!isPinned)
      }
    } else {
      setIsPinned(!isPinned)
    }
  }

  return (
    <div
      className="w-full h-8 shrink-0 px-3 flex items-center justify-between border-b border-white/6 bg-transparent select-none cursor-grab active:cursor-grabbing"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Brand & Status */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center">
          <img
            src={logo}
            alt=""
            className={`w-3.5 h-3.5 transition-all duration-300 ${
              isAlarm ? 'animate-bounce' : ''
            }`}
          />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
        </div>
        <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
          Tempo
        </span>
      </div>

      {/* Control Buttons */}
      <div
        className="flex items-center gap-1 cursor-default"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={handleTogglePin}
          aria-label={isPinned ? 'Unpin from top' : 'Keep on top'}
          data-tip={isPinned ? 'UNPIN' : 'PIN ON TOP'}
          className={`w-5 h-5 rounded flex items-center justify-center cursor-pointer focus-visible:outline-none transition-colors duration-150 ${
            isPinned
              ? 'border-2 border-[#FF4D00] bg-[#FF4D00] text-black'
              : 'text-zinc-600 border-2 border-zinc-600 bg-white hover:border-[#FF4D00] hover:text-[#FF4D00]'
          }`}
        >
          {isPinned ? <Pin className="w-3 h-3 rotate-45" /> : <PinOff className="w-3 h-3" />}
        </button>

        <button
          onClick={handleMinimize}
          aria-label="Minimize"
          className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 border-2 border-zinc-600 bg-white hover:border-[#FF4D00] hover:text-[#FF4D00] cursor-pointer focus-visible:outline-none transition-colors duration-150"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          onClick={handleClose}
          aria-label="Close"
          className="w-5 h-5 rounded flex items-center justify-center text-zinc-600 border-2 border-zinc-600 bg-white hover:border-[#FF4D00] hover:text-[#FF4D00] cursor-pointer focus-visible:outline-none transition-colors duration-150"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export default TopBar
