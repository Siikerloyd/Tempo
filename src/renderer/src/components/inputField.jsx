import { ChevronUp, ChevronDown } from 'lucide-react'

function InputField({ label, value, onChange, max = 59 }) {
  const handleInputChange = (e) => {
    const raw = e.target.value
    if (raw === '') {
      onChange(0)
      return
    }

    const parsed = parseInt(raw, 10)
    if (isNaN(parsed)) return

    const clamped = Math.max(0, Math.min(parsed, max))
    onChange(clamped)
  }

  const increment = () => {
    onChange((prev) => (prev >= max ? 0 : prev + 1))
  }

  const decrement = () => {
    onChange((prev) => (prev <= 0 ? max : prev - 1))
  }

  const handleFocus = (e) => {
    e.target.select()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      increment()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      decrement()
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex flex-col items-center bg-white/[0.03] hover:bg-white/[0.06] focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-[var(--accent)] border border-white/[0.08] hover:border-[var(--accent)]/60 rounded-lg px-1.5 py-0.5 transition-all duration-200">
        <button
          type="button"
          onClick={increment}
          aria-label={`Increase ${label}`}
          title={`Increase ${label}`}
          className="text-zinc-300 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 focus-visible:text-[var(--accent)] p-0.5 transition-colors cursor-pointer"
        >
          <ChevronUp className="w-2.5 h-2.5" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value.toString().padStart(2, '0')}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-label={label}
          className="w-9 text-center font-mono text-sm font-bold bg-transparent text-white outline-none selection:bg-[var(--accent)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
        />

        <button
          type="button"
          onClick={decrement}
          aria-label={`Decrease ${label}`}
          title={`Decrease ${label}`}
          className="text-zinc-300 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 focus-visible:text-[var(--accent)] p-0.5 transition-colors cursor-pointer"
        >
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </div>

      <span className="text-[8px] font-semibold text-zinc-300 tracking-wider mt-0.5 uppercase">
        {label}
      </span>
    </div>
  )
}

export default InputField
