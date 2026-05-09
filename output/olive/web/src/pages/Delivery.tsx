import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGiftStore } from '../store/gift'
import ProgressBar from '../components/ProgressBar'
import type { DeliveryMethod } from '../types'

interface OptionCardProps {
  value: DeliveryMethod
  label: string
  description: string
  icon: React.ReactNode
  selected: boolean
  onSelect: () => void
}

function OptionCard({ label, description, icon, selected, onSelect }: OptionCardProps) {
  return (
    <button
      onClick={onSelect}
      className={[
        'w-full flex items-start gap-4 p-4 rounded-card border text-left transition-all duration-150',
        selected
          ? 'border-terra bg-terra/5 shadow-warm'
          : 'border-border bg-white hover:border-terra/40',
      ].join(' ')}
    >
      <div className={['mt-0.5 flex-shrink-0 w-10 h-10 rounded-input flex items-center justify-center', selected ? 'bg-terra text-white' : 'bg-border/40 text-muted'].join(' ')}>
        {icon}
      </div>
      <div>
        <p className={['text-sm font-semibold', selected ? 'text-ink' : 'text-ink'].join(' ')}>
          {label}
        </p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className={[
        'ml-auto mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
        selected ? 'border-terra bg-terra' : 'border-border',
      ].join(' ')}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
    </button>
  )
}

function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function minDateTimeLocal(): string {
  return formatLocalDateTime(new Date())
}

export default function Delivery() {
  const navigate = useNavigate()
  const {
    deliveryMethod, recipientPhone, recipientEmail, scheduledAt,
    setDeliveryMethod, setRecipientPhone, setRecipientEmail, setScheduledAt,
  } = useGiftStore()

  const [isScheduled, setIsScheduled] = useState(scheduledAt !== null)

  function handleScheduleToggle(val: boolean) {
    setIsScheduled(val)
    if (!val) setScheduledAt(null)
  }

  function handleScheduledAtChange(value: string) {
    if (!value) {
      setScheduledAt(null)
      return
    }
    setScheduledAt(new Date(value))
  }

  const canContinue =
    deliveryMethod !== null &&
    (deliveryMethod === 'SMS' ? recipientPhone.trim().length >= 7 :
      deliveryMethod === 'EMAIL' ? recipientEmail.trim().includes('@') :
        true) &&
    (!isScheduled || scheduledAt !== null)

  function handleContinue() {
    if (!canContinue) return
    navigate('/preview')
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={5} />

      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl text-ink leading-tight">
          How to deliver?
        </h1>
        <p className="text-sm text-muted mt-1">Choose how your recipient receives the gift.</p>
      </div>

      <div className="px-6 flex flex-col gap-3 mb-6">
        <OptionCard
          value="SMS"
          label="Text message"
          description="Send via SMS. Your recipient gets a link to their phone."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
            </svg>
          }
          selected={deliveryMethod === 'SMS'}
          onSelect={() => setDeliveryMethod('SMS')}
        />

        {deliveryMethod === 'SMS' && (
          <div className="px-2">
            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
              autoFocus
            />
          </div>
        )}

        <OptionCard
          value="EMAIL"
          label="Email"
          description="Send a beautifully formatted email with the gift inside."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
            </svg>
          }
          selected={deliveryMethod === 'EMAIL'}
          onSelect={() => setDeliveryMethod('EMAIL')}
        />

        {deliveryMethod === 'EMAIL' && (
          <div className="px-2">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="friend@example.com"
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
              autoFocus
            />
          </div>
        )}

        <OptionCard
          value="LINK"
          label="Shareable link"
          description="Get a link you can share however you like — iMessage, WhatsApp, anywhere."
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 1 0 5.656l-2.828 2.828a4 4 0 1 1-5.656-5.656l1.242-1.243M10.172 13.828a4 4 0 0 1 0-5.656l2.828-2.828a4 4 0 1 1 5.656 5.656l-1.243 1.242" />
            </svg>
          }
          selected={deliveryMethod === 'LINK'}
          onSelect={() => setDeliveryMethod('LINK')}
        />
      </div>

      {/* Send timing */}
      <div className="px-6 mb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">When to send</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleScheduleToggle(false)}
            className={[
              'flex-1 py-2.5 rounded-chip text-sm font-medium border transition-all duration-150',
              !isScheduled ? 'bg-terra text-white border-terra' : 'bg-white text-ink border-border hover:border-terra/40',
            ].join(' ')}
          >
            Send now
          </button>
          <button
            onClick={() => handleScheduleToggle(true)}
            className={[
              'flex-1 py-2.5 rounded-chip text-sm font-medium border transition-all duration-150',
              isScheduled ? 'bg-terra text-white border-terra' : 'bg-white text-ink border-border hover:border-terra/40',
            ].join(' ')}
          >
            Schedule
          </button>
        </div>

        {isScheduled && (
          <div className="mt-3">
            <input
              type="datetime-local"
              min={minDateTimeLocal()}
              value={scheduledAt ? formatLocalDateTime(scheduledAt) : ''}
              onChange={(e) => handleScheduledAtChange(e.target.value)}
              className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
            />
          </div>
        )}
      </div>

      <div className="px-6 pb-8">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Preview
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
