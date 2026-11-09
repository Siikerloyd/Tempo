import { useState, useEffect, useRef, useCallback } from 'react'
import InputField from './inputField'
import Alarm from '../assets/audio/Alarm.mp3'
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Check,
  X,
  BellRing,
  Music,
  Flame
} from 'lucide-react'

function Timer({ isActive, setIsActive, isAlarm, setIsAlarm }) {
  const [isEditing, setIsEditing] = useState(false)

  // Mode: focus | break | long
  const [mode, setMode] = useState('focus')

  // Stored configured time in editing mode
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(25)
  const [seconds, setSeconds] = useState(0)

  // Countdown state in seconds
  const [totalSeconds, setTotalSeconds] = useState(25 * 60)
  const [initialSeconds, setInitialSeconds] = useState(25 * 60)
  const [isMuted, setIsMuted] = useState(false)
  const [alarmAudio, setAlarmAudio] = useState(null)
  const [isChoosingAudio, setIsChoosingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [microcopyIndex, setMicrocopyIndex] = useState(0)
  const [isGlitching, setIsGlitching] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [streak, setStreak] = useState(0)
  const [prevTime, setPrevTime] = useState('')

  const audioRef = useRef(null)
  const previewAudioRef = useRef(null)
  const previewTimeoutRef = useRef(null)
  const beepIntervalRef = useRef(null)
  const beepTimeoutRef = useRef(null)
  const audioCtxRef = useRef(null)

  // Helper to play a short test/preview tone
  const playTone = (freq = 880, duration = 0.2) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Ignore if audio context unavailable
    }
  }



  // Synthesized fallback alarm (creative pattern if MP3 fails)
  const startSynthesizedAlarm = useCallback(() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const playAlarmPattern = () => {
      const now = ctx.currentTime

      // Create a more interesting alarm pattern
      const frequencies = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      const durations = [0.15, 0.15, 0.15, 0.3]

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = i % 2 === 0 ? 'square' : 'sawtooth'
        osc.frequency.setValueAtTime(freq, now + i * 0.2)

        gain.gain.setValueAtTime(0, now + i * 0.2)
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.2 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + durations[i])

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + i * 0.2)
        osc.stop(now + i * 0.2 + durations[i] + 0.1)

        osc.onended = () => {
          osc.disconnect()
          gain.disconnect()
        }
      })
    }

    playAlarmPattern()
    clearInterval(beepIntervalRef.current)
    beepIntervalRef.current = setInterval(playAlarmPattern, 1200)
  }, [])

  const stopSynthesizedAlarm = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current)
      beepIntervalRef.current = null
    }
    if (beepTimeoutRef.current) {
      clearTimeout(beepTimeoutRef.current)
      beepTimeoutRef.current = null
    }
  }, [])

  const stopPreviewSound = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
      previewAudioRef.current = null
    }
  }, [])

  const initializeAlarmAudio = useCallback((audioUrl) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = audioUrl
      audioRef.current.load()
      return
    }

    const audio = new Audio(audioUrl)
    audio.loop = true
    audio.preload = 'metadata'
    audioRef.current = audio
  }, [])

  const startAlarmSound = useCallback(() => {
    if (isMuted) return

    // Try MP3 first, fall back to synthesized
    let mp3Playing = false
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            mp3Playing = true
          })
          .catch((err) => {
            console.warn('MP3 playback failed, switching to synthesized alarm:', err)
            startSynthesizedAlarm()
          })
      }
    } else {
      startSynthesizedAlarm()
    }
  }, [isMuted, startSynthesizedAlarm])

  const stopAlarmSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    stopPreviewSound()
    stopSynthesizedAlarm()
  }, [stopPreviewSound, stopSynthesizedAlarm])

  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (nextMuted) {
      stopAlarmSound()
    } else {
      // Play a friendly confirmation chirp
      playTone(1050, 0.15)
    }
  }, [isMuted, stopAlarmSound])

  const previewAlarmSound = useCallback(
    (audioUrl) => {
      stopPreviewSound()

      const preview = new Audio(audioUrl)
      preview.loop = false
      preview.volume = 0.7
      previewAudioRef.current = preview

      preview
        .play()
        .then(() => {
          previewTimeoutRef.current = setTimeout(stopPreviewSound, 2500)
        })
        .catch((error) => {
          console.warn('Alarm audio preview failed:', error)
          stopPreviewSound()
        })
    },
    [stopPreviewSound]
  )

  const handleChooseAlarmAudio = async () => {
    if (isChoosingAudio) return

    setIsChoosingAudio(true)
    setAudioError('')

    try {
      const result = await window.api?.chooseAlarmAudio?.()
      if (result?.canceled) return

      if (result?.error) {
        setAudioError(result.error)
        return
      }

      if (!result?.audioUrl) return

      const nextAudio = {
        fileName: result.fileName || 'Custom alarm sound'
      }

      setAlarmAudio(nextAudio)
      initializeAlarmAudio(result.audioUrl)
      stopAlarmSound()
      previewAlarmSound(result.audioUrl)
    } catch (error) {
      console.warn('Could not choose alarm audio:', error)
      setAudioError('Could not choose an alarm sound.')
    } finally {
      setIsChoosingAudio(false)
    }
  }

  const handleResetAlarmAudio = async () => {
    setAudioError('')

    try {
      await window.api?.resetAlarmAudio?.()
      setAlarmAudio(null)
      initializeAlarmAudio(Alarm)
      previewAlarmSound(Alarm)
    } catch (error) {
      console.warn('Could not reset alarm audio:', error)
      setAudioError('Could not reset the alarm sound.')
    }
  }

  // Load the saved alarm sound, falling back to the default alarm.
  useEffect(() => {
    let isCurrent = true

    const loadSavedAudio = async () => {
      try {
        const savedAudio = await window.api?.getAlarmAudio?.()
        if (!isCurrent) return

        if (savedAudio?.audioUrl) {
          setAlarmAudio(savedAudio)
          initializeAlarmAudio(savedAudio.audioUrl)
        } else {
          initializeAlarmAudio(Alarm)
        }
      } catch (error) {
        console.warn('Could not load the saved alarm audio:', error)
        if (isCurrent) {
          setAudioError('Using the default alarm sound.')
          initializeAlarmAudio(Alarm)
        }
      }
    }

    loadSavedAudio()

    return () => {
      isCurrent = false
      stopAlarmSound()
      stopPreviewSound()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
      audioCtxRef.current = null
    }
  }, [initializeAlarmAudio, stopAlarmSound, stopPreviewSound])

  useEffect(() => {
    window.api?.setBackgroundThrottling?.(!(isActive || isAlarm))
  }, [isActive, isAlarm])

  // Load streak from localStorage on mount
  useEffect(() => {
    const today = new Date().toDateString()
    const savedStreak = localStorage.getItem('tempo-daily-streak')
    const savedDate = localStorage.getItem('tempo-daily-streak-date')

    if (savedStreak && savedDate) {
      if (savedDate === today) {
        setStreak(parseInt(savedStreak, 10))
      } else {
        // New day, reset streak
        setStreak(0)
        localStorage.setItem('tempo-daily-streak', '0')
        localStorage.setItem('tempo-daily-streak-date', today)
      }
    } else {
      localStorage.setItem('tempo-daily-streak', '0')
      localStorage.setItem('tempo-daily-streak-date', today)
    }
  }, [])

  // Countdown interval
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(() => {
      setTotalSeconds((prev) => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive])

  // Trigger alarm when timer hits 0
  useEffect(() => {
    if (isActive && totalSeconds === 0) {
      setIsActive(false)
      setIsAlarm(true)

      // Handle mode switching
      if (mode === 'focus') {
        const newCompleted = (completedSessions + 1) % 5
        setCompletedSessions(newCompleted)

        // Increment streak for completed focus session
        const today = new Date().toDateString()
        const newStreak = streak + 1
        setStreak(newStreak)
        localStorage.setItem('tempo-daily-streak', newStreak.toString())
        localStorage.setItem('tempo-daily-streak-date', today)

        // After 4th focus session, switch to long break; otherwise short break
        if (newCompleted === 0) {
          setMode('long')
        } else {
          setMode('break')
        }
      } else {
        // After break/long break, return to focus
        setMode('focus')
      }

      setIsGlitching(true)
      setTimeout(() => setIsGlitching(false), 200)
      startAlarmSound()
    }
  }, [isActive, totalSeconds, setIsActive, setIsAlarm, startAlarmSound, mode, completedSessions, streak])

  // Helpers to format seconds into HH:MM:SS
  const curHours = Math.floor(totalSeconds / 3600)
  const curMinutes = Math.floor((totalSeconds % 3600) / 60)
  const curSeconds = totalSeconds % 60

  // Remaining time for the bottom track and the countdown ring
  const progressPercent = initialSeconds > 0 ? (totalSeconds / initialSeconds) * 100 : 0

  // Energy level (0 to 1) for glow effect
  const energyLevel = isActive ? 1 - (totalSeconds / initialSeconds) : 0

  // Determine if in final minute (urgent state)
  const isUrgent = isActive && totalSeconds > 0 && totalSeconds <= 60

  // Format time for rolling animation
  const timeString = `${curHours.toString().padStart(2, '0')}:${curMinutes.toString().padStart(2, '0')}:${curSeconds.toString().padStart(2, '0')}`

  // Track previous time for animation
  useEffect(() => {
    setPrevTime(timeString)
  }, [timeString])

  // Microcopy rotation
  const microcopyLines = {
    idle: ['READY WHEN YOU ARE.', 'PICK A TASK.'],
    paused: ['PAUSED', 'HOLDING.', 'BREATHE.'],
    running: {
      focus: ['IN THE ZONE', 'LOCKED IN.', 'KEEP GOING.'],
      break: ['RECHARGE.', 'LOOK AWAY.', 'STRETCH.'],
      long: ['DEEP REST.', 'RELAX.', 'CLEAR MIND.']
    },
    final: ['ALMOST.', 'FINISH STRONG.'],
    done: ['DONE. NICE.', 'SESSION COMPLETE']
  }

  const getCurrentMicrocopy = () => {
    if (isAlarm) return microcopyLines.done[microcopyIndex % microcopyLines.done.length]
    if (isUrgent) return microcopyLines.final[microcopyIndex % microcopyLines.final.length]
    if (isActive) {
      const modeLines = microcopyLines.running[mode] || microcopyLines.running.focus
      return modeLines[microcopyIndex % modeLines.length]
    }
    if (totalSeconds === 0) return microcopyLines.idle[microcopyIndex % microcopyLines.idle.length]
    return microcopyLines.paused[microcopyIndex % microcopyLines.paused.length]
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setMicrocopyIndex((prev) => prev + 1)
    }, 10000) // Rotate every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleStart = () => {
    // Prime the audio on user gesture
    if (audioRef.current) {
      audioRef.current.load()
    }

    // Trigger glitch effect
    setIsGlitching(true)
    setTimeout(() => setIsGlitching(false), 200)

    if (totalSeconds === 0) {
      // Set duration based on mode if not manually configured
      let configuredTotal = hours * 3600 + minutes * 60 + seconds
      if (configuredTotal === 0) {
        if (mode === 'focus') {
          configuredTotal = 25 * 60
        } else if (mode === 'break') {
          configuredTotal = 5 * 60
        } else if (mode === 'long') {
          configuredTotal = 15 * 60
        }
        setTotalSeconds(configuredTotal)
        setInitialSeconds(configuredTotal)
      } else {
        setTotalSeconds(configuredTotal)
        setInitialSeconds(configuredTotal)
      }
    }
    stopAlarmSound()
    setIsAlarm(false)
    setIsActive(true)
  }

  const handlePause = () => {
    setIsGlitching(true)
    setTimeout(() => setIsGlitching(false), 200)
    setIsActive(false)
  }

  const handleReset = () => {
    setIsActive(false)
    setIsAlarm(false)
    stopAlarmSound()
    setTotalSeconds(initialSeconds)
  }

  const handleOpenEdit = () => {
    setIsActive(false)
    setIsAlarm(false)
    stopAlarmSound()
    setHours(Math.floor(totalSeconds / 3600))
    setMinutes(Math.floor((totalSeconds % 3600) / 60))
    setSeconds(totalSeconds % 60)
    setIsEditing(true)
  }

  const handleSaveEdit = (startImmediately = false) => {
    const total = hours * 3600 + minutes * 60 + seconds
    if (total > 0) {
      setTotalSeconds(total)
      setInitialSeconds(total)
      setIsEditing(false)
      setIsAlarm(false)
      stopAlarmSound()
      if (startImmediately) {
        setIsActive(true)
      }
    }
  }

  const handleApplyPreset = (m, h = 0, s = 0) => {
    if (audioRef.current) {
      audioRef.current.load()
    }
    setHours(h)
    setMinutes(m)
    setSeconds(s)
    const total = h * 3600 + m * 60 + s
    setTotalSeconds(total)
    setInitialSeconds(total)
    setMode('focus')
    setIsEditing(false)
    setIsAlarm(false)
    stopAlarmSound()
    setIsActive(true)
  }

  const handleSetMode = (newMode) => {
    setMode(newMode)
    if (newMode === 'focus') {
      setMinutes(25)
      setSeconds(0)
      setHours(0)
    } else if (newMode === 'break') {
      setMinutes(5)
      setSeconds(0)
      setHours(0)
    } else if (newMode === 'long') {
      setMinutes(15)
      setSeconds(0)
      setHours(0)
    }
  }

  const handleDismissAlarm = () => {
    setIsAlarm(false)
    stopAlarmSound()
    setTotalSeconds(initialSeconds)
  }



  // ===== Circular Progress Ring SVG =====
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const remainingOffset = circumference - (progressPercent / 100) * circumference

  const renderProgressRing = () => {
    const totalMinutes = Math.max(1, Math.round(initialSeconds / 60))
    const elapsedMinutes = Math.floor((initialSeconds - totalSeconds) / 60)

    const ticks = Array.from({ length: totalMinutes }, (_, i) => {
      const angle = (360 / totalMinutes) * i
      const isElapsed = i < elapsedMinutes
      return (
        <line
          key={i}
          className={`tick ${isElapsed ? 'elapsed' : ''}`}
          x1="60"
          y1="2"
          x2="60"
          y2="6"
          transform={`rotate(${angle} 60 60)`}
          data-i={i}
        />
      )
    })

    return (
      <svg
        className={`pointer-events-none absolute inset-0 h-full w-full ${isUrgent ? 'urgent' : ''}`}
        viewBox="0 0 120 120"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--track)" strokeWidth="2.5" />
        {ticks}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={remainingOffset}
          strokeLinecap="butt"
          transform="rotate(-90 60 60)"
          className={`progress-ring__circle ${isAlarm ? 'finish-flash' : ''}`}
          style={{ '--energy': energyLevel }}
        />
      </svg>
    )
  }

  // ===== Sound Wave Animation (when alarm is active) =====
  const renderSoundWave = () => (
    <div className="sound-wave">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="sound-wave__bar" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  )

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col justify-between border-x-2 border-black bg-[var(--panel)] px-3 py-1 pb-2.5 overflow-hidden"
      data-mode={mode}
      data-state={isActive ? 'running' : totalSeconds === 0 ? 'idle' : 'paused'}
    >
      {isAlarm ? (
        // ===== ALARM ACTIVE STATE =====
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 overflow-hidden">
          <div className="relative flex items-center justify-center">
            <BellRing className="w-8 h-8 text-[var(--accent)] animate-bounce" />
            <span className="absolute -inset-2 border-2 border-[var(--accent)] animate-ping" />
          </div>

          <h2 className="border-x-4 border-[var(--accent)] px-3 text-2xl font-black text-white tracking-[0.2em] uppercase">
            Time's Up!
          </h2>

          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Session complete
          </p>

          {renderSoundWave()}

          <button
            onClick={handleDismissAlarm}
            className="btn accent-btn mt-0.5 shrink-0 border-2 border-black px-6 py-2 bg-[var(--accent)] text-black font-black text-sm uppercase tracking-widest cursor-pointer"
          >
            Dismiss Alarm
          </button>
        </div>
      ) : isEditing ? (
        // ===== EDIT / SETUP MODE =====
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 overflow-hidden pt-0 pb-8">
          {/* Time Inputs */}
          <div className="flex items-start justify-center gap-1 shrink-0">
            <InputField label="hr" value={hours} onChange={setHours} max={99} />
            <span className="flex h-12 items-center text-sm font-black leading-none text-[var(--accent)]" aria-hidden="true">
              :
            </span>
            <InputField label="min" value={minutes} onChange={setMinutes} max={59} />
            <span className="flex h-12 items-center text-sm font-black leading-none text-[var(--accent)]" aria-hidden="true">
              :
            </span>
            <InputField label="sec" value={seconds} onChange={setSeconds} max={59} />
          </div>

          {/* Mode Buttons */}
          <div className="flex items-center justify-center gap-1 shrink-0">
            {[
              { label: 'FOCUS', mode: 'focus' },
              { label: 'BREAK', mode: 'break' },
              { label: 'LONG', mode: 'long' }
            ].map((modeBtn) => (
              <button
                key={modeBtn.mode}
                type="button"
                onClick={() => handleSetMode(modeBtn.mode)}
                className={`btn border-2 border-black px-2 py-0.5 font-mono text-[9px] font-bold uppercase cursor-pointer ${
                  mode === modeBtn.mode
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-white text-black'
                }`}
              >
                {modeBtn.label}
              </button>
            ))}
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center justify-center gap-1 shrink-0">
            {[
              { label: '5m', min: 5 },
              { label: '15m', min: 15 },
              { label: '25m', min: 25 },
              { label: '45m', min: 45 },
              { label: '1h', min: 0, hr: 1 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset.min, preset.hr || 0)}
                className="btn border-2 border-black px-2 py-0.5 bg-white text-black font-mono text-[9px] font-bold uppercase cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Sound Controls - Compact */}
          <div className="flex flex-col items-center gap-0.5 min-h-0 shrink-0">
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={handleChooseAlarmAudio}
                disabled={isChoosingAudio}
                className="btn flex items-center gap-1 border-2 border-black px-2 py-0.5 bg-white text-black font-mono text-[9px] font-bold uppercase cursor-pointer disabled:opacity-50"
              >
                {isChoosingAudio ? (
                  <span className="h-2.5 w-2.5 border-2 border-black border-r-[var(--accent)] animate-spin" />
                ) : (
                  <Music className="w-3 h-3" />
                )}
                <span className="truncate max-w-[120px]">
                  {alarmAudio ? alarmAudio.fileName : 'Choose sound'}
                </span>
              </button>

              {alarmAudio && (
                <button
                  onClick={handleResetAlarmAudio}
                  aria-label="Reset to default alarm sound"
                  className="btn flex items-center justify-center w-6 h-6 border-2 border-black bg-white text-black cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            {audioError && (
              <p className="px-1 text-center font-mono text-[8px] font-bold text-[var(--accent)] uppercase">
                {audioError}
              </p>
            )}

            {!audioError && (
              <p className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-wider">
                {alarmAudio ? `Sound: ${alarmAudio.fileName}` : 'Default alarm sound'}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <button
              onClick={() => setIsEditing(false)}
              className="btn flex items-center gap-1 border-2 border-black px-3 py-0.5 bg-black text-white font-mono text-[9px] font-bold uppercase cursor-pointer"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>

            <button
              onClick={() => handleSaveEdit(true)}
              className="btn accent-btn flex items-center gap-1.5 border-2 border-black px-4 py-0.5 bg-[var(--accent)] text-black font-mono text-[9px] font-black uppercase cursor-pointer"
            >
              <Check className="w-3 h-3" />
              Start
            </button>
          </div>
        </div>
      ) : (
        // ===== COUNTDOWN VIEW =====
        <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          {/* Timer Display with Circular Progress Ring */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center border-2 border-white/20 bg-[var(--bg)] px-2 py-1 overflow-hidden">
            <div className="relative aspect-square h-[94%] max-h-full">
              {renderProgressRing()}

              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6">
                <div
                  className={`font-mono text-[1.7rem] font-black leading-none tracking-tight tabular-nums transition-all duration-300 ${
                    isActive ? 'text-[var(--accent)]' : totalSeconds === 0 ? 'text-zinc-600' : 'text-[var(--text)]'
                  } ${isGlitching ? 'glitch' : ''}`}
                >
                  {timeString.split('').map((char, i) => {
                    const changed = prevTime[i] !== char && prevTime !== ''
                    const isColon = char === ':'
                    return (
                      <span
                        key={i}
                        className={`inline-block overflow-hidden ${changed && !isColon ? 'animate-slide' : ''}`}
                      >
                        {char}
                      </span>
                    )
                  })}
                </div>

                {/* Status Label */}
                <span
                  className={`mt-1 font-mono text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                    audioError
                      ? 'text-[var(--accent)]'
                      : isActive
                        ? 'text-[var(--accent)]'
                        : totalSeconds === 0
                          ? 'text-zinc-600'
                          : 'text-[var(--text)]'
                  }`}
                >
                  {audioError || getCurrentMicrocopy()}
                </span>

                {/* Session Dots */}
                <div className="mt-2 flex gap-1.5 justify-center">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 border-2 ${
                        i < completedSessions
                          ? 'bg-[var(--accent)] border-[var(--accent)]'
                          : 'border-[var(--accent)]'
                      }`}
                    />
                  ))}
                </div>

                {/* Streak Counter */}
                {streak > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    <Flame className="w-2.5 h-2.5 text-[var(--accent)]" />
                    <span className="text-white">{streak}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Control Dock */}
          <div className="mt-1 mb-1 grid w-full shrink-0 grid-cols-5 items-center justify-items-center px-2">
            {/* Edit */}
            <button
              onClick={handleOpenEdit}
              aria-label="Edit duration"
              data-tip="SETTINGS"
              className="btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Sound */}
            <button
              onClick={handleChooseAlarmAudio}
              aria-label={
                alarmAudio ? `Change alarm sound: ${alarmAudio.fileName}` : 'Change alarm sound'
              }
              data-tip="MUSIC"
              disabled={isChoosingAudio}
              className={`btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer disabled:opacity-50 ${
                alarmAudio ? 'text-[var(--accent)]' : 'text-black'
              }`}
            >
              {isChoosingAudio ? (
                <span className="h-3.5 w-3.5 rounded-none border-2 border-black border-r-[var(--accent)] animate-spin" />
              ) : (
                <Music className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Play / Pause Primary CTA */}
            <button
              onClick={isActive ? handlePause : handleStart}
              aria-label={isActive ? 'Pause' : 'Start'}
              data-tip={isActive ? 'PAUSE' : 'START'}
              className="btn accent-btn flex h-11 w-11 items-center justify-center border-2 border-black bg-[var(--accent)] text-black cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" data-state={isActive ? 'running' : 'paused'}>
                <polygon className="tri" points="7,4 20,12 7,20" fill="currentColor" />
                <rect className="bar l" x="6" y="4" width="4" height="16" fill="currentColor" />
                <rect className="bar r" x="14" y="4" width="4" height="16" fill="currentColor" />
              </svg>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              aria-label="Reset timer"
              data-tip="RESET"
              className="btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Mute */}
            <button
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute alarm' : 'Mute alarm'}
              data-tip={isMuted ? 'UNMUTE' : 'MUTE'}
              className={`btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer ${
                isMuted ? 'opacity-50' : ''
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Progress Track at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-2 border-t-2 border-black bg-white/15 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isAlarm ? 'bg-[var(--accent)] animate-pulse' : isActive ? 'bg-[var(--accent)]' : 'bg-zinc-600'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
        />
      </div>
    </div>
  )
}

export default Timer
