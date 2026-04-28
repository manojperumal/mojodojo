import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGift, nudgeGift, recallGift } from '../api/client'
import CardPreview from '../components/CardPreview'
import { GiftStatus } from '../types'

const STATUS_CONFIG: Record<GiftStatus, { label: string; classes: string }> = {
  [GiftStatus.DRAFT]:    { label: 'Draft',    classes: 'bg-gray-100 text-gray-600' },
  [GiftStatus.PAID]:     { label: 'Paid',     classes: 'bg-blue-50 text-blue-600' },
  [GiftStatus.SENT]:     { label: 'Sent',     classes: 'bg-yellow-50 text-yellow-700' },
  [GiftStatus.OPENED]:   { label: 'Opened',   classes: 'bg-green-50 text-green-700' },
  [GiftStatus.REDEEMED]: { label: 'Redeemed', classes: 'bg-terra/10 text-terra' },
  [GiftStatus.RECALLED]: { label: 'Recalled', classes: 'bg-red-50 text-red-600' },
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
}

export default function GiftDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [showRecallConfirm, setShowRecallConfirm] = useState(false)

  const { data: gift, isLoading, isError } = useQuery({
    queryKey: ['gift', id],
    queryFn: () => getGift(id!),
    enabled: Boolean(id),
  })

  const nudgeMutation = useMutation({
    mutationFn: () => nudgeGift(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['gift', id], updated)
    },
  })

  const recallMutation = useMutation({
    mutationFn: () => recallGift(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['gift', id], updated)
      setShowRecallConfirm(false)
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-8 animate-pulse">
        <div className="h-6 w-32 bg-border rounded-pill" />
        <div className="aspect-[3/2] rounded-card bg-border" />
        <div className="h-4 w-48 bg-border rounded-pill" />
      </div>
    )
  }

  if (isError || !gift) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-muted mb-4">Gift not found.</p>
        <Link to="/" className="text-sm text-terra underline underline-offset-2">
          Back to home
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[gift.status]

  const showNudge =
    (gift.status === GiftStatus.SENT || gift.status === GiftStatus.OPENED) &&
    !gift.openedAt &&
    !gift.nudgeSentAt &&
    gift.sentAt &&
    daysSince(gift.sentAt) >= 7

  const canRecall = gift.status !== GiftStatus.REDEEMED && gift.status !== GiftStatus.RECALLED

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Back nav */}
      <div className="px-6 pt-5 pb-2">
        <Link to="/" className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </div>

      <div className="px-6 pb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Gift for {gift.recipientName}</h1>
        <span className={['text-xs font-semibold px-2.5 py-1 rounded-pill', statusCfg.classes].join(' ')}>
          {statusCfg.label}
        </span>
      </div>

      {/* Card preview */}
      <div className="px-6 mt-3 mb-4">
        <CardPreview
          occasion={gift.occasion}
          brand={gift.brand}
          cardDesignIndex={gift.cardDesignIndex}
          message={gift.message}
          signatureData={gift.signatureData}
          signatureMode={gift.signatureMode}
        />
      </div>

      {/* Details */}
      <div className="px-6 bg-white border-y border-border divide-y divide-border mb-4">
        {[
          { label: 'Brand', value: gift.brand.name },
          { label: 'Amount', value: `$${gift.amount.toFixed(2)}` },
          { label: 'Occasion', value: `${gift.occasion.emoji} ${gift.occasion.label}` },
          { label: 'Delivery', value: gift.deliveryMethod },
          gift.sentAt && { label: 'Sent', value: new Date(gift.sentAt).toLocaleDateString() },
          gift.openedAt && { label: 'Opened', value: new Date(gift.openedAt).toLocaleDateString() },
          gift.redeemedAt && { label: 'Redeemed', value: new Date(gift.redeemedAt).toLocaleDateString() },
        ]
          .filter(Boolean)
          .map((row) => {
            if (!row) return null
            return (
              <div key={row.label} className="flex items-center justify-between py-3">
                <span className="text-sm text-muted">{row.label}</span>
                <span className="text-sm text-ink font-medium">{row.value}</span>
              </div>
            )
          })}
      </div>

      {/* Share URL */}
      {gift.shareUrl && (
        <div className="px-6 mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Share link</p>
          <div className="flex items-center gap-2 bg-white rounded-input border border-border px-3 py-2.5">
            <span className="text-xs text-muted truncate flex-1">{gift.shareUrl}</span>
            <button
              onClick={() => navigator.clipboard.writeText(gift.shareUrl)}
              className="text-xs text-terra font-medium flex-shrink-0 hover:text-terra/80 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Nudge */}
      {showNudge && (
        <div className="px-6 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-card p-4">
            <p className="text-sm text-yellow-800 mb-3">
              Not yet opened — it's been {gift.sentAt ? daysSince(gift.sentAt) : '7'}+ days.
              Want to send a friendly nudge?
            </p>
            <button
              onClick={() => nudgeMutation.mutate()}
              disabled={nudgeMutation.isPending}
              className="text-sm font-semibold text-yellow-800 underline underline-offset-2 disabled:opacity-50"
            >
              {nudgeMutation.isPending ? 'Sending…' : 'Send nudge'}
            </button>
          </div>
        </div>
      )}

      {nudgeMutation.isSuccess && (
        <p className="px-6 text-xs text-green-600 mb-4">Nudge sent!</p>
      )}

      {/* Recall */}
      {canRecall && (
        <div className="px-6 pb-8">
          {!showRecallConfirm ? (
            <button
              onClick={() => setShowRecallConfirm(true)}
              className="text-sm text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
            >
              Recall gift
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-card p-4">
              <p className="text-sm text-red-800 mb-4 font-medium">
                Are you sure? Recalling will cancel the gift and refund your payment.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => recallMutation.mutate()}
                  disabled={recallMutation.isPending}
                  className="flex-1 bg-red-600 text-white rounded-input py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {recallMutation.isPending ? 'Recalling…' : 'Yes, recall'}
                </button>
                <button
                  onClick={() => setShowRecallConfirm(false)}
                  className="flex-1 bg-white text-ink rounded-input py-2.5 text-sm font-medium border border-border hover:border-terra/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
              {recallMutation.isError && (
                <p className="text-xs text-red-600 mt-2">Something went wrong. Please try again.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
