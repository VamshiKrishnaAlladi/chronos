import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppView, StoredPreferences, ToolFace, ToolKind } from '../types'
import { TOOL_LABELS } from '../types'
import type { UseCountdownReturn } from './useCountdown'
import type { UsePomodoroReturn } from './usePomodoro'
import type { UseTimerReturn } from './useTimer'
import { saveStoredPreferences, saveStoredPreferencesSync } from '../lib/preferences'
import { setSoundVolume as configureSoundVolume, stopCompletionTone } from '../lib/notifications'

interface UseChronosAppOptions {
  initialPrefs: StoredPreferences
  countdown: UseCountdownReturn
  timer: UseTimerReturn
  pomo: UsePomodoroReturn
}

export function useChronosApp({
  initialPrefs,
  countdown,
  timer,
  pomo,
}: UseChronosAppOptions) {
  const [appView, setAppView] = useState<AppView>(initialPrefs.appView)
  const [activeTool, setActiveTool] = useState<ToolKind>(initialPrefs.activeTool)
  const [pendingToolSwitch, setPendingToolSwitch] = useState<ToolKind | null>(null)
  const [pendingViewSwitch, setPendingViewSwitch] = useState<AppView | null>(null)
  const [soundVolume, setSoundVolume] = useState(initialPrefs.soundVolume)

  const pendingViewSwitchRef = useRef(pendingViewSwitch)
  const tools: Record<ToolKind, ToolFace> = { countdown, timer, pomodoro: pomo }
  const tool = tools[activeTool]
  const toolLabel = TOOL_LABELS[activeTool]
  const isIdle = tool.status === 'idle'
  const isRunning = tool.status === 'running'
  const isPaused = tool.status === 'paused'
  const isTappable = isRunning || isPaused

  const prefsRef = useRef({
    activeTool,
    appView,
    countdownInputParts: countdown.inputParts,
    pomodoroInputParts: pomo.workInputParts,
    pomoBreakInputParts: pomo.breakInputParts,
    pomoSessionsInput: pomo.sessionsInput,
    soundVolume,
  })

  useEffect(() => {
    const prefs = {
      activeTool,
      appView,
      countdownInputParts: countdown.inputParts,
      pomodoroInputParts: pomo.workInputParts,
      pomoBreakInputParts: pomo.breakInputParts,
      pomoSessionsInput: pomo.sessionsInput,
      soundVolume,
    }
    prefsRef.current = prefs
    saveStoredPreferences(prefs)
  }, [
    activeTool,
    appView,
    countdown.inputParts,
    pomo.workInputParts,
    pomo.breakInputParts,
    pomo.sessionsInput,
    soundVolume,
  ])

  const flushPrefs = useCallback(() => {
    saveStoredPreferencesSync(prefsRef.current)
  }, [])

  useEffect(() => {
    pendingViewSwitchRef.current = pendingViewSwitch
  }, [pendingViewSwitch])

  useEffect(() => {
    window.addEventListener('beforeunload', flushPrefs)
    return () => window.removeEventListener('beforeunload', flushPrefs)
  }, [flushPrefs])

  useEffect(() => {
    configureSoundVolume(soundVolume)
  }, [soundVolume])

  useEffect(() => {
    window.addEventListener('pointerdown', stopCompletionTone)
    window.addEventListener('keydown', stopCompletionTone)
    return () => {
      window.removeEventListener('pointerdown', stopCompletionTone)
      window.removeEventListener('keydown', stopCompletionTone)
    }
  }, [])

  function requestViewSwitch(target: AppView) {
    if (target === appView) return

    if (appView === 'focus') {
      if (isRunning || isPaused) {
        setPendingViewSwitch(target)
        return
      }
      stopCompletionTone()
      setAppView(target)
      return
    }

    setPendingViewSwitch(target)
  }

  function confirmFocusViewSwitch() {
    if (!pendingViewSwitch) return
    tool.stop()
    stopCompletionTone()
    setAppView(pendingViewSwitch)
    setPendingViewSwitch(null)
  }

  function handleDashboardLeaveConfirmed() {
    stopCompletionTone()
    const target = pendingViewSwitchRef.current
    if (target) setAppView(target)
    setPendingViewSwitch(null)
  }

  function handleDashboardLeaveCancelled() {
    setPendingViewSwitch(null)
  }

  function switchTool(next: ToolKind) {
    if (next === activeTool) return

    if (tool.readoutBlinking) {
      tool.stop()
      setActiveTool(next)
      return
    }

    if (isRunning || isPaused) {
      setPendingToolSwitch(next)
      return
    }

    setActiveTool(next)
  }

  function confirmToolSwitch() {
    if (!pendingToolSwitch) return
    tool.stop()
    setActiveTool(pendingToolSwitch)
    setPendingToolSwitch(null)
  }

  return {
    appView,
    activeTool,
    pendingToolSwitch,
    pendingViewSwitch,
    soundVolume,
    setSoundVolume,
    tool,
    toolLabel,
    isIdle,
    isRunning,
    isPaused,
    isTappable,
    requestViewSwitch,
    confirmFocusViewSwitch,
    handleDashboardLeaveConfirmed,
    handleDashboardLeaveCancelled,
    switchTool,
    confirmToolSwitch,
    cancelToolSwitch: () => setPendingToolSwitch(null),
    cancelFocusViewSwitch: () => setPendingViewSwitch(null),
  }
}
