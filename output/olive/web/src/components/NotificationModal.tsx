interface NotificationModalProps {
  recipientName: string
  onClose: () => void
}

export default function NotificationModal({ recipientName, onClose }: NotificationModalProps) {
  async function handleAllow() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      localStorage.setItem('pp_notifications', permission)
    }
    onClose()
  }

  function handleDismiss() {
    localStorage.setItem('pp_notifications', 'denied')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-heading"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-app bg-paper rounded-t-2xl sm:rounded-card shadow-warm-lg p-6 animate-fade-in">
        <div className="mb-1 text-2xl" aria-hidden="true">🔔</div>
        <h2
          id="notif-heading"
          className="font-display text-xl text-ink mb-2"
        >
          Know when {recipientName || 'they'} opens it?
        </h2>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          We'll send you a quiet notification the moment your gift is opened — no other emails, ever.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAllow}
            className="w-full bg-terra text-white rounded-input py-3 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all"
          >
            Allow notifications
          </button>
          <button
            onClick={handleDismiss}
            className="w-full text-sm text-muted hover:text-ink transition-colors py-1"
          >
            Not right now
          </button>
        </div>
      </div>
    </div>
  )
}
