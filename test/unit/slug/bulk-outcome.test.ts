import { describe, expect, it } from 'vitest'
import { bucketForFailure, isAlreadyGone } from '@/app/(admin)/[slug]/bulk-outcome'

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

describe('isAlreadyGone', () => {
  // 단건 삭제(app/(admin)/[slug]/actions.ts 의 deleteResourceAction)와
  // 일괄 삭제(bucketForFailure 의 alreadyGone 갈래) 둘 다 이 판정을 공유한다 -
  // 여기서 한 번만 잰다.
  it('RESOURCE_NOT_FOUND 면 참이다 - 그 행은 이미 없다', () => {
    expect(isAlreadyGone([{ status: '404', code: 'RESOURCE_NOT_FOUND' }])).toBe(true)
  })

  it('그 외(예: 500)는 거짓이다', () => {
    expect(isAlreadyGone([{ status: '500', code: 'INTERNAL_SERVER_ERROR' }])).toBe(false)
  })

  it('세션 코드도 거짓이다 - alreadyGone 이 아니라 sessionLost 로 갈라져야 한다', () => {
    expect(isAlreadyGone([{ status: '401', code: 'TOKEN_EXPIRED' }])).toBe(false)
  })
})
