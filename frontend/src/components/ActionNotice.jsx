import { useEffect, useRef, useState } from "react";

function ActionNotice({ message, tone = "success", onDismiss }) {
  const noticeRef = useRef(null);
  const dismissRef = useRef(onDismiss);
  const [isVisible, setIsVisible] = useState(Boolean(message));

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      setIsVisible(false);
      return undefined;
    }

    setIsVisible(true);
    const focusTimer = window.setTimeout(() => noticeRef.current?.focus(), 0);
    const dismissTimer = window.setTimeout(() => {
      setIsVisible(false);
      dismissRef.current?.();
    }, 20_000);

    return () => {
      window.clearTimeout(focusTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message]);

  if (!message || !isVisible) return null;

  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      ref={noticeRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className={`animate-toast-in fixed bottom-4 right-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl outline-none ring-brand-500 focus:ring-2 sm:bottom-6 sm:right-6 ${toneClass}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="text-xs font-semibold uppercase"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export default ActionNotice;
