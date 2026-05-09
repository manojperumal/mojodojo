import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useGiftStore } from '../store/gift'
import { createGift, createPaymentIntent, payGift } from '../api/client'
import ProgressBar from '../components/ProgressBar'

const SERVICE_FEE = 1.5

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '')

function formatDelivery(method: string | null, phone: string, email: string): string {
  if (method === 'SMS') return phone || 'SMS'
  if (method === 'EMAIL') return email || 'Email'
  if (method === 'LINK') return 'Shareable link'
  return '—'
}

function formatSends(scheduledAt: Date | null): string {
  if (!scheduledAt) return 'Now'
  return scheduledAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

interface SummaryRowProps {
  label: string
  value: string
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-ink font-medium text-right max-w-[55%] truncate">{value}</span>
    </div>
  )
}

interface LineItemProps {
  label: string
  amount: number
  bold?: boolean
}

function LineItem({ label, amount, bold }: LineItemProps) {
  return (
    <div className={['flex items-center justify-between py-2', bold ? 'font-semibold' : ''].join(' ')}>
      <span className={['text-sm', bold ? 'text-ink' : 'text-muted'].join(' ')}>{label}</span>
      <span className={['text-sm tabular-nums', bold ? 'text-ink text-base' : 'text-ink'].join(' ')}>
        ${amount.toFixed(2)}
      </span>
    </div>
  )
}

function CheckoutForm() {
  const navigate = useNavigate()
  const stripe = useStripe()
  const elements = useElements()
  const draft = useGiftStore()
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const giftAmount = draft.amount ?? 0
  const total = giftAmount + SERVICE_FEE

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Create or update gift on backend
      let giftId = draft.giftId
      if (!giftId) {
        const gift = await createGift(draft)
        giftId = gift.id
        draft.setGiftId(giftId)
      }

      // 2. Create payment intent
      const { clientSecret, paymentIntentId } = await createPaymentIntent(
        giftAmount,
        draft.brand?.id ?? '',
      )

      // 3. Confirm card payment with Stripe
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not found')

      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      })

      if (error) {
        setErrorMsg(error.message ?? 'Payment failed')
        return
      }

      // 4. Mark gift as paid
      await payGift(giftId, paymentIntentId)

      navigate('/sent')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Summary */}
      <div className="bg-white rounded-card border border-border shadow-warm px-4 divide-y divide-border">
        <SummaryRow label="To" value={draft.recipientName || '—'} />
        <SummaryRow
          label="Via"
          value={formatDelivery(draft.deliveryMethod, draft.recipientPhone, draft.recipientEmail)}
        />
        <SummaryRow label="Sends" value={formatSends(draft.scheduledAt)} />
        <SummaryRow label="Brand" value={draft.brand?.name ?? '—'} />
        <SummaryRow label="Amount" value={`$${(draft.amount ?? 0).toFixed(2)}`} />
        <SummaryRow label="Card design" value={`Design ${draft.cardDesignIndex + 1}`} />
      </div>

      {/* Line items */}
      <div className="bg-white rounded-card border border-border shadow-warm px-4 divide-y divide-border">
        <LineItem label="Gift card" amount={giftAmount} />
        <LineItem label="Service fee" amount={SERVICE_FEE} />
        <LineItem label="Total" amount={total} bold />
      </div>

      {/* Stripe card element */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Payment</p>
        <div className="bg-white rounded-input border border-border px-4 py-3.5 focus-within:border-terra focus-within:ring-2 focus-within:ring-terra/20 transition-all">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '14px',
                  color: '#1A1A1A',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  '::placeholder': { color: '#6B6459' },
                },
                invalid: { color: '#C75A3F' },
              },
            }}
          />
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-500 text-center -mt-3">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Processing…
          </>
        ) : (
          <>Send gift ${total.toFixed(2)} →</>
        )}
      </button>

      <p className="text-xs text-muted text-center -mt-2">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  )
}

export default function Review() {
  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={7} />

      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl text-ink leading-tight">
          Review & Pay
        </h1>
        <p className="text-sm text-muted mt-1">One last look before it's sent.</p>
      </div>

      <div className="px-6 pb-8">
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>
    </div>
  )
}
