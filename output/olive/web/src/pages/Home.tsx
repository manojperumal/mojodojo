import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getOccasions } from '../api/client'
import { useGiftStore } from '../store/gift'
import { useAuthStore } from '../store/auth'
import OccasionCard from '../components/OccasionCard'
import ProgressBar from '../components/ProgressBar'
import type { Occasion } from '../types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Fallback occasions so the UI never shows empty
const FALLBACK_OCCASIONS: Occasion[] = [
  { id: '1', slug: 'birthday', label: 'Birthday', emoji: '🎂', description: 'Celebrate their special day' },
  { id: '2', slug: 'graduation', label: 'Graduation', emoji: '🎓', description: 'Honour their achievement' },
  { id: '3', slug: 'celebration', label: 'Celebration', emoji: '🎉', description: 'Celebrate a milestone' },
  { id: '4', slug: 'thank-you', label: 'Thank You', emoji: '💛', description: 'Show your appreciation' },
  { id: '5', slug: 'thinking-of-you', label: 'Thinking of You', emoji: '💜', description: 'Let them know you care' },
  { id: '6', slug: 'just-because', label: 'Just Because', emoji: '☀️', description: 'No reason needed' },
]

export default function Home() {
  const navigate = useNavigate()
  const { setOccasion, occasion: selectedOccasion } = useGiftStore()
  const { user } = useAuthStore()

  const { data: occasions, isLoading, isError } = useQuery({
    queryKey: ['occasions'],
    queryFn: getOccasions,
  })

  const displayOccasions = (!occasions || isError) ? FALLBACK_OCCASIONS : occasions

  function handleSelect(occasion: Occasion) {
    setOccasion(occasion)
    navigate('/brand')
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={1} />

      <div className="px-6 pt-6 pb-4">
        <p className="text-sm text-muted mb-1">
          {getGreeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}.
        </p>
        <h1 className="font-display text-2xl text-ink leading-tight">
          What's the occasion?
        </h1>
      </div>

      {isLoading ? (
        <div className="px-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[10/6.25] rounded-card bg-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="px-6 grid grid-cols-2 gap-3 pb-8">
          {displayOccasions.map((occasion) => (
            <OccasionCard
              key={occasion.id}
              occasion={occasion}
              selected={selectedOccasion?.id === occasion.id}
              onClick={() => handleSelect(occasion)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
