interface ProgressBarProps {
  step: number  // 1-8
}

const TOTAL_STEPS = 8

export default function ProgressBar({ step }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((step / TOTAL_STEPS) * 100))

  return (
    <div className="w-full px-6 pt-3 pb-1">
      <div className="h-0.5 w-full bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-terra rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted text-right">
        Step {step} of {TOTAL_STEPS}
      </p>
    </div>
  )
}
