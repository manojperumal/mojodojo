import { useCallback, useEffect, useRef } from 'react'

interface SignaturePadProps {
  onChange: (dataUrl: string) => void
}

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // Resize canvas to match display size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Capture existing image
    const imageData = canvas.width > 0 && canvas.height > 0
      ? ctx.getImageData(0, 0, canvas.width, canvas.height)
      : null

    const dpr = window.devicePixelRatio ?? 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Restore
    if (imageData) ctx.putImageData(imageData, 0, 0)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1A1A1A'
  }, [])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawing.current = true
    const pt = getPoint(e)
    lastPoint.current = pt

    if (pt) {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 1, 0, Math.PI * 2)
      ctx.fillStyle = '#1A1A1A'
      ctx.fill()
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pt = getPoint(e)
    if (!pt || !lastPoint.current) return

    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()

    lastPoint.current = pt
  }

  function onPointerUp() {
    if (!isDrawing.current) return
    isDrawing.current = false
    lastPoint.current = null
    emitChange()
  }

  function emitChange() {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  function handleClear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-input border border-border bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-24 touch-none cursor-crosshair block"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {/* Baseline guide */}
        <div className="absolute inset-x-4 bottom-4 h-px bg-border pointer-events-none" />
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="self-end text-xs text-muted hover:text-ink transition-colors underline underline-offset-2"
      >
        Clear
      </button>
    </div>
  )
}
