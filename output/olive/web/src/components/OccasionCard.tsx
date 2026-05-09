import type { Occasion } from '../types'

interface OccasionCardProps {
  occasion: Occasion
  selected?: boolean
  onClick: () => void
}

export default function OccasionCard({ occasion, selected, onClick }: OccasionCardProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center justify-center gap-2 rounded-card bg-white',
        'shadow-warm hover:-translate-y-0.5 hover:shadow-warm-lg',
        'transition-all duration-200 cursor-pointer select-none w-full',
        'aspect-[10/6.25] p-4',  // 16:10 ratio
        selected
          ? 'border-2 border-terra'
          : 'border border-border',
      ].join(' ')}
    >
      <span className="text-4xl leading-none">{occasion.emoji}</span>
      <span className="text-sm font-medium text-ink text-center leading-tight">
        {occasion.label}
      </span>
    </button>
  )
}
