import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getBrands } from '../api/client'
import { useGiftStore } from '../store/gift'
import BrandTile from '../components/BrandTile'
import ProgressBar from '../components/ProgressBar'
import type { Brand } from '../types'

export default function BrandPicker() {
  const navigate = useNavigate()
  const { occasion, brand: selectedBrand, setBrand } = useGiftStore()
  const [search, setSearch] = useState('')

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
  })

  const query = search.trim().toLowerCase()

  const filtered = query
    ? brands.filter((b) => b.name.toLowerCase().includes(query))
    : brands

  const recommended = !query
    ? brands.filter((b) =>
        occasion ? b.occasions.includes(occasion.slug) : true
      ).slice(0, 6)
    : []

  const allBrands = filtered

  function handleSelect(brand: Brand) {
    setBrand(brand)
    navigate('/amount')
  }

  return (
    <div className="flex flex-col animate-fade-in">
      <ProgressBar step={2} />

      <div className="px-6 pt-6 pb-4">
        <h1 className="font-display text-2xl text-ink leading-tight mb-1">
          Pick a gift card
        </h1>
        {occasion && (
          <p className="text-sm text-muted">
            {occasion.emoji} Browsing for {occasion.label.toLowerCase()}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="px-6 mb-5">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="w-full pl-9 pr-4 py-2.5 rounded-input border border-border bg-white text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-card bg-border animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Recommended section */}
          {recommended.length > 0 && (
            <div className="mb-6">
              <h2 className="px-6 text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Recommended for {occasion?.label}
              </h2>
              <div className="px-6 overflow-x-auto">
                <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
                  {recommended.map((brand) => (
                    <div key={brand.id} className="w-28 flex-shrink-0">
                      <BrandTile
                        brand={brand}
                        selected={selectedBrand?.id === brand.id}
                        onClick={() => handleSelect(brand)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* All brands */}
          <div className="px-6 pb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              {query ? `Results for "${search}"` : 'All Brands'}
            </h2>
            {allBrands.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                No brands found for "{search}"
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {allBrands.map((brand) => (
                  <BrandTile
                    key={brand.id}
                    brand={brand}
                    selected={selectedBrand?.id === brand.id}
                    onClick={() => handleSelect(brand)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
