import { useEffect, useRef } from 'react'

function ActionNotice({ message, tone = 'success', onDismiss }) {
  const noticeRef = useRef(null)

  useEffect(() => {
    if (message) {
      noticeRef.current?.focus()
    }
  }, [message])

  if (!message) return null

  const toneClass =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium outline-none ring-brand-500 focus:ring-2 ${toneClass}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="text-xs font-semibold uppercase" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  )
}

export default ActionNotice
