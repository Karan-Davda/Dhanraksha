import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0)
  const startTime = useRef(0)
  const raf = useRef(0)

  useEffect(() => {
    const start = 0
    const end = target

    startTime.current = performance.now()

    function step(now: number) {
      const elapsed = now - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(start + (end - start) * eased)

      if (progress < 1) {
        raf.current = requestAnimationFrame(step)
      }
    }

    raf.current = requestAnimationFrame(step)

    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}
