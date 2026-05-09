import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGiftStore } from '../store/gift'
import CardPreview from '../components/CardPreview'
import NotificationModal from '../components/NotificationModal'

function isFirstSend(): boolean {
  const flag = localStorage.getItem('pp_sent_before')
  return !flag
}

function markSent() {
  localStorage.setItem('pp_sent_before', '1')
}

export default function Confirmation() {
  const navigate = useNavigate()
  const { occasion, brand, cardDesignIndex, recipientName, giftId, reset } = useGiftStore()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const firstSend = isFirstSend()
    markSent()

    if (firstSend) {
      const timer = setTimeout(() => setShowModal(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleSendAnother() {
    reset()
    navigate('/')
  }

  function addToCalendar() {
    const title = encodeURIComponent(`Olive gift for ${recipientName}`)
    const details = encodeURIComponent('Gift sent via Olive')
    const now = new Date()
    const dateStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dateStr}/${dateStr}`,
      '_blank',
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 animate-fade-in text-center">
      {/* Heading */}
      <h1 className="font-display text-5xl text-ink mb-3 leading-none">✦ Sent.</h1>
      <p className="text-base text-muted mb-8">
        Your gift is on its way to{' '}
        <span className="text-ink font-medium">{recipientName || 'your recipient'}</span>.
      </p>

      {/* Card thumbnail */}
      <div className="w-full max-w-xs mb-10 shadow-warm-lg rounded-card overflow-hidden">
        <CardPreview
          occasion={occasion}
          brand={brand}
          cardDesignIndex={cardDesignIndex}
        />
      </div>

      {/* Calm secondary links */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={handleSendAnother}
          className="w-full py-3 rounded-input border border-border text-sm font-medium text-ink hover:border-terra/50 hover:bg-terra/5 transition-all"
        >
          Send another gift
        </button>

        {giftId && (
          <Link
            to={`/gift/${giftId}`}
            className="w-full py-3 rounded-input border border-border text-sm font-medium text-ink hover:border-terra/50 hover:bg-terra/5 transition-all block text-center"
          >
            View gift status
          </Link>
        )}

        <button
          onClick={addToCalendar}
          className="text-sm text-muted hover:text-ink transition-colors underline underline-offset-2"
        >
          Add to calendar
        </button>
      </div>

      {showModal && (
        <NotificationModal
          recipientName={recipientName}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
