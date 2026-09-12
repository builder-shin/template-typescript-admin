import { describe, expect, it } from 'vitest'
import { probeEmail } from '@/test/e2e/probe-email'

describe('probeEmail', () => {
  it('로컬 파트가 64자를 넘지 않는다', () => {
    const email = probeEmail('bulk-partial-failure-scenario-with-a-long-name')
    expect(email.split('@')[0]!.length).toBeLessThanOrEqual(64)
  })

  it('호출마다 다르다', () => {
    expect(probeEmail('x')).not.toBe(probeEmail('x'))
  })
})
