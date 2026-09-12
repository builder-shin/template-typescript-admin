import { describe, expect, it, vi } from 'vitest'
import { MAX_BULK_ITEMS, runBulk } from '@/lib/bulk/executor'

const ok = (id: string) => ({ id, ok: true })
// 실증된 실패 모양이다: 삭제는 성공하면 204, 그 행이 이미 없으면 404.
// 백엔드는 삭제에 422 를 내지 않는다 - 참조 무결성 거절 경로가 없다.
// code 를 같이 싣는다 - Task 12 가 이걸 보고 재시도 가능 여부를 가른다.
const gone = (id: string) => ({
  id,
  ok: false,
  errors: [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: '그 자원을 찾을 수 없습니다' }],
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
    expect(report.outcomes[1]!.errors?.[0]?.code).toBe('RESOURCE_NOT_FOUND')
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
