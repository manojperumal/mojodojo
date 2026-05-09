import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGiftStore } from '../store/gift'
import CardPreview, { getDesignsForOccasion } from '../components/CardPreview'
import ProgressBar from '../components/ProgressBar'

const PRESET_AMOUNTS = [15, 25, 50, 100]

export default function AmountCard() {
  const navigate = useNavigate()
  const {
    occasion, brand, cardDesignIndex, amount,
    setCardDesignIndex, setAmount,
  } = useGiftStore()

  const [customAmount, setCustomAmount] = useState(
    amount && !PRESET_AMOUNTS.includes(amount) ? String(amount) : '',
  )
  const [isCustom, setIsCustom] = useState(
    amount !== null && !PRESET_AMOUNTS.includes(amount),
  )

  const designs = getDesignsForOccasion(occasion?.slug)
  const minAmount = brand?.minAmount ?? 5
  const maxAmount = brand?.maxAmount ?? 500

  function selectPreset(val: number) {
    setIsCustom(false)
    setCustomAmount('')
    setAmount(val)
  }

  function handleCustomInput(val: string) {
    setCustomAmount(val)
    const n = parseFloat(val)
    if (!isNaN(n) && n >= minAmount && n <= maxAmount) {
      setAmount(n)
    }
  }

  const selectedAmount = isCustom
    ? parseFloat(customAmount) || null
    : amount

  const canContinue =
    selectedAmount !== null &&
    selectedAmount >= minAmount &&
    selectedAmount <= maxAmount

  function handleContinue() {
    if (!canContinue) return
    navigate('/personalise')
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={3} />

      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl text-ink leading-tight">
          Choose amount & design
        </h1>
        {brand && (
          <p className="text-sm text-muted mt-1">
            {brand.name} · ${minAmount}–${maxAmount}
          </p>
        )}
      </div>

      {/* Card design swiper */}
      <div className="px-6 mb-5">
        <div
          className="overflow-x-auto scroll-smooth"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-4 pb-2" style={{ width: `calc(${designs.length} * (100% - 48px) + ${(designs.length - 1) * 16}px)` }}>
            {designs.map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 cursor-pointer"
                style={{
                  scrollSnapAlign: 'start',
                  width: 'calc(100vw - 48px)',
                  maxWidth: '432px',
                }}
                onClick={() => setCardDesignIndex(i)}
              >
                <div
                  className={[
                    'rounded-card overflow-hidden transition-all duration-200',
                    cardDesignIndex === i
                      ? 'ring-2 ring-terra ring-offset-2'
                      : 'opacity-80 hover:opacity-100',
                  ].join(' ')}
                >
                  <CardPreview
                    occasion={occasion}
                    brand={brand}
                    cardDesignIndex={i}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 mt-3">
          {designs.map((_, i) => (
            <button
              key={i}
              onClick={() => setCardDesignIndex(i)}
              className={[
                'w-1.5 h-1.5 rounded-full transition-all duration-200',
                cardDesignIndex === i ? 'bg-terra w-4' : 'bg-border',
              ].join(' ')}
              aria-label={`Design ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Amount chips */}
      <div className="px-6 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Amount</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_AMOUNTS.map((val) => (
            <button
              key={val}
              onClick={() => selectPreset(val)}
              className={[
                'px-4 py-2 rounded-chip text-sm font-medium border transition-all duration-150',
                !isCustom && amount === val
                  ? 'bg-terra text-white border-terra'
                  : 'bg-white text-ink border-border hover:border-terra/60',
              ].join(' ')}
            >
              ${val}
            </button>
          ))}
          <button
            onClick={() => { setIsCustom(true); setAmount(null as unknown as number) }}
            className={[
              'px-4 py-2 rounded-chip text-sm font-medium border transition-all duration-150',
              isCustom
                ? 'bg-terra text-white border-terra'
                : 'bg-white text-ink border-border hover:border-terra/60',
            ].join(' ')}
          >
            Custom
          </button>
        </div>

        {isCustom && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted">$</span>
            <input
              type="number"
              min={minAmount}
              max={maxAmount}
              step="1"
              value={customAmount}
              onChange={(e) => handleCustomInput(e.target.value)}
              placeholder={`${minAmount}–${maxAmount}`}
              className="w-32 px-3 py-2 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
              autoFocus
            />
            {customAmount && (parseFloat(customAmount) < minAmount || parseFloat(customAmount) > maxAmount) && (
              <span className="text-xs text-red-500">
                ${minAmount}–${maxAmount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-8">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full bg-terra text-white rounded-input py-3.5 text-sm font-semibold hover:bg-terra/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Personalise
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
