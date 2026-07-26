import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync('src/index.css', 'utf8')

describe('motion accessibility', () => {
  it('disables non-essential motion when reduced motion is preferred', () => {
    const reducedMotionRules = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(reducedMotionRules).toContain('scroll-behavior: auto !important')
    expect(reducedMotionRules).toContain('animation-duration: 0.01ms !important')
    expect(reducedMotionRules).toContain('transition-duration: 0.01ms !important')
  })
})
