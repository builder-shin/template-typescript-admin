import { describe, expect, it } from 'vitest'
import { mergeRetryReport, summarize } from '@/components/grid/bulk-result'
import type { BulkOutcome, BulkOutcomeBucket } from '@/lib/bulk/executor'

// 반환 타입을 명시한다 - 안 그러면 `ok: true` 가 리터럴이 아니라 `boolean`
// 으로 넓혀져(이 자리엔 기대 타입이 없다) `BulkOutcome`(판별 합집합)에
// 대입할 수 없다(test/unit/bulk/executor.test.ts 의 같은 관례).
//
// `failed` 는 `bucket` 을 4번째 인자로 **필수로** 받는다 - `summarize` 가
// 더 이상 `actionForErrors` 를 불러 오류로부터 통을 추론하지 않기 때문이다
// (판정은 `app/(admin)/[slug]/bulk-outcome.ts` 의 `bucketForFailure` 로
// 옮겨져 Server Action 이 이미 끝내 둔다 - components/grid/bulk-result.tsx
// 머리말). 기본값을 두지 않는 이유는 각 테스트가 무엇을 시뮬레이션하는지
// 호출부에서 바로 보이게 하기 위해서다.
const ok = (id: string): BulkOutcome => ({ id, ok: true, bucket: 'ok' })
const failed = (
  id: string,
  status: string,
  code: string,
  bucket: Exclude<BulkOutcomeBucket, 'ok'>,
): BulkOutcome => ({
  id,
  ok: false,
  errors: [{ status, code, detail: 'x' }],
  bucket,
})

describe('summarize', () => {
  it('성공과 실패를 따로 센다', () => {
    const report = {
      outcomes: [ok('a'), failed('b', '500', 'INTERNAL_SERVER_ERROR', 'retryable'), ok('c')],
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
    // 행을 계속 누르게 된다 - 실제로는 처음부터 지워져 있었다. bucket 은
    // Server Action 이 이미 RESOURCE_NOT_FOUND 를 alreadyGone 으로 판정해
    // 둔 값을 흉내낸다(bucket-outcome.test.ts 가 그 판정 자체를 잰다) -
    // 이 테스트가 재는 것은 summarize 가 그 값을 올바른 통에 세는지뿐이다.
    const s = summarize({
      outcomes: [failed('b', '404', 'RESOURCE_NOT_FOUND', 'alreadyGone')],
      cancelled: false,
    })
    expect(s.alreadyGone).toEqual(['b'])
    expect(s.retryable).toEqual([])
  })

  it('세션이 죽으면 재시도가 아니라 재로그인이다', () => {
    const s = summarize({
      outcomes: [failed('b', '401', 'TOKEN_EXPIRED', 'sessionLost')],
      cancelled: false,
    })
    expect(s.sessionLost).toBe(true)
    expect(s.retryable).toEqual([])
  })

  it('성공한 건은 다시 보내지 않는다', () => {
    const s = summarize({
      outcomes: [ok('a'), failed('b', '503', 'HTTP_ERROR', 'retryable')],
      cancelled: false,
    })
    expect(s.retryable).toEqual(['b'])
  })

  it('전건 성공이면 재시도 대상이 없다', () => {
    const s = summarize({ outcomes: [ok('a')], cancelled: false })
    expect(s).toEqual({
      ok: 1,
      failed: 0,
      alreadyGone: [],
      retryable: [],
      sessionLost: false,
      cancelled: false,
    })
  })

  it('ok: false 인데 errors 가 없는 값은 타입이 만들 수 없다', () => {
    // 예전에는 `{ id, ok: false }`(errors 없음)가 컴파일됐다 - 그 시절의
    // classify 가 actionForErrors([]) 로 떨어져 '재시도 가능'으로
    // 분류하면서도 보여줄 사유가 없는 행을 만들었다(lib/bulk/executor.ts 의
    // BulkOutcome 주석). 이 테스트는 실행이 아니라 typecheck 로 지켜진다
    // (query.test.ts 의 SortTerm/isNull 테스트와 같은 관례) - 이 줄이
    // 통과하면(= 오류가 없으면) `@ts-expect-error` 자체가 컴파일 오류가
    // 된다.
    // @ts-expect-error BulkOutcome 은 판별 합집합이라 ok:false 는 errors·bucket 을 요구한다
    const outcome: BulkOutcome = { id: 'b', ok: false }
    void outcome
  })

  it('ok: false 인데 bucket 이 없는 값도 타입이 만들 수 없다', () => {
    // errors 와는 별개의 요구 사항이다 - 이 값은 errors 는 갖췄지만
    // bucket 이 없다.
    // @ts-expect-error BulkOutcome 의 ok:false 쪽은 bucket 도 요구한다
    const outcome: BulkOutcome = { id: 'b', ok: false, errors: [] }
    void outcome
  })
})

describe('mergeRetryReport', () => {
  it('재시도한 건만 새 결과로 갈아 끼우고 나머지는 그대로 둔다', () => {
    // 재시도 대상이 아니었던 a·c(성공·이미 없음)는 재시도 보고서에 아예
    // 나타나지 않는다 - 표 전체를 재시도 보고서로 바꾸면 이 둘의 결과가
    // 화면에서 사라진다(토스트로 뭉개지 않는다는 원칙이 재시도에도 적용된다).
    const previous = {
      outcomes: [
        ok('a'),
        failed('b', '500', 'INTERNAL_SERVER_ERROR', 'retryable'),
        failed('c', '404', 'RESOURCE_NOT_FOUND', 'alreadyGone'),
      ],
      cancelled: false,
    }
    const retry = { outcomes: [ok('b')], cancelled: false }
    expect(mergeRetryReport(previous, retry)).toEqual({
      outcomes: [ok('a'), ok('b'), failed('c', '404', 'RESOURCE_NOT_FOUND', 'alreadyGone')],
      cancelled: false,
    })
  })

  it('원래 순서를 지킨다 - 재시도 보고서의 순서를 따르지 않는다', () => {
    const previous = {
      outcomes: [
        failed('a', '500', 'HTTP_ERROR', 'retryable'),
        failed('b', '500', 'HTTP_ERROR', 'retryable'),
      ],
      cancelled: false,
    }
    // 재시도 호출은 [a, b] 순서로 나갔지만 응답은 도착 순서(여기서는 반대)로
    // 쌓일 수 있다 - 병합 결과는 그래도 previous 의 원래 순서를 지켜야 한다.
    const retry = {
      outcomes: [ok('b'), ok('a')],
      cancelled: false,
    }
    const merged = mergeRetryReport(previous, retry)
    expect(merged.outcomes.map((outcome) => outcome.id)).toEqual(['a', 'b'])
  })

  it('재시도 자체가 취소되면 cancelled 는 참이다', () => {
    const previous = {
      outcomes: [failed('a', '500', 'HTTP_ERROR', 'retryable')],
      cancelled: false,
    }
    const retry = { outcomes: [], cancelled: true }
    expect(mergeRetryReport(previous, retry).cancelled).toBe(true)
  })

  it('이전 실행이 취소됐었다면 재시도가 끝까지 완주해도 cancelled 는 참으로 남는다', () => {
    // retry 자체는 끝까지 갔으므로 retry.cancelled 는 거짓이다. 그래도
    // previous 가 취소된 적이 있다는 사실을 병합 결과가 잃으면, 한 번도
    // 시도되지 않은 행이 있었는데도 표는 "깨끗하게 끝났다"고 말하게 된다 -
    // 부분 실패를 뭉개는 토스트와 같은 실수를 병합 단계에서 저지르는 것이다.
    const previous = {
      outcomes: [failed('a', '500', 'HTTP_ERROR', 'retryable')],
      cancelled: true,
    }
    const retry = { outcomes: [ok('a')], cancelled: false }
    expect(mergeRetryReport(previous, retry).cancelled).toBe(true)
  })
})
