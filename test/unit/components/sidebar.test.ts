import { describe, expect, it } from 'vitest'
import { operatorFromDocument, operatorFromResult, operatorRequest } from '@/app/(admin)/operator'

describe('operatorRequest', () => {
  it('accessToken 을 Authorization 으로 싣는다', () => {
    const [path, options] = operatorRequest('token-abc', null)
    expect(path).toBe('/api/v1/users/me')
    expect(options.accessToken).toBe('token-abc')
  })

  it('Accept-Language 를 넘기면 그 값이 옵션에 실린다', () => {
    const [, options] = operatorRequest('token-abc', 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })
})

describe('operatorFromDocument', () => {
  it('이메일을 뽑는다', () => {
    expect(
      operatorFromDocument({
        data: {
          type: 'users',
          id: 'u1',
          attributes: { email: 'ops@example.com', isActive: true },
        },
      }),
    ).toEqual({ email: 'ops@example.com' })
  })

  it('이메일이 없으면 null 이다 - 대체 문구를 만들지 않는다', () => {
    // 계약 위반이지만 화면이 죽지는 않아야 한다. "알 수 없는 사용자" 같은
    // 문구를 지어내는 대신 그 자리를 비운다(layout.tsx 가 이 null 을 받아
    // 그렇게 다룬다).
    expect(operatorFromDocument({ data: { type: 'users', id: 'u1' } })).toBeNull()
  })

  it('이메일이 문자열이 아니면 null 이다', () => {
    expect(
      operatorFromDocument({ data: { type: 'users', id: 'u1', attributes: { email: 42 } } }),
    ).toBeNull()
  })
})

describe('operatorFromResult', () => {
  it('성공 응답에서 운영자를 뽑는다', () => {
    const result = operatorFromResult({
      ok: true,
      status: 200,
      document: { data: { type: 'users', id: 'u1', attributes: { email: 'ops@example.com' } } },
    })
    expect(result).toEqual({ email: 'ops@example.com' })
  })

  it('실패 응답이면 null 이다 - 화면을 끌고 내려가지 않는다', () => {
    expect(operatorFromResult({ ok: false, status: 500, errors: [] })).toBeNull()
  })

  it('204(본문 없음)면 null 이다', () => {
    expect(operatorFromResult({ ok: true, status: 204, document: null })).toBeNull()
  })
})
