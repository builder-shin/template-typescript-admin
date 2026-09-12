import { describe, expect, it } from 'vitest'
import { messageForReadFailure } from '@/app/(admin)/read-result'

describe('messageForReadFailure', () => {
  it('transport 오류(합성됨)는 던진다 - error.tsx 로 보낸다', () => {
    const errors = [
      { status: '0', code: 'NETWORK_ERROR', title: 'NETWORK_ERROR', meta: { synthetic: true } },
    ]
    expect(() => messageForReadFailure(errors, '기본 문구')).toThrow()
  })

  it('던지는 메시지에는 client.ts 가 합성한 영어 detail 을 담지 않는다', () => {
    const errors = [
      {
        status: '0',
        code: 'NETWORK_ERROR',
        title: 'NETWORK_ERROR',
        detail: 'The backend could not be reached.',
        meta: { synthetic: true },
      },
    ]
    try {
      messageForReadFailure(errors, '기본 문구')
      throw new Error('여기 도달하면 안 된다 - 위에서 이미 던졌어야 한다')
    } catch (error) {
      expect((error as Error).message).not.toContain('The backend could not be reached')
    }
  })

  it('백엔드가 실제로 응답해 거절한 오류(검증 오류 등)는 던지지 않고 detail 을 그대로 돌려준다', () => {
    const errors = [
      {
        status: '422',
        code: 'VALIDATION_ERROR',
        title: '검증 실패',
        detail: '정렬 필드가 올바르지 않습니다.',
      },
    ]
    expect(messageForReadFailure(errors, '기본 문구')).toBe('정렬 필드가 올바르지 않습니다.')
  })

  it('detail 이 없으면 title 로, title 도 없으면 code 로 내려간다', () => {
    expect(
      messageForReadFailure(
        [{ status: '500', code: 'INTERNAL_SERVER_ERROR', title: '서버 오류' }],
        '기본 문구',
      ),
    ).toBe('서버 오류')
    expect(
      messageForReadFailure([{ status: '500', code: 'INTERNAL_SERVER_ERROR' }], '기본 문구'),
    ).toBe('INTERNAL_SERVER_ERROR')
  })

  it('오류 배열이 비어 있으면(actionForErrors([]) 는 banner) fallback 을 돌려준다', () => {
    expect(messageForReadFailure([], '기본 문구')).toBe('기본 문구')
  })
})
