import { useEffect, useId, useRef, useState } from 'react'
import type { CompletionNotificationPermission } from '../lib/completionNotifications'
import type { WakeLockStatus } from '../hooks/useWakeLock'

interface RuntimeFeaturesControlProps {
  notificationPermission: CompletionNotificationPermission
  notificationRequesting: boolean
  notificationRequestFailed: boolean
  onRequestNotificationPermission: () => void
  keepAwake: boolean
  onKeepAwakeChange: (enabled: boolean) => void
  wakeLockStatus: WakeLockStatus
}

export function RuntimeFeaturesControl({
  notificationPermission,
  notificationRequesting,
  notificationRequestFailed,
  onRequestNotificationPermission,
  keepAwake,
  onKeepAwakeChange,
  wakeLockStatus,
}: RuntimeFeaturesControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()
  const notificationsOn = notificationPermission === 'granted'

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="runtime-features-control" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`runtime-features-toggle${notificationsOn || keepAwake ? ' runtime-features-toggle-active' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={popupId}
      >
        <span>Alerts</span>
        <span className="runtime-features-toggle-state">
          {notificationsOn || keepAwake ? 'On' : 'Off'}
        </span>
      </button>

      {open && (
        <div id={popupId} className="runtime-features-popup">
          <section className="runtime-feature-section" aria-labelledby={`${popupId}-notifications`}>
            <div className="runtime-feature-heading-row">
              <h2 id={`${popupId}-notifications`}>Notifications</h2>
              <span className="runtime-feature-status">{notificationStatusCopy(notificationPermission)}</span>
            </div>
            {notificationPermission === 'default' && (
              <button
                type="button"
                className="runtime-feature-action"
                disabled={notificationRequesting}
                onClick={onRequestNotificationPermission}
              >
                {notificationRequesting ? 'Requesting…' : 'Enable notifications'}
              </button>
            )}
            {notificationRequestFailed && (
              <p className="runtime-feature-error" role="status">
                Permission could not be requested. Try again from your browser settings.
              </p>
            )}
            <p>Shows a generic alert when Chronos detects completion while this page is hidden.</p>
          </section>

          <section className="runtime-feature-section" aria-labelledby={`${popupId}-wake-lock`}>
            <div className="runtime-feature-heading-row">
              <h2 id={`${popupId}-wake-lock`}>Keep screen awake</h2>
              <span className="runtime-feature-status">{wakeLockStatusCopy(wakeLockStatus)}</span>
            </div>
            <label className="runtime-feature-switch">
              <input
                type="checkbox"
                checked={keepAwake}
                disabled={wakeLockStatus === 'unsupported'}
                onChange={(event) => onKeepAwakeChange(event.currentTarget.checked)}
              />
              <span>Use while a timer is running and this page is visible</span>
            </label>
          </section>

          <p className="runtime-feature-limit">
            Browsers may suspend background pages. Notifications cannot wake a fully suspended browser.
          </p>
        </div>
      )}
    </div>
  )
}

function notificationStatusCopy(permission: CompletionNotificationPermission): string {
  switch (permission) {
    case 'granted':
      return 'Allowed'
    case 'denied':
      return 'Blocked'
    case 'default':
      return 'Not enabled'
    case 'unsupported':
      return 'Unsupported'
  }
}

function wakeLockStatusCopy(status: WakeLockStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'requesting':
      return 'Starting…'
    case 'error':
      return 'Unavailable now'
    case 'idle':
      return 'Ready'
    case 'disabled':
      return 'Off'
    case 'unsupported':
      return 'Unsupported'
  }
}
