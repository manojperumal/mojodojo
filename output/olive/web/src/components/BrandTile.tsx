import type { Brand } from '../types'

interface BrandTileProps {
  brand: Brand
  selected?: boolean
  onClick: () => void
}

export default function BrandTile({ brand, selected, onClick }: BrandTileProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center justify-center gap-2 rounded-card bg-white',
        'shadow-warm hover:-translate-y-0.5 hover:shadow-warm-lg',
        'transition-all duration-200 cursor-pointer select-none w-full p-4',
        selected
          ? 'border-2 border-terra'
          : 'border border-border',
      ].join(' ')}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-terra flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="w-16 h-12 flex items-center justify-center">
        <img
          src={brand.logoUrl}
          alt={brand.name}
          className="max-w-full max-h-full object-contain"
          onError={(e) => {
            const target = e.currentTarget
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div
          className="hidden w-full h-full items-center justify-center text-xl font-semibold text-terra"
          aria-hidden="true"
        >
          {brand.name.charAt(0)}
        </div>
      </div>

      <span className="text-xs font-medium text-ink text-center leading-tight line-clamp-2">
        {brand.name}
      </span>
    </button>
  )
}
