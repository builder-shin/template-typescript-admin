import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import record from '../../../docs/provenance/copied-core.json'

describe('copied-core provenance', () => {
  it('40자 커밋 SHA 를 갖는다', () => {
    expect(record.commit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('기록된 경로가 전부 실재한다', () => {
    expect(record.paths.length).toBeGreaterThan(0)
    expect(() => execFileSync('bash', ['scripts/check-provenance.sh'])).not.toThrow()
  })
})
