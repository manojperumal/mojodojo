import type { Brand, CardDesign, Occasion, SignatureMode } from '../types'

interface CardPreviewProps {
  occasion: Occasion | null
  brand: Brand | null
  cardDesignIndex: number
  message?: string
  signatureData?: string
  signatureMode?: SignatureMode
  large?: boolean
}

// Static card design definitions — 4 per occasion slug.
// When no previewImageUrl is available we use CSS gradients + emoji.
const DESIGNS: Record<string, CardDesign[]> = {
  birthday: [
    { id: 'b0', occasionSlug: 'birthday', index: 0, name: 'Confetti', gradientFrom: '#FDE68A', gradientTo: '#FBBF24', accentColor: '#D97706', emoji: '🎂' },
    { id: 'b1', occasionSlug: 'birthday', index: 1, name: 'Balloon', gradientFrom: '#FBCFE8', gradientTo: '#F9A8D4', accentColor: '#EC4899', emoji: '🎈' },
    { id: 'b2', occasionSlug: 'birthday', index: 2, name: 'Star', gradientFrom: '#DDD6FE', gradientTo: '#A78BFA', accentColor: '#7C3AED', emoji: '✨' },
    { id: 'b3', occasionSlug: 'birthday', index: 3, name: 'Party', gradientFrom: '#BBF7D0', gradientTo: '#6EE7B7', accentColor: '#059669', emoji: '🥳' },
  ],
  graduation: [
    { id: 'g0', occasionSlug: 'graduation', index: 0, name: 'Gold', gradientFrom: '#FEF3C7', gradientTo: '#FCD34D', accentColor: '#B45309', emoji: '🎓' },
    { id: 'g1', occasionSlug: 'graduation', index: 1, name: 'Navy', gradientFrom: '#DBEAFE', gradientTo: '#93C5FD', accentColor: '#1D4ED8', emoji: '📜' },
    { id: 'g2', occasionSlug: 'graduation', index: 2, name: 'Sage', gradientFrom: '#D1FAE5', gradientTo: '#6EE7B7', accentColor: '#065F46', emoji: '🌿' },
    { id: 'g3', occasionSlug: 'graduation', index: 3, name: 'Blush', gradientFrom: '#FCE7F3', gradientTo: '#F9A8D4', accentColor: '#BE185D', emoji: '🌸' },
  ],
  celebration: [
    { id: 'c0', occasionSlug: 'celebration', index: 0, name: 'Champagne', gradientFrom: '#FEF9C3', gradientTo: '#FDE047', accentColor: '#A16207', emoji: '🥂' },
    { id: 'c1', occasionSlug: 'celebration', index: 1, name: 'Firework', gradientFrom: '#EDE9FE', gradientTo: '#C4B5FD', accentColor: '#6D28D9', emoji: '🎆' },
    { id: 'c2', occasionSlug: 'celebration', index: 2, name: 'Coral', gradientFrom: '#FED7AA', gradientTo: '#FB923C', accentColor: '#C2410C', emoji: '🎉' },
    { id: 'c3', occasionSlug: 'celebration', index: 3, name: 'Mint', gradientFrom: '#CCFBF1', gradientTo: '#5EEAD4', accentColor: '#0F766E', emoji: '🍾' },
  ],
  'thank-you': [
    { id: 't0', occasionSlug: 'thank-you', index: 0, name: 'Warm', gradientFrom: '#FEF3C7', gradientTo: '#FCA5A5', accentColor: '#B91C1C', emoji: '💛' },
    { id: 't1', occasionSlug: 'thank-you', index: 1, name: 'Bloom', gradientFrom: '#FCE7F3', gradientTo: '#FDE68A', accentColor: '#D97706', emoji: '🌻' },
    { id: 't2', occasionSlug: 'thank-you', index: 2, name: 'Sky', gradientFrom: '#E0F2FE', gradientTo: '#7DD3FC', accentColor: '#0369A1', emoji: '☁️' },
    { id: 't3', occasionSlug: 'thank-you', index: 3, name: 'Earth', gradientFrom: '#FEF9EE', gradientTo: '#D6D3D1', accentColor: '#57534E', emoji: '🙏' },
  ],
  'thinking-of-you': [
    { id: 'toy0', occasionSlug: 'thinking-of-you', index: 0, name: 'Lavender', gradientFrom: '#F3E8FF', gradientTo: '#D8B4FE', accentColor: '#7E22CE', emoji: '💜' },
    { id: 'toy1', occasionSlug: 'thinking-of-you', index: 1, name: 'Cloud', gradientFrom: '#F0F9FF', gradientTo: '#BAE6FD', accentColor: '#0284C7', emoji: '🌙' },
    { id: 'toy2', occasionSlug: 'thinking-of-you', index: 2, name: 'Rose', gradientFrom: '#FFF1F2', gradientTo: '#FECDD3', accentColor: '#E11D48', emoji: '🌹' },
    { id: 'toy3', occasionSlug: 'thinking-of-you', index: 3, name: 'Meadow', gradientFrom: '#F0FDF4', gradientTo: '#BBF7D0', accentColor: '#15803D', emoji: '🍀' },
  ],
  'just-because': [
    { id: 'jb0', occasionSlug: 'just-because', index: 0, name: 'Sunshine', gradientFrom: '#FFFBEB', gradientTo: '#FDE68A', accentColor: '#D97706', emoji: '☀️' },
    { id: 'jb1', occasionSlug: 'just-because', index: 1, name: 'Ocean', gradientFrom: '#EFF6FF', gradientTo: '#BFDBFE', accentColor: '#1D4ED8', emoji: '🌊' },
    { id: 'jb2', occasionSlug: 'just-because', index: 2, name: 'Berry', gradientFrom: '#FDF4FF', gradientTo: '#E879F9', accentColor: '#A21CAF', emoji: '🫐' },
    { id: 'jb3', occasionSlug: 'just-because', index: 3, name: 'Peach', gradientFrom: '#FFF7ED', gradientTo: '#FDBA74', accentColor: '#EA580C', emoji: '🍑' },
  ],
}

const FALLBACK_DESIGNS: CardDesign[] = [
  { id: 'f0', occasionSlug: 'fallback', index: 0, name: 'Classic', gradientFrom: '#FBF8F3', gradientTo: '#E8E3DB', accentColor: '#C75A3F', emoji: '✦' },
  { id: 'f1', occasionSlug: 'fallback', index: 1, name: 'Warm', gradientFrom: '#FEF3C7', gradientTo: '#FDE68A', accentColor: '#D97706', emoji: '🌟' },
  { id: 'f2', occasionSlug: 'fallback', index: 2, name: 'Blush', gradientFrom: '#FCE7F3', gradientTo: '#FBCFE8', accentColor: '#BE185D', emoji: '🌸' },
  { id: 'f3', occasionSlug: 'fallback', index: 3, name: 'Sage', gradientFrom: '#D1FAE5', gradientTo: '#A7F3D0', accentColor: '#065F46', emoji: '🌿' },
]

export function getDesignsForOccasion(occasionSlug: string | undefined): CardDesign[] {
  if (!occasionSlug) return FALLBACK_DESIGNS
  return DESIGNS[occasionSlug] ?? FALLBACK_DESIGNS
}

function SignatureDisplay({
  mode,
  data,
}: {
  mode: SignatureMode
  data: string
}) {
  if (mode === 'DRAW' && data.startsWith('data:')) {
    return (
      <img
        src={data}
        alt="Signature"
        className="max-h-8 max-w-full object-contain"
      />
    )
  }
  if (mode === 'INITIALS') {
    return (
      <span className="text-sm font-semibold tracking-widest opacity-80">{data}</span>
    )
  }
  // STYLE — data is the font name
  return (
    <span
      className="text-lg opacity-80"
      style={{ fontFamily: `'${data}', cursive` }}
    >
      {data}
    </span>
  )
}

export default function CardPreview({
  occasion,
  brand,
  cardDesignIndex,
  message,
  signatureData,
  signatureMode,
  large = false,
}: CardPreviewProps) {
  const designs = getDesignsForOccasion(occasion?.slug)
  const safeIndex = Math.min(cardDesignIndex, designs.length - 1)
  const design = designs[safeIndex]

  const heightClass = large ? 'aspect-[3/2] w-full' : 'aspect-[3/2] w-full'

  return (
    <div
      className={[
        heightClass,
        'rounded-card relative overflow-hidden transition-all duration-500 select-none',
        large ? 'shadow-warm-lg' : 'shadow-warm',
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, ${design.gradientFrom}, ${design.gradientTo})`,
      }}
    >
      {/* Decorative pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 20%, ${design.accentColor} 0%, transparent 50%), radial-gradient(circle at 20% 80%, ${design.accentColor} 0%, transparent 40%)`,
        }}
      />

      {/* Occasion emoji — top left */}
      <div className="absolute top-4 left-4 text-3xl leading-none" aria-hidden="true">
        {occasion?.emoji ?? design.emoji}
      </div>

      {/* Design name pill — top right */}
      <div
        className="absolute top-4 right-4 px-2 py-0.5 rounded-pill text-xs font-medium opacity-70"
        style={{ backgroundColor: design.accentColor + '33', color: design.accentColor }}
      >
        {design.name}
      </div>

      {/* Message area */}
      {message && (
        <div className="absolute inset-x-4 top-14 bottom-14 flex items-center justify-center">
          <p
            className="text-sm leading-relaxed text-center opacity-90 line-clamp-5"
            style={{ color: design.accentColor }}
          >
            {message}
          </p>
        </div>
      )}

      {/* Brand logo — bottom right */}
      {brand && (
        <div className="absolute bottom-4 right-4 w-12 h-8 flex items-center justify-end">
          <img
            src={brand.logoUrl}
            alt={brand.name}
            className="max-w-full max-h-full object-contain opacity-80"
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const fallback = target.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.display = 'block'
            }}
          />
          <span
            className="hidden text-xs font-semibold opacity-70"
            style={{ color: design.accentColor }}
          >
            {brand.name}
          </span>
        </div>
      )}

      {/* Signature — bottom left */}
      {signatureData && signatureMode && (
        <div
          className="absolute bottom-4 left-4"
          style={{ color: design.accentColor }}
        >
          <SignatureDisplay mode={signatureMode} data={signatureData} />
        </div>
      )}
    </div>
  )
}
