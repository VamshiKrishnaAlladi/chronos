import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdatePrompt() {
  const [updating, setUpdating] = useState(false)
  const [updateFailed, setUpdateFailed] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: (error) => {
      console.error('Unable to register the Chronos service worker.', error)
    },
  })

  if (!needRefresh) {
    return null
  }

  async function applyUpdate() {
    setUpdating(true)
    setUpdateFailed(false)

    try {
      await updateServiceWorker(true)
    } catch (error) {
      console.error('Unable to apply the Chronos update.', error)
      setUpdating(false)
      setUpdateFailed(true)
    }
  }

  return (
    <section className="pwa-update-prompt" role="status" aria-live="polite" aria-label="App update">
      <div>
        <p className="pwa-update-title">Chronos update ready</p>
        <p className="pwa-update-copy">
          Apply it when convenient. Your active timers have already been saved.
        </p>
        {updateFailed && (
          <p className="pwa-update-error" role="alert">
            The update could not be applied. Please try again.
          </p>
        )}
      </div>
      <div className="pwa-update-actions">
        <button type="button" className="pwa-update-button" disabled={updating} onClick={() => void applyUpdate()}>
          {updating ? 'Updating…' : 'Update'}
        </button>
        <button
          type="button"
          className="pwa-update-button pwa-update-button-secondary"
          disabled={updating}
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
      </div>
    </section>
  )
}
