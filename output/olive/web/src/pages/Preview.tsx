import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useGiftStore } from '../store/gift'
import CardPreview from '../components/CardPreview'
import ProgressBar from '../components/ProgressBar'

function SmsPreview({ senderName, recipientName }: { senderName: string; recipientName: string }) {
  return (
    <div className="bg-[#F2F2F7] rounded-[18px] p-4 max-w-[300px] mx-auto">
      {/* iMessage-style header */}
      <div className="text-center mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-sm font-semibold mx-auto mb-1">
          {senderName.charAt(0).toUpperCase()}
        </div>
        <p className="text-xs text-gray-500">{senderName}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">Today {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>

      {/* Bubble */}
      <div className="flex justify-start">
        <div className="bg-white rounded-[16px] rounded-tl-[4px] px-4 py-3 shadow-sm max-w-[220px]">
          <p className="text-xs text-gray-800 mb-1">
            🎁 Hey {recipientName || 'there'}! {senderName} sent you a gift.
          </p>
          <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
            <span className="text-base">✦</span>
            <div>
              <p className="text-[10px] font-semibold text-gray-800">Olive</p>
              <p className="text-[10px] text-gray-500">Tap to open your gift →</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmailPreview({ senderName, recipientName }: { senderName: string; recipientName: string }) {
  return (
    <div className="bg-white rounded-card border border-border shadow-warm overflow-hidden max-w-[320px] mx-auto">
      {/* Email header strip */}
      <div className="bg-[#f6f6f6] border-b border-border px-4 py-3">
        <p className="text-[10px] text-gray-500 mb-0.5">From: Olive &lt;hello@sendolive.co&gt;</p>
        <p className="text-[10px] text-gray-500">To: {recipientName || 'Recipient'}</p>
      </div>

      {/* Subject */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-ink">🎁 {senderName} sent you a gift</p>
      </div>

      {/* Body preview */}
      <div className="px-4 py-4">
        <p className="text-xs text-muted leading-relaxed">
          Hi {recipientName || 'there'}, {senderName} has sent you a thoughtful gift via Olive…
        </p>
        <div className="mt-3 bg-terra text-white text-xs font-semibold rounded-input py-2 text-center">
          Open your gift →
        </div>
      </div>
    </div>
  )
}

function LinkPreview() {
  return (
    <div className="bg-white rounded-card border border-border shadow-warm p-4 max-w-[320px] mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-input bg-terra/10 flex items-center justify-center text-lg">✦</div>
        <div>
          <p className="text-sm font-semibold text-ink">Olive</p>
          <p className="text-xs text-muted">sendolive.co/r/abc123</p>
        </div>
      </div>
      <div className="w-full h-20 rounded-input bg-border/40 flex items-center justify-center text-2xl">
        🎁
      </div>
      <p className="mt-2 text-xs text-muted text-center">Someone sent you a gift — tap to open</p>
    </div>
  )
}

export default function Preview() {
  const navigate = useNavigate()
  const {
    occasion, brand, cardDesignIndex, message, signatureData, signatureMode,
    recipientName, deliveryMethod,
  } = useGiftStore()

  // Use a placeholder sender name
  const senderName = 'You'

  const [envelopeOpened, setEnvelopeOpened] = useState(false)
  const [animating, setAnimating] = useState(false)

  function handleEnvelopeTap() {
    if (animating || envelopeOpened) return
    setAnimating(true)
    setTimeout(() => {
      setEnvelopeOpened(true)
      setAnimating(false)
    }, 1200)
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={6} />

      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl text-ink leading-tight">
          Preview
        </h1>
        <p className="text-sm text-muted mt-1">This is what your recipient will see.</p>
      </div>

      {/* Delivery channel preview */}
      <div className="px-6 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          {deliveryMethod === 'SMS' ? 'SMS preview' : deliveryMethod === 'EMAIL' ? 'Email preview' : 'Link preview'}
        </p>
        {deliveryMethod === 'SMS' && (
          <SmsPreview senderName={senderName} recipientName={recipientName} />
        )}
        {deliveryMethod === 'EMAIL' && (
          <EmailPreview senderName={senderName} recipientName={recipientName} />
        )}
        {(deliveryMethod === 'LINK' || !deliveryMethod) && (
          <LinkPreview />
        )}
      </div>

      {/* Interactive card preview */}
      <div className="px-6 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Card preview</p>

        {!envelopeOpened ? (
          <button
            onClick={handleEnvelopeTap}
            className="w-full relative group focus:outline-none"
            aria-label="Tap to preview open animation"
          >
            {/* Envelope */}
            <div className="w-full aspect-[3/2] rounded-card bg-paper border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 hover:border-terra/40 transition-colors">
              {/* Flap */}
              <div
                className={['absolute inset-x-0 top-0 h-1/2 perspective-container', animating ? 'animate-flap-open' : ''].join(' ')}
                style={{ transformOrigin: 'top center' }}
              >
                <div className="w-full h-full rounded-t-card bg-white/60 border-b border-dashed border-border/60" />
              </div>

              <div className="text-4xl mt-4" aria-hidden="true">✉️</div>
              <p className="text-sm text-muted group-hover:text-terra transition-colors font-medium">
                {animating ? 'Opening…' : 'Tap to open'}
              </p>
            </div>
          </button>
        ) : (
          <div className="animate-card-slide-up">
            <CardPreview
              occasion={occasion}
              brand={brand}
              cardDesignIndex={cardDesignIndex}
              message={message}
              signatureData={signatureData}
              signatureMode={signatureMode}
              large
            />
          </div>
        )}

        {envelopeOpened && (
          <button
            onClick={() => setEnvelopeOpened(false)}
            className="mt-2 text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors mx-auto block"
          >
            Reset preview
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 pb-8 flex flex-col gap-3">
        <button
          onClick={() => navigate('/review')}
          className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Review & Pay
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Link
          to="/personalise"
          className="text-sm text-muted hover:text-ink text-center underline underline-offset-2 transition-colors"
        >
          Edit card
        </Link>
      </div>
    </div>
  )
}
