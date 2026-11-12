import { useState, useEffect, useRef, useCallback } from 'react'
import InputField from './inputField'
import Alarm from '../assets/audio/Alarm.mp3'
import {
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Check,
  X,
  BellRing,
  Music,
  Flame,
  SkipForward,
  Play,
  Pause,
  ChartNoAxesColumn,
  ChevronLeft
} from 'lucide-react'

const MODE_DEFAULTS = {
  focus: { hours: 0, minutes: 25, seconds: 0 },
  break: { hours: 0, minutes: 5, seconds: 0 },
  long: { hours: 0, minutes: 15, seconds: 0 }
}

const getLocalDateKey = () => {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const getRecentDateKeys = (today = getLocalDateKey()) => {
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return Array.from({ length: 7 }, (_, index) => {
    const recentDate = new Date(date)
    recentDate.setDate(date.getDate() - (6 - index))
    const recentMonth = String(recentDate.getMonth() + 1).padStart(2, '0')
    const recentDay = String(recentDate.getDate()).padStart(2, '0')
    return `${recentDate.getFullYear()}-${recentMonth}-${recentDay}`
  })
}

const pruneDailyHistory = (history, today = getLocalDateKey()) => {
  const recentDates = new Set(getRecentDateKeys(today))
  const records = new Map()

  for (const record of history) {
    if (!record || !recentDates.has(record.date)) continue
    records.set(record.date, {
      date: record.date,
      sessions: Number.isSafeInteger(record.sessions) ? Math.max(0, record.sessions) : 0,
      focusSeconds: Number.isSafeInteger(record.focusSeconds) ? Math.max(0, record.focusSeconds) : 0
    })
  }

  return [...records.values()].sort((first, second) => first.date.localeCompare(second.date))
}

const emptyDailyStats = (date = getLocalDateKey(), history = []) => ({
  date,
  sessions: 0,
  focusSeconds: 0,
  currentStreak: 0,
  lastFocusDate: null,
  history: pruneDailyHistory(history, date)
})

const loadCycleCount = () => {
  const count = Number(window.localStorage.getItem('tempo-focus-cycle') || '0')
  return Number.isInteger(count) ? Math.max(0, Math.min(4, count)) : 0
}

const loadDailyStats = () => {
  const today = getLocalDateKey()
  const savedStats = window.localStorage.getItem('tempo-daily-stats')

  if (savedStats) {
    try {
      const parsed = JSON.parse(savedStats)
      const history = pruneDailyHistory(
        [...(Array.isArray(parsed.history) ? parsed.history : []), parsed],
        today
      )
      const todayRecord = history.find((record) => record.date === today) || {
        date: today,
        sessions: 0,
        focusSeconds: 0
      }

      return {
        ...todayRecord,
        currentStreak:
          Number.isSafeInteger(parsed.currentStreak) && parsed.currentStreak > 0
            ? parsed.currentStreak
            : 0,
        lastFocusDate: typeof parsed.lastFocusDate === 'string' ? parsed.lastFocusDate : null,
        history
      }
    } catch {
      return emptyDailyStats(today)
    }
  }

  const legacyDate = window.localStorage.getItem('tempo-daily-streak-date')
  const legacySessions = Number.parseInt(
    window.localStorage.getItem('tempo-daily-streak') || '0',
    10
  )
  const legacyIsToday =
    legacyDate === today ||
    (legacyDate && new Date(legacyDate).toDateString() === new Date().toDateString())

  if (!legacyIsToday) return emptyDailyStats(today)

  const legacyRecord = {
    date: today,
    sessions: Number.isFinite(legacySessions) ? Math.max(0, legacySessions) : 0,
    focusSeconds: 0
  }
  return {
    ...legacyRecord,
    currentStreak: 0,
    lastFocusDate: null,
    history: pruneDailyHistory([legacyRecord], today)
  }
}

function Timer({ isActive, setIsActive, isAlarm, setIsAlarm, isMiniMode, onToggleMiniMode }) {
  const [isEditing, setIsEditing] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

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
  const [completedSessions, setCompletedSessions] = useState(loadCycleCount)
  const [dailyStats, setDailyStats] = useState(loadDailyStats)
  const [isShowingStats, setIsShowingStats] = useState(false)
  const [nextMode, setNextMode] = useState(null)
  const [autoStartNext, setAutoStartNext] = useState(
    () => window.localStorage.getItem('tempo-auto-start-next') === 'true'
  )

  const audioRef = useRef(null)
  const previewAudioRef = useRef(null)
  const previewTimeoutRef = useRef(null)
  const beepIntervalRef = useRef(null)
  const beepTimeoutRef = useRef(null)
  const audioCtxRef = useRef(null)
  const timerDeadlineRef = useRef(null)
  const autoStartTimeoutRef = useRef(null)
  const editingModeRef = useRef(mode)
  const statsTriggerRef = useRef(null)
  const totalSecondsRef = useRef(totalSeconds)
  totalSecondsRef.current = totalSeconds

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
      const frequencies = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
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

  const beginPhase = useCallback(
    (phase) => {
      const duration = MODE_DEFAULTS[phase]
      if (!duration) return

      clearTimeout(autoStartTimeoutRef.current)
      autoStartTimeoutRef.current = null
      const total = duration.hours * 3600 + duration.minutes * 60 + duration.seconds
      setMode(phase)
      setHours(duration.hours)
      setMinutes(duration.minutes)
      setSeconds(duration.seconds)
      setTotalSeconds(total)
      setInitialSeconds(total)
      setNextMode(null)
      setHasStarted(true)
      setIsAlarm(false)
      stopAlarmSound()
      setIsActive(true)
    },
    [setIsActive, setIsAlarm, stopAlarmSound]
  )

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

  useEffect(() => {
    window.localStorage.setItem('tempo-auto-start-next', String(autoStartNext))
  }, [autoStartNext])

  useEffect(() => () => clearTimeout(autoStartTimeoutRef.current), [])

  useEffect(() => {
    window.localStorage.setItem('tempo-daily-stats', JSON.stringify(dailyStats))
  }, [dailyStats])

  useEffect(() => {
    window.localStorage.setItem('tempo-focus-cycle', String(completedSessions))
  }, [completedSessions])

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    const timeout = setTimeout(
      () => {
        setDailyStats((previous) => ({
          ...emptyDailyStats(getLocalDateKey(), previous.history),
          currentStreak: previous.currentStreak,
          lastFocusDate: previous.lastFocusDate
        }))
      },
      nextMidnight - now.getTime() + 50
    )

    return () => clearTimeout(timeout)
  }, [dailyStats.date])

  // Countdown interval
  useEffect(() => {
    if (!isActive) return

    const deadline = Date.now() + totalSecondsRef.current * 1000
    timerDeadlineRef.current = deadline

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setTotalSeconds((current) => (current === remaining ? current : remaining))
    }, 200)

    return () => {
      clearInterval(interval)
      timerDeadlineRef.current = null
    }
  }, [isActive])

  // Trigger alarm when timer hits 0
  useEffect(() => {
    if (isActive && totalSeconds === 0) {
      setIsActive(false)
      setIsAlarm(true)

      let suggestedMode
      // Handle mode switching
      if (mode === 'focus') {
        const newCompleted = Math.min(4, completedSessions + 1)
        setCompletedSessions(newCompleted)
        suggestedMode = newCompleted === 4 ? 'long' : 'break'

        // Increment streak for completed focus session
        const today = getLocalDateKey()
        setDailyStats((previous) => {
          const current =
            previous.date === today
              ? previous
              : {
                  ...emptyDailyStats(today, previous.history),
                  currentStreak: previous.currentStreak,
                  lastFocusDate: previous.lastFocusDate
                }
          const yesterday = getRecentDateKeys(today)[5]
          const nextStats = {
            ...current,
            sessions: current.sessions + 1,
            focusSeconds: current.focusSeconds + initialSeconds,
            currentStreak:
              current.lastFocusDate === today
                ? current.currentStreak
                : current.lastFocusDate === yesterday
                  ? current.currentStreak + 1
                  : 1,
            lastFocusDate: today
          }
          return {
            ...nextStats,
            history: pruneDailyHistory([...previous.history, nextStats], today)
          }
        })
      } else {
        suggestedMode = 'focus'
        if (mode === 'long') setCompletedSessions(0)
      }

      setNextMode(suggestedMode)
      setIsGlitching(true)
      setTimeout(() => setIsGlitching(false), 200)
      startAlarmSound()
      if (autoStartNext) {
        autoStartTimeoutRef.current = setTimeout(() => beginPhase(suggestedMode), 3000)
      }
    }
  }, [
    isActive,
    totalSeconds,
    setIsActive,
    setIsAlarm,
    startAlarmSound,
    mode,
    completedSessions,
    initialSeconds,
    autoStartNext,
    beginPhase
  ])

  // Helpers to format seconds into HH:MM:SS
  const curHours = Math.floor(totalSeconds / 3600)
  const curMinutes = Math.floor((totalSeconds % 3600) / 60)
  const curSeconds = totalSeconds % 60

  // Remaining time for the bottom track and the countdown ring
  const progressPercent = initialSeconds > 0 ? (totalSeconds / initialSeconds) * 100 : 0

  // Energy level (0 to 1) for glow effect
  const energyLevel = isActive ? 1 - totalSeconds / initialSeconds : 0

  // Determine if in final minute (urgent state)
  const isUrgent = isActive && totalSeconds > 0 && totalSeconds <= 60

  // Format time for rolling animation
  const timeString =
    curHours > 0
      ? `${curHours.toString().padStart(2, '0')}:${curMinutes.toString().padStart(2, '0')}:${curSeconds.toString().padStart(2, '0')}`
      : `${curMinutes.toString().padStart(2, '0')}:${curSeconds.toString().padStart(2, '0')}`

  useEffect(() => {
    const modeTitle = mode === 'long' ? 'Long Break' : mode === 'break' ? 'Break' : 'Focus'
    const title = `${timeString} · ${modeTitle}`
    document.title = title
    window.api?.setTimerTitle?.(title)
  }, [mode, timeString])

  useEffect(() => {
    document.documentElement.dataset.mode = mode
  }, [mode])

  // Microcopy rotation
  const microcopyLines = {
    idle: ['READY'],
    paused: ['PAUSED', 'HOLDING.'],
    running: {
      focus: ['IN THE ZONE'],
      break: ['RECHARGE'],
      long: ['DEEP REST']
    },
    final: ['ALMOST.'],
    done: ['DONE. NICE.']
  }

  const getCurrentMicrocopy = () => {
    if (isAlarm) return microcopyLines.done[microcopyIndex % microcopyLines.done.length]
    if (isUrgent) return microcopyLines.final[microcopyIndex % microcopyLines.final.length]
    if (isActive) {
      const modeLines = microcopyLines.running[mode] || microcopyLines.running.focus
      return modeLines[microcopyIndex % modeLines.length]
    }
    if (!hasStarted) return microcopyLines.idle[microcopyIndex % microcopyLines.idle.length]
    return microcopyLines.paused[microcopyIndex % microcopyLines.paused.length]
  }

  const renderSessionSquares = (pulseCurrent = false) => (
    <div
      className="flex items-center justify-center gap-1.5"
      role="group"
      aria-label={`${completedSessions} of 4 focus sessions completed`}
    >
      {[0, 1, 2, 3].map((index) => {
        const isCompleted = index < completedSessions
        const isCurrent =
          !isCompleted && index === completedSessions && completedSessions < 4 && pulseCurrent

        return (
          <span
            key={index}
            aria-hidden="true"
            className={`h-2.5 w-2.5 border-2 border-[var(--accent)] ${
              isCompleted ? 'bg-[var(--accent)]' : isCurrent ? 'round-current' : ''
            }`}
          />
        )
      })}
    </div>
  )

  const completionHeading =
    mode === 'focus' ? 'FOCUS DONE.' : mode === 'long' ? 'LONG BREAK DONE.' : 'BREAK DONE.'
  const completionPrompt =
    mode === 'focus'
      ? nextMode === 'long'
        ? 'START LONG BREAK?'
        : 'START BREAK?'
      : 'BACK TO FOCUS?'

  const presetsByMode = {
    focus: [
      { label: '15M', minutes: 15 },
      { label: '25M', minutes: 25 },
      { label: '45M', minutes: 45 },
      { label: '1H', minutes: 0, hours: 1 }
    ],
    break: [
      { label: '5M', minutes: 5 },
      { label: '10M', minutes: 10 },
      { label: '15M', minutes: 15 }
    ],
    long: [
      { label: '15M', minutes: 15 },
      { label: '20M', minutes: 20 },
      { label: '30M', minutes: 30 }
    ]
  }

  const elapsedPercent = Math.max(0, Math.min(100, 100 - progressPercent))
  const isFinalTenSeconds = isActive && totalSeconds > 0 && totalSeconds <= 10
  const focusMinutesToday = Math.floor(dailyStats.focusSeconds / 60)
  const focusTimeToday =
    dailyStats.focusSeconds < 60
      ? `${dailyStats.focusSeconds}s`
      : focusMinutesToday >= 60
        ? `${Math.floor(focusMinutesToday / 60)}h ${focusMinutesToday % 60}m`
        : `${focusMinutesToday}m`
  const yesterday = getRecentDateKeys(dailyStats.date)[5]
  const currentStreak =
    dailyStats.lastFocusDate === dailyStats.date || dailyStats.lastFocusDate === yesterday
      ? dailyStats.currentStreak
      : 0
  const weekRecords = getRecentDateKeys(dailyStats.date).map((date) => {
    const record = dailyStats.history.find((entry) => entry.date === date)
    const day = new Date(`${date}T12:00:00`).getDay()
    return {
      date,
      dayLabel: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day],
      focusMinutes: record ? record.focusSeconds / 60 : 0
    }
  })
  const maxFocusMinutes = Math.max(0, ...weekRecords.map((record) => record.focusMinutes))

  useEffect(() => {
    const interval = setInterval(() => {
      setMicrocopyIndex((prev) => prev + 1)
    }, 10000) // Rotate every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleStart = () => {
    if (isAlarm && nextMode) {
      beginPhase(nextMode)
      return
    }

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
    setHasStarted(true)
    setIsActive(true)
  }

  const handlePause = () => {
    setIsGlitching(true)
    setTimeout(() => setIsGlitching(false), 200)
    const deadline = timerDeadlineRef.current
    if (deadline !== null) {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      if (remaining === 0) return
      setTotalSeconds(remaining)
    }
    setIsActive(false)
  }

  const handleReset = () => {
    clearTimeout(autoStartTimeoutRef.current)
    autoStartTimeoutRef.current = null
    setIsActive(false)
    setIsAlarm(false)
    setNextMode(null)
    setHasStarted(false)
    stopAlarmSound()
    setTotalSeconds(initialSeconds)
  }

  const handleOpenEdit = () => {
    clearTimeout(autoStartTimeoutRef.current)
    autoStartTimeoutRef.current = null
    editingModeRef.current = mode
    setIsActive(false)
    setIsAlarm(false)
    setNextMode(null)
    stopAlarmSound()
    setHours(Math.floor(totalSeconds / 3600))
    setMinutes(Math.floor((totalSeconds % 3600) / 60))
    setSeconds(totalSeconds % 60)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setMode(editingModeRef.current)
    setIsEditing(false)
  }

  const handleSaveEdit = (startImmediately = false) => {
    const total = hours * 3600 + minutes * 60 + seconds
    if (total > 0) {
      setTotalSeconds(total)
      setInitialSeconds(total)
      setIsEditing(false)
      setIsAlarm(false)
      setNextMode(null)
      stopAlarmSound()
      if (startImmediately) {
        setHasStarted(true)
        setIsActive(true)
      }
    }
  }

  const handleApplyPreset = (targetMode, m, h = 0, s = 0) => {
    if (audioRef.current) {
      audioRef.current.load()
    }
    setHours(h)
    setMinutes(m)
    setSeconds(s)
    const total = h * 3600 + m * 60 + s
    setTotalSeconds(total)
    setInitialSeconds(total)
    setMode(targetMode)
    setIsEditing(false)
    setIsAlarm(false)
    setNextMode(null)
    stopAlarmSound()
    setHasStarted(true)
    setIsActive(true)
  }

  const handleSetMode = (newMode) => {
    setMode(newMode)
    const duration = MODE_DEFAULTS[newMode]
    setHours(duration.hours)
    setMinutes(duration.minutes)
    setSeconds(duration.seconds)
  }

  const handleSkipNextPhase = () => {
    clearTimeout(autoStartTimeoutRef.current)
    autoStartTimeoutRef.current = null
    setIsAlarm(false)
    if (nextMode === 'long') setCompletedSessions(0)
    setNextMode(null)
    stopAlarmSound()
    setHasStarted(false)
    setMode('focus')
    setHours(MODE_DEFAULTS.focus.hours)
    setMinutes(MODE_DEFAULTS.focus.minutes)
    setSeconds(MODE_DEFAULTS.focus.seconds)
    setTotalSeconds(25 * 60)
    setInitialSeconds(25 * 60)
  }

  // ===== Circular Progress Ring SVG =====
  const radius = 45
  const strokeWidth = 2
  const ringLength = 1000
  const remainingOffset = Math.max(
    0,
    Math.min(ringLength, ringLength * (1 - progressPercent / 100))
  )

  const renderProgressRing = () => {
    const ringState = isAlarm
      ? 'alarm'
      : !hasStarted
        ? 'idle'
        : !isActive
          ? 'paused'
          : isUrgent
            ? 'urgent'
            : 'running'
    const isPausedRing = ringState === 'paused'
    const trackColor =
      ringState === 'idle'
        ? 'var(--text)'
        : ringState === 'alarm'
          ? 'var(--accent)'
          : 'var(--track)'
    const progressColor = ringState === 'idle' || isPausedRing ? 'var(--text)' : 'var(--accent)'
    const ringOffset =
      ringState === 'idle' ? 0 : ringState === 'alarm' ? ringLength : remainingOffset
    const totalMinutes = Math.max(1, Math.ceil(initialSeconds / 60))
    const elapsedMinutes = Math.floor((initialSeconds - totalSeconds) / 60)

    const ticks = Array.from({ length: totalMinutes }, (_, i) => {
      const angle = (360 / totalMinutes) * i
      const isElapsed = i < elapsedMinutes
      const stateTickColor =
        ringState === 'idle'
          ? 'var(--text)'
          : ringState === 'alarm'
            ? 'var(--accent)'
            : isPausedRing
              ? 'var(--text)'
              : undefined
      const tickOpacity = isPausedRing ? 0.35 : isElapsed ? 0.12 : 1
      return (
        <line
          key={i}
          className={`tick ${isElapsed ? 'elapsed' : ''}`}
          stroke={stateTickColor}
          strokeOpacity={tickOpacity}
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
        className={`pointer-events-none absolute inset-0 h-full w-full ${ringState === 'urgent' ? 'urgent' : ''}`}
        data-ring-state={ringState}
        viewBox="0 0 120 120"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          pathLength={ringLength}
          fill="none"
          stroke={trackColor}
          strokeOpacity={isPausedRing ? 0.25 : 1}
          strokeWidth={strokeWidth}
          className={`progress-track__circle ${ringState === 'alarm' ? 'completion-ring-pulse' : ''}`}
        />
        {ticks}
        <circle
          cx="60"
          cy="60"
          r={radius}
          pathLength={ringLength}
          fill="none"
          stroke={progressColor}
          strokeOpacity={isPausedRing ? 0.5 : 1}
          strokeWidth={strokeWidth}
          strokeDasharray={ringLength}
          strokeDashoffset={ringOffset}
          strokeLinecap={progressPercent >= 100 ? 'butt' : 'round'}
          transform="rotate(-90 60 60)"
          className="progress-ring__circle"
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'Escape' && (isShowingStats || isEditing)) {
        event.preventDefault()
        if (isShowingStats) {
          setIsShowingStats(false)
          requestAnimationFrame(() => statsTriggerRef.current?.focus())
        } else {
          handleCancelEdit()
        }
        return
      }

      const target = event.target
      const isTextEntry =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (isTextEntry) return

      if (event.code === 'Space') {
        if (target instanceof HTMLElement && target.tagName === 'BUTTON') return
        event.preventDefault()
        if (isActive) handlePause()
        else handleStart()
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        handleReset()
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        onToggleMiniMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div
      className={`relative flex-1 min-h-0 flex flex-col justify-between border-x-2 border-black bg-[var(--panel)] overflow-hidden ${
        isMiniMode ? 'mini-timer-panel px-2 pt-1 pb-2' : 'px-3 py-1 pb-2.5'
      }`}
      data-mode={mode}
      data-state={
        isFinalTenSeconds
          ? 'final-ten'
          : isEditing
            ? 'edit'
            : isAlarm
              ? 'alarm'
              : isUrgent
                ? 'urgent'
                : isActive
                  ? 'running'
                  : !hasStarted
                    ? 'idle'
                    : 'paused'
      }
    >
      {isMiniMode ? (
        <button
          type="button"
          onClick={isActive ? handlePause : handleStart}
          aria-label={isActive ? 'Pause timer' : 'Start timer'}
          aria-keyshortcuts="Space"
          title="Click to play/pause"
          data-tip="CLICK TO PLAY/PAUSE"
          className="mini-timer flex-1 min-h-0 flex items-center justify-center gap-2 font-mono text-lg font-black text-[var(--accent)] cursor-pointer"
        >
          <span>{timeString}</span>
          {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      ) : isShowingStats ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-stats-title"
          className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-5"
        >
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <ChartNoAxesColumn className="h-5 w-5" aria-hidden="true" />
            <h2
              id="daily-stats-title"
              className="font-mono text-sm font-black uppercase tracking-wider"
            >
              Today&apos;s Stats
            </h2>
          </div>
          <dl className="grid w-full max-w-[280px] gap-1">
            <div className="flex items-center justify-between border-2 border-white/50 bg-black px-3 py-1">
              <dt className="font-mono text-[11px] font-bold text-white uppercase">
                Focus sessions
              </dt>
              <dd className="font-mono text-sm font-black text-[var(--accent)]">
                {dailyStats.sessions}
              </dd>
            </div>
            <div className="flex items-center justify-between border-2 border-white/50 bg-black px-3 py-1">
              <dt className="font-mono text-[11px] font-bold text-white uppercase">Focus time</dt>
              <dd className="font-mono text-sm font-black text-[var(--accent)]">
                {focusTimeToday}
              </dd>
            </div>
            <div className="flex items-center justify-between border-2 border-white/50 bg-black px-3 py-1">
              <dt className="font-mono text-[11px] font-bold text-white uppercase">
                Current streak
              </dt>
              <dd className="font-mono text-right text-xs font-black text-[var(--accent)]">
                {currentStreak} {currentStreak === 1 ? 'day' : 'days'}
              </dd>
            </div>
          </dl>
          <div
            className="w-full max-w-[280px]"
            role="group"
            aria-label="Focus minutes over the last seven days"
          >
            <p className="mb-1 text-center font-mono text-[9px] font-bold text-zinc-200 uppercase">
              Focus minutes · last 7 days
            </p>
            <div className="flex h-[58px] items-end justify-between gap-2 border-b border-zinc-500 px-2">
              {weekRecords.map((record) => {
                const height =
                  record.focusMinutes === 0
                    ? 2
                    : Math.max(4, (record.focusMinutes / maxFocusMinutes) * 38)
                const minutes = Number(record.focusMinutes.toFixed(2))

                return (
                  <div
                    key={record.date}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div
                      role="img"
                      tabIndex={0}
                      aria-label={`${record.date}: ${minutes} focus minutes`}
                      title={`${record.date}: ${minutes} focus minutes`}
                      data-tip={`${minutes} MINUTES`}
                      className="w-full max-w-5 rounded-t-sm focus-visible:outline"
                      style={{
                        height: `${height}px`,
                        backgroundColor:
                          record.date === dailyStats.date
                            ? 'var(--stats-today)'
                            : 'var(--stats-history)'
                      }}
                    />
                    <span aria-hidden="true" className="font-mono text-[9px] font-bold text-white">
                      {record.dayLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="font-mono text-[9px] font-bold text-zinc-200 uppercase">
            Stats reset at local midnight.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setIsShowingStats(false)
              requestAnimationFrame(() => statsTriggerRef.current?.focus())
            }}
            aria-label="Close daily stats"
            data-tip="CLOSE STATS (ESC)"
            className="btn flex items-center gap-1 border-2 border-white/70 bg-black px-3 py-1 text-[11px] font-bold text-white uppercase"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
        </section>
      ) : isAlarm ? (
        // ===== ALARM ACTIVE STATE =====
        <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
          <div className="relative aspect-square h-[94%] max-h-full">
            {renderProgressRing()}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 overflow-hidden px-5">
              <div className="relative flex items-center justify-center">
                <BellRing className="w-6 h-6 text-[var(--accent)]" />
              </div>
              <p className="w-full max-w-[220px] text-center font-mono text-xs font-black leading-relaxed text-white uppercase tracking-normal">
                <span className="block">{completionHeading}</span>
                <span className="block">{completionPrompt}</span>
              </p>
              <div className="flex items-center gap-2">
                {renderSessionSquares()}
                <span className="font-mono text-[10px] font-black text-white uppercase tracking-wide">
                  {dailyStats.sessions} FOCUS TODAY
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => nextMode && beginPhase(nextMode)}
                  aria-label={`Start ${nextMode === 'long' ? 'long break' : nextMode}`}
                  className="btn accent-btn border-2 border-black px-3 py-1.5 bg-[var(--accent)] text-black font-mono text-[11px] font-black uppercase cursor-pointer"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={handleSkipNextPhase}
                  className="btn border-2 border-white/60 px-3 py-1.5 bg-black text-white font-mono text-[11px] font-black uppercase cursor-pointer"
                >
                  <SkipForward className="mr-1 inline h-3 w-3" />
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : isEditing ? (
        // ===== EDIT / SETUP MODE =====
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 overflow-hidden px-2">
          {/* Time Inputs */}
          <div className="flex items-start justify-center gap-1 shrink-0">
            <InputField label="hr" value={hours} onChange={setHours} max={99} />
            <span
              className="flex h-12 items-center text-sm font-black leading-none text-[var(--accent)]"
              aria-hidden="true"
            >
              :
            </span>
            <InputField label="min" value={minutes} onChange={setMinutes} max={59} />
            <span
              className="flex h-12 items-center text-sm font-black leading-none text-[var(--accent)]"
              aria-hidden="true"
            >
              :
            </span>
            <InputField label="sec" value={seconds} onChange={setSeconds} max={59} />
          </div>

          {/* Mode Buttons */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            {[
              { label: 'FOCUS', mode: 'focus' },
              { label: 'BREAK', mode: 'break' },
              { label: 'LONG', mode: 'long' }
            ].map((modeBtn) => (
              <button
                key={modeBtn.mode}
                type="button"
                onClick={() => handleSetMode(modeBtn.mode)}
                aria-pressed={mode === modeBtn.mode}
                className={`mode-transition btn border-2 border-black px-3 py-1 font-mono text-[11px] font-black uppercase cursor-pointer ${
                  mode === modeBtn.mode
                    ? 'mode-selected bg-[var(--accent)] text-black'
                    : 'settings-chip bg-zinc-900 text-white'
                }`}
              >
                {modeBtn.label}
              </button>
            ))}
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center justify-center gap-1 shrink-0">
            {presetsByMode[mode].map((preset) => {
              const presetHours = preset.hours || 0
              const total = presetHours * 3600 + preset.minutes * 60
              const selected = total === hours * 3600 + minutes * 60 + seconds
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(mode, preset.minutes, presetHours)}
                  aria-pressed={selected}
                  className={`mode-transition btn settings-chip border-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase cursor-pointer ${
                    selected
                      ? 'mode-selected bg-[var(--accent)] text-black'
                      : 'bg-zinc-900 text-white'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Sound Controls - Compact */}
          <div className="flex flex-col items-center gap-0.5 min-h-0 shrink-0">
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={handleChooseAlarmAudio}
                aria-label={
                  alarmAudio ? `Change alarm sound: ${alarmAudio.fileName}` : 'Choose alarm sound'
                }
                data-tip="CHOOSE ALARM SOUND"
                disabled={isChoosingAudio}
                className="mode-transition btn flex items-center gap-1 border-2 border-black px-2 py-0.5 bg-white text-black font-mono text-[11px] font-bold uppercase cursor-pointer disabled:opacity-50"
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
                  data-tip="RESET ALARM SOUND"
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
              <p className="font-mono text-[11px] font-bold leading-normal text-zinc-200 uppercase tracking-normal">
                {alarmAudio ? `Sound: ${alarmAudio.fileName}` : 'Default alarm sound'}
              </p>
            )}
          </div>

          <label className="flex items-center justify-center gap-2 font-mono text-[11px] font-bold leading-normal text-zinc-200 uppercase tracking-normal">
            <input
              type="checkbox"
              checked={autoStartNext}
              onChange={(event) => setAutoStartNext(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Auto-start next phase
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <button
              onClick={handleCancelEdit}
              className="btn flex items-center gap-1 border-2 border-white/60 px-3 py-0.5 bg-zinc-900 text-white font-mono text-[9px] font-bold uppercase cursor-pointer"
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
                  className={`timer-digits font-mono text-[2rem] font-black leading-none tracking-tight tabular-nums ${
                    isActive
                      ? 'text-[var(--accent)]'
                      : hasStarted
                        ? 'paused-digits text-[var(--text)]'
                        : 'text-[var(--text)]'
                  } ${isGlitching ? 'glitch' : ''}`}
                >
                  {timeString}
                </div>

                {/* Status Label */}
                <span
                  className={`mt-1 font-mono text-[10px] font-black uppercase tracking-[0.25em] transition-colors ${
                    audioError
                      ? 'text-[var(--accent)]'
                      : isActive
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text)]'
                  }`}
                >
                  {audioError || getCurrentMicrocopy()}
                </span>

                {/* Session Dots */}
                <div className="mt-2">{renderSessionSquares(mode === 'focus' && isActive)}</div>

                <button
                  type="button"
                  ref={statsTriggerRef}
                  onClick={() => setIsShowingStats(true)}
                  aria-label={`${dailyStats.sessions} focus ${
                    dailyStats.sessions === 1 ? 'session' : 'sessions'
                  } completed today. Open daily stats.`}
                  data-tip={`${dailyStats.sessions} FOCUS SESSIONS TODAY · VIEW STATS`}
                  title={`${dailyStats.sessions} focus sessions today. View daily stats.`}
                  className="mt-1 flex items-center gap-1 font-mono font-bold uppercase tracking-wider text-white focus-visible:outline"
                >
                  <Flame className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                  <span className="text-sm tabular-nums">{dailyStats.sessions}</span>
                  <span className="text-[8px] text-zinc-300">FOCUS TODAY</span>
                </button>
              </div>
            </div>
          </div>

          {/* Control Dock */}
          <div className="mt-1 mb-1 grid w-full shrink-0 grid-cols-4 items-center justify-items-center px-2">
            {/* Edit */}
            <button
              onClick={handleOpenEdit}
              aria-label="Edit duration"
              data-tip="SETTINGS"
              className="btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Primary CTA */}
            <button
              onClick={isActive ? handlePause : handleStart}
              aria-label={isActive ? 'Pause' : 'Start'}
              aria-keyshortcuts="Space"
              data-tip={isActive ? 'PAUSE' : 'START'}
              className="btn accent-btn flex h-11 w-11 items-center justify-center border-2 border-black bg-[var(--accent)] text-black cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                data-state={isActive ? 'running' : 'paused'}
              >
                <polygon className="tri" points="7,4 20,12 7,20" fill="currentColor" />
                <rect className="bar l" x="6" y="4" width="4" height="16" fill="currentColor" />
                <rect className="bar r" x="14" y="4" width="4" height="16" fill="currentColor" />
              </svg>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              aria-label="Reset timer"
              aria-keyshortcuts="R"
              data-tip="RESET"
              className="btn flex h-8 w-8 items-center justify-center border-2 border-black bg-white text-black cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Mute */}
            <button
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute alarm' : 'Mute alarm'}
              data-tip={isMuted ? 'UNMUTE ALARM' : 'MUTE ALARM'}
              title={isMuted ? 'Unmute alarm' : 'Mute alarm'}
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
      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(isAlarm ? 100 : elapsedPercent)}
        className={`progress-bar-track absolute bottom-0 left-0 right-0 overflow-hidden ${
          isMiniMode ? 'h-1' : 'h-[5px]'
        }`}
      >
        <div
          className={`mini-progress h-full ${isAlarm ? 'animate-pulse' : ''}`}
          style={{ width: `${isAlarm ? 100 : elapsedPercent}%` }}
        />
      </div>
    </div>
  )
}

export default Timer
