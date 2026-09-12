import { describe, expect, it } from 'vitest'
import { mergeRetryReport, summarize } from '@/components/grid/bulk-result'

const failed = (id: string, status: string, code: string) => ({
  id,
  ok: false,
  errors: [{ status, code, detail: 'x' }],
})

describe('summarize', () => {
  it('성공과 실패를 따로 센다', () => {
    const report = {
      outcomes: [
        { id: 'a', ok: true },
        failed('b', '500', 'INTERNAL_SERVER_ERROR'),
        { id: 'c', ok: true },
      ],
      cancelled: false,
    }
    expect(summarize(report)).toEqual({
      ok: 2,
      failed: 1,
      alreadyGone: [],
      retryable: ['b'],
      sessionLost: false,
      cancelled: false,
    })
  })

  it('이미 없는 행은 재시도 대상이 아니다 - 의도가 이미 달성됐다', () => {
    // 최빈 실패다. 재시도 버튼에 넣으면 운영자는 영원히 지워지지 않는
    // 행을 계속 누르게 된다 - 실제로는 처음부터 지워져 있었다.
    const s = summarize({ outcomes: [failed('b', '404', 'RESOURCE_NOT_FOUND')], cancelled: false })
    expect(s.alreadyGone).toEqual(['b'])
    expect(s.retryable).toEqual([])
  })

  it('세션이 죽으면 재시도가 아니라 재로그인이다', () => {
    // 남은 전건이 같은 401 을 받는다. actionForErrors 가 destroySession 을 준다.
    const s = summarize({ outcomes: [failed('b', '401', 'TOKEN_EXPIRED')], cancelled: false })
    expect(s.sessionLost).toBe(true)
    expect(s.retryable).toEqual([])
  })

  it('성공한 건은 다시 보내지 않는다', () => {
    const s = summarize({
      outcomes: [{ id: 'a', ok: true }, failed('b', '503', 'HTTP_ERROR')],
      cancelled: false,
    })
    expect(s.retryable).toEqual(['b'])
  })

  it('전건 성공이면 재시도 대상이 없다', () => {
    const s = summarize({ outcomes: [{ id: 'a', ok: true }], cancelled: false })
    expect(s).toEqual({
      ok: 1,
      failed: 0,
      alreadyGone: [],
      retryable: [],
      sessionLost: false,
      cancelled: false,
    })
  })

  it('문구도 코드도 없는 실패는 재시도 대상이다 - 삼켜서 사라지게 하지 않는다', () => {
    // `{ ok: false }` 에 errors 가 없을 수 있다(변환이 오류 문서를 못 얻은 경우).
    // 분류할 근거가 없으면 alreadyGone·sessionLost 로 넘길 수 없으니 재시도로 둔다 -
    // 어느 통에도 안 넣으면 그 행이 표에서 소리 없이 사라진다.
    const s = summarize({ outcomes: [{ id: 'b', ok: false }], cancelled: false })
    expect(s.failed).toBe(1)
    expect(s.retryable).toEqual(['b'])
  })
})

describe('mergeRetryReport', () => {
  it('재시도한 건만 새 결과로 갈아 끼우고 나머지는 그대로 둔다', () => {
    // 재시도 대상이 아니었던 a·c(성공·이미 없음)는 재시도 보고서에 아예
    // 나타나지 않는다 - 표 전체를 재시도 보고서로 바꾸면 이 둘의 결과가
    // 화면에서 사라진다(토스트로 뭉개지 않는다는 원칙이 재시도에도 적용된다).
    const previous = {
      outcomes: [
        { id: 'a', ok: true },
        failed('b', '500', 'INTERNAL_SERVER_ERROR'),
        failed('c', '404', 'RESOURCE_NOT_FOUND'),
      ],
      cancelled: false,
    }
    const retry = { outcomes: [{ id: 'b', ok: true }], cancelled: false }
    expect(mergeRetryReport(previous, retry)).toEqual({
      outcomes: [
        { id: 'a', ok: true },
        { id: 'b', ok: true },
        failed('c', '404', 'RESOURCE_NOT_FOUND'),
      ],
      cancelled: false,
    })
  })

  it('원래 순서를 지킨다 - 재시도 보고서의 순서를 따르지 않는다', () => {
    const previous = {
      outcomes: [failed('a', '500', 'HTTP_ERROR'), failed('b', '500', 'HTTP_ERROR')],
      cancelled: false,
    }
    // 재시도 호출은 [a, b] 순서로 나갔지만 응답은 도착 순서(여기서는 반대)로
    // 쌓일 수 있다 - 병합 결과는 그래도 previous 의 원래 순서를 지켜야 한다.
    const retry = {
      outcomes: [
        { id: 'b', ok: true },
        { id: 'a', ok: true },
      ],
      cancelled: false,
    }
    const merged = mergeRetryReport(previous, retry)
    expect(merged.outcomes.map((outcome) => outcome.id)).toEqual(['a', 'b'])
  })

  it('cancelled 는 재시도 실행 자체의 값을 따른다', () => {
    const previous = { outcomes: [failed('a', '500', 'HTTP_ERROR')], cancelled: false }
    const retry = { outcomes: [], cancelled: true }
    expect(mergeRetryReport(previous, retry).cancelled).toBe(true)
  })
})
