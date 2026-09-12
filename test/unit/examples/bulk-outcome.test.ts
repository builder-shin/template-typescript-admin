import { describe, expect, it } from 'vitest'
import { bucketForFailure } from '@/app/(admin)/examples/bulk-outcome'

describe('bucketForFailure', () => {
  it('RESOURCE_NOT_FOUND 는 alreadyGone 이다 - 재시도해도 지우려던 목적은 이미 달성됐다', () => {
    expect(bucketForFailure([{ status: '404', code: 'RESOURCE_NOT_FOUND' }])).toBe('alreadyGone')
  })

  it('세션 코드는 sessionLost 다 - 재시도가 아니라 재로그인이다', () => {
    expect(bucketForFailure([{ status: '401', code: 'TOKEN_EXPIRED' }])).toBe('sessionLost')
  })

  it('그 외(예: 500)는 retryable 이다', () => {
    expect(bucketForFailure([{ status: '500', code: 'INTERNAL_SERVER_ERROR' }])).toBe('retryable')
  })

  it('transport(합성 오류)도 retryable 이다', () => {
    expect(
      bucketForFailure([{ status: '0', code: 'NETWORK_ERROR', meta: { synthetic: true } }]),
    ).toBe('retryable')
  })

  it('오류 배열이 비어 있어도(actionForErrors([]) 는 banner) retryable 이다', () => {
    expect(bucketForFailure([])).toBe('retryable')
  })
})
