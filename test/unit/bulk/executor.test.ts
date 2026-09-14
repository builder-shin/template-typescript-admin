import { describe, expect, it, vi } from 'vitest'
import { MAX_BULK_ITEMS, runBulk, type BulkOutcome } from '@/lib/bulk/executor'

// 반환 타입을 명시한다 - 안 그러면 `ok: true` 가 리터럴이 아니라 `boolean`
// 으로 넓혀져(이 자리엔 기대 타입이 없다) `BulkOutcome`(판별 합집합)에
// 대입할 수 없다.
//
// `bucket` 을 채운다 - 이 파일은 `runBulk` 의 순서·취소·상한만 잰다.
// `bucket` 의 값 자체가 무엇을 뜻하는지는 이 실행기가 몰라도 된다(그 판정은
// `app/(admin)/[slug]/bulk-outcome.ts` 의 몫 - lib/bulk/executor.ts 의
// `BulkOutcomeBucket` 주석 참고) - 여기서는 그저 타입을 만족시키는 값을
// 채울 뿐이라 그 뜻에 맞는 값(`gone` → `alreadyGone`)을 골랐다.
const ok = (id: string): BulkOutcome => ({ id, ok: true, bucket: 'ok' })
// 실증된 실패 모양이다: 삭제는 성공하면 204, 그 행이 이미 없으면 404.
// 백엔드는 삭제에 422 를 내지 않는다 - 참조 무결성 거절 경로가 없다.
// code 를 같이 싣는다 - Task 12 가 이걸 보고 재시도 가능 여부를 가른다.
const gone = (id: string): BulkOutcome => ({
  id,
  ok: false,
  errors: [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: '그 자원을 찾을 수 없습니다' }],
  bucket: 'alreadyGone',
})

describe('runBulk', () => {
  it('선언된 순서대로 하나씩 보낸다', async () => {
    const seen: string[] = []
    await runBulk(['a', 'b', 'c'], (id) => {
      seen.push(id)
      return Promise.resolve(ok(id))
    })
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('동시에 보내지 않는다', async () => {
    let inFlight = 0
    let peak = 0
    await runBulk(['a', 'b', 'c'], async (id) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return ok(id)
    })
    expect(peak).toBe(1)
  })

  it('상한을 넘으면 요청을 하나도 보내지 않고 던진다', async () => {
    const run = vi.fn()
    const tooMany = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => String(i))
    await expect(runBulk(tooMany, run)).rejects.toThrow(String(MAX_BULK_ITEMS))
    expect(run).not.toHaveBeenCalled()
  })

  it('상한과 정확히 같으면 전부 실행한다', async () => {
    const run = vi.fn((id: string) => Promise.resolve(ok(id)))
    const exactlyMax = Array.from({ length: MAX_BULK_ITEMS }, (_, i) => String(i))
    const report = await runBulk(exactlyMax, run)
    expect(run).toHaveBeenCalledTimes(MAX_BULK_ITEMS)
    expect(report.outcomes).toHaveLength(MAX_BULK_ITEMS)
    expect(report.cancelled).toBe(false)
  })

  it('일부가 실패해도 남은 것을 계속 보내고 행별로 모은다', async () => {
    const report = await runBulk(['a', 'b', 'c'], (id) =>
      Promise.resolve(id === 'b' ? gone(id) : ok(id)),
    )
    expect(report.outcomes.map((o) => o.ok)).toEqual([true, false, true])
    // 판별 합집합이라 `errors` 는 `ok: false` 쪽에만 있다 - 좁혀야 닿는다.
    const failedOutcome = report.outcomes[1]!
    if (failedOutcome.ok) throw new Error('outcomes[1] 은 실패(gone)여야 한다')
    expect(failedOutcome.errors[0]?.code).toBe('RESOURCE_NOT_FOUND')
    expect(report.cancelled).toBe(false)
  })

  it('취소하면 남은 요청을 내지 않고, 이미 보낸 결과는 남는다', async () => {
    const controller = new AbortController()
    const run = vi.fn((id: string) => {
      if (id === 'b') controller.abort()
      return Promise.resolve(ok(id))
    })
    const report = await runBulk(['a', 'b', 'c'], run, { signal: controller.signal })
    expect(run).toHaveBeenCalledTimes(2)
    expect(report.cancelled).toBe(true)
    expect(report.outcomes).toHaveLength(2)
  })

  it('진행을 건별로 알린다', async () => {
    const onProgress = vi.fn<(done: number) => void>()
    await runBulk(['a', 'b'], (id) => Promise.resolve(ok(id)), { onProgress })
    expect(onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2])
  })
})
