import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getRecipientGift,
  openGift,
  redeemGift,
  sendThankYou,
} from '../api/client'
import CardPreview from '../components/CardPreview'
import type { RecipientGift } from '../types'

// ── Envelope SVG ──────────────────────────────────────────────────────────────

function EnvelopeSvg({ opening }: { opening: boolean }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={['w-32 h-auto', opening ? 'animate-flap-open' : ''].join(' ')}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Envelope body */}
      <rect x="4" y="20" width="112" height="56" rx="4" fill="#FBF8F3" stroke="#E8E3DB" strokeWidth="2" />
      {/* Flap */}
      <path
        d="M4 24 L60 52 L116 24"
        stroke="#E8E3DB"
        strokeWidth="2"
        fill="none"
        style={{ transformOrigin: '60px 24px' }}
      />
      {/* Bottom fold lines */}
      <path d="M4 76 L44 50" stroke="#E8E3DB" strokeWidth="1.5" />
      <path d="M116 76 L76 50" stroke="#E8E3DB" strokeWidth="1.5" />
      {/* Wax seal dot */}
      <circle cx="60" cy="52" r="6" fill="#C75A3F" opacity="0.8" />
    </svg>
  )
}

// ── Gift code box ─────────────────────────────────────────────────────────────

function GiftCodeBox({ code, brand }: { code: string; brand: RecipientGift['brand'] }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-card border border-border shadow-warm p-5 animate-fade-in">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 text-center">
        Your gift card code
      </p>
      <div className="flex items-center gap-3 bg-paper rounded-input border border-border px-4 py-3 mb-4">
        <span className="flex-1 font-mono text-sm font-bold tracking-widest text-ink text-center">
          {code}
        </span>
        <button
          onClick={handleCopy}
          className={[
            'text-xs font-semibold flex-shrink-0 transition-colors',
            copied ? 'text-green-600' : 'text-terra hover:text-terra/80',
          ].join(' ')}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <a
        href={brand.redeemUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-terra text-white text-sm font-semibold text-center py-3 rounded-input hover:bg-terra/90 active:scale-[0.98] transition-all"
      >
        Redeem at {brand.name} →
      </a>
    </div>
  )
}

// ── Thank-you form ────────────────────────────────────────────────────────────

function ThankYouForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () => sendThankYou(token, msg),
    onSuccess: () => setSent(true),
  })

  if (sent) {
    return <p className="text-sm text-green-600 text-center">Thank-you note sent!</p>
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted hover:text-ink underline underline-offset-2 transition-colors"
      >
        Send a thank you
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      <textarea
        rows={3}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Write a quick thank you…"
        className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={!msg.trim() || mutation.isPending}
          className="flex-1 bg-terra text-white rounded-input py-2.5 text-sm font-semibold hover:bg-terra/90 transition-all disabled:opacity-40"
        >
          {mutation.isPending ? 'Sending…' : 'Send'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 text-sm text-muted hover:text-ink rounded-input border border-border transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecipientView() {
  const { token } = useParams<{ token: string }>()

  const { data: gift, isLoading, isError } = useQuery({
    queryKey: ['r', token],
    queryFn: () => getRecipientGift(token!),
    enabled: Boolean(token),
  })

  const openMutation = useMutation({
    mutationFn: () => openGift(token!),
  })

  const redeemMutation = useMutation({
    mutationFn: () => redeemGift(token!),
  })

  const [envelopeState, setEnvelopeState] = useState<'envelope' | 'animating' | 'card'>('envelope')
  const [giftCode, setGiftCode] = useState<string | null>(null)

  async function handleOpenEnvelope() {
    if (envelopeState !== 'envelope') return
    setEnvelopeState('animating')
    openMutation.mutate()
    setTimeout(() => {
      setEnvelopeState('card')
    }, 1200)
  }

  async function handleRedeem() {
    const result = await redeemMutation.mutateAsync()
    if (result.giftCardCode) {
      setGiftCode(result.giftCardCode)
    }
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-terra border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── Error ──
  if (isError || !gift) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-2xl text-ink mb-2">Hmm.</p>
        <p className="text-sm text-muted">This gift link isn't valid or has expired.</p>
      </div>
    )
  }

  // ── Envelope state ──
  if (envelopeState !== 'card') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center gap-6">
        <div className="w-full max-w-xs">
          {/* Occasion indicator */}
          <p className="text-sm text-muted mb-2">
            {gift.occasion.emoji} {gift.occasion.label}
          </p>
          <h1 className="font-display text-3xl text-ink mb-1">
            {gift.recipientName},
          </h1>
          <p className="text-base text-muted mb-8">
            <span className="text-ink font-medium">{gift.senderName}</span> sent you a gift
          </p>

          <button
            onClick={handleOpenEnvelope}
            className="focus:outline-none group"
            aria-label="Tap to open your gift"
          >
            <div className={['transition-transform duration-150', envelopeState === 'animating' ? 'scale-95' : 'group-hover:scale-105'].join(' ')}>
              <EnvelopeSvg opening={envelopeState === 'animating'} />
            </div>
            <p className="mt-4 text-sm font-medium text-muted group-hover:text-terra transition-colors">
              {envelopeState === 'animating' ? 'Opening…' : 'Tap to open'}
            </p>
          </button>
        </div>

        <p className="text-xs text-muted/60 absolute bottom-4">
          Pensive Post · No account needed
        </p>
      </div>
    )
  }

  // ── Card state ──
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center">
      <div className="w-full max-w-app px-6 py-8 flex flex-col gap-6 animate-fade-in">
        {/* Large card */}
        <CardPreview
          occasion={gift.occasion}
          brand={gift.brand}
          cardDesignIndex={gift.cardDesignIndex}
          message={gift.message}
          signatureData={gift.signatureData}
          signatureMode={gift.signatureMode}
          large
        />

        {/* Message */}
        {gift.message && (
          <div className="bg-white rounded-card border border-border shadow-warm p-4">
            <p className="text-sm text-ink leading-relaxed">{gift.message}</p>
          </div>
        )}

        {/* Gift code or redeem CTA */}
        {giftCode ? (
          <GiftCodeBox code={giftCode} brand={gift.brand} />
        ) : (
          <button
            onClick={handleRedeem}
            disabled={redeemMutation.isPending}
            className="w-full bg-terra text-white rounded-input py-4 text-base font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {redeemMutation.isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Revealing…
              </>
            ) : (
              <>Reveal gift</>
            )}
          </button>
        )}

        {redeemMutation.isError && (
          <p className="text-sm text-red-500 text-center -mt-3">
            Something went wrong. Please try again.
          </p>
        )}

        {/* Thank you */}
        <div className="flex justify-center">
          <ThankYouForm token={token!} />
        </div>

        <p className="text-xs text-muted/60 text-center pb-4">
          Powered by Pensive Post
        </p>
      </div>
    </div>
  )
}
