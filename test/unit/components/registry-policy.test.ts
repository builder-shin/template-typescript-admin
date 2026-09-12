import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PURE_MARKUP = ['components/ui/table.tsx', 'components/ui/label.tsx']

describe('레지스트리 부품의 use client 정책', () => {
  it.each(PURE_MARKUP)('%s 에 use client 가 없다', (path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(/^\s*['"]use client['"]/m)
  })
})
