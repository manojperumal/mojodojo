import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGiftStore } from '../store/gift'
import CardPreview from '../components/CardPreview'
import SignaturePad from '../components/SignaturePad'
import ProgressBar from '../components/ProgressBar'
import type { SignatureMode } from '../types'

const MAX_MESSAGE = 300
const WARN_AT = 240

const SIGNATURE_FONTS = [
  { name: 'Caveat', label: 'Casual' },
  { name: 'Dancing Script', label: 'Elegant' },
  { name: 'Homemade Apple', label: 'Classic' },
  { name: 'Reenie Beanie', label: 'Playful' },
]

const MONOGRAM_STYLES = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
]

interface MonogramProps {
  initials: string
  style: 'circle' | 'square'
  selected: boolean
  onClick: () => void
}

function MonogramOption({ initials, style, selected, onClick }: MonogramProps) {
  const base = 'w-14 h-14 flex items-center justify-center text-xl font-bold text-white bg-terra cursor-pointer transition-all duration-150'
  const shape = style === 'circle' ? 'rounded-full' : 'rounded-input'
  return (
    <button
      onClick={onClick}
      className={[
        base,
        shape,
        selected ? 'ring-2 ring-terra ring-offset-2' : 'opacity-60 hover:opacity-90',
      ].join(' ')}
    >
      {initials || '??'}
    </button>
  )
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

export default function Personalise() {
  const navigate = useNavigate()
  const {
    occasion, brand, cardDesignIndex,
    recipientName, message, signatureMode, signatureData,
    setRecipientName, setMessage, setSignatureMode, setSignatureData,
  } = useGiftStore()

  const [monogramStyle, setMonogramStyle] = useState<'circle' | 'square'>('circle')

  function handleSignatureModeChange(mode: SignatureMode) {
    setSignatureMode(mode)
    // Set sensible default data per mode
    if (mode === 'STYLE') setSignatureData('Caveat')
    if (mode === 'DRAW') setSignatureData('')
    if (mode === 'INITIALS') setSignatureData(getInitials(recipientName) || 'YN')
  }

  function handleMonogramSelect(style: 'circle' | 'square') {
    setMonogramStyle(style)
    setSignatureData(getInitials(recipientName) || 'YN')
  }

  const canContinue = recipientName.trim().length > 0

  function handleContinue() {
    if (!canContinue) return
    navigate('/delivery')
  }

  const charCount = message.length
  const charWarning = charCount >= WARN_AT

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={4} />

      {/* Live card preview */}
      <div className="px-6 pt-6 pb-4">
        <CardPreview
          occasion={occasion}
          brand={brand}
          cardDesignIndex={cardDesignIndex}
          message={message}
          signatureData={signatureData}
          signatureMode={signatureMode}
        />
      </div>

      <div className="px-6 pt-2 pb-8 flex flex-col gap-5">
        {/* Recipient name */}
        <div>
          <label htmlFor="recipient-name" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            To
          </label>
          <input
            id="recipient-name"
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Recipient's name"
            className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
          />
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="message" className="text-xs font-semibold text-muted uppercase tracking-wider">
              Message
            </label>
            <span className={['text-xs tabular-nums', charWarning ? 'text-terra font-medium' : 'text-muted'].join(' ')}>
              {charCount}/{MAX_MESSAGE}
            </span>
          </div>
          <textarea
            id="message"
            rows={4}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write something heartfelt…"
            className="w-full px-4 py-3 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors resize-none"
          />
        </div>

        {/* Signature */}
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Signature</p>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-border/40 rounded-chip p-1 mb-4">
            {(['STYLE', 'DRAW', 'INITIALS'] as SignatureMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSignatureModeChange(mode)}
                className={[
                  'flex-1 py-1.5 rounded-[6px] text-xs font-semibold transition-all duration-150',
                  signatureMode === mode
                    ? 'bg-white text-ink shadow-warm'
                    : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Style: font pickers */}
          {signatureMode === 'STYLE' && (
            <div className="grid grid-cols-2 gap-2">
              {SIGNATURE_FONTS.map(({ name, label }) => (
                <button
                  key={name}
                  onClick={() => setSignatureData(name)}
                  className={[
                    'px-3 py-3 rounded-input border text-left transition-all duration-150',
                    signatureData === name
                      ? 'border-terra bg-terra/5'
                      : 'border-border bg-white hover:border-terra/40',
                  ].join(' ')}
                >
                  <span
                    className="block text-base text-ink mb-0.5"
                    style={{ fontFamily: `'${name}', cursive` }}
                  >
                    {recipientName || 'Your name'}
                  </span>
                  <span className="text-xs text-muted">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Draw: canvas */}
          {signatureMode === 'DRAW' && (
            <SignaturePad onChange={(dataUrl) => setSignatureData(dataUrl)} />
          )}

          {/* Initials: monogram styles */}
          {signatureMode === 'INITIALS' && (
            <div className="flex gap-4 items-center">
              {MONOGRAM_STYLES.map(({ id, label }) => (
                <div key={id} className="flex flex-col items-center gap-1.5">
                  <MonogramOption
                    initials={getInitials(recipientName) || 'YN'}
                    style={id as 'circle' | 'square'}
                    selected={monogramStyle === id}
                    onClick={() => handleMonogramSelect(id as 'circle' | 'square')}
                  />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
        >
          Delivery
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
