import { describe, expect, it } from 'vitest'
import { resolveBackendKind } from '@/test/e2e/matrix'

describe('resolveBackendKind', () => {
  it('셋을 받는다', () => {
    expect(['fastapi', 'nestjs', 'rails'].map(resolveBackendKind)).toEqual([
      'fastapi',
      'nestjs',
      'rails',
    ])
  })

  it('기본은 정본이다', () => {
    expect(resolveBackendKind(undefined)).toBe('fastapi')
  })

  it('셋 밖의 값은 도커를 건드리기 전에 던진다', () => {
    expect(() => resolveBackendKind('fastpai')).toThrow(/fastapi/)
  })
})
