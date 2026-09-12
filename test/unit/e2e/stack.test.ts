import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `test/e2e/matrix.ts` 의 머리말이 하는 주장을 실제로 지킨다.
 *
 * 그 파일은 "`BACKEND_KIND` 오타가 도커를 건드리기 전에 던진다"는 배선
 * 자체는 `test/unit/e2e/matrix.test.ts` 가 아니라 "`stack.ts` 를 동적으로
 * import 하는 별도 테스트"가 지킨다고 적어 두었다 - 그런데 그 테스트가
 * 없었다. `matrix.test.ts` 는 `resolveBackendKind` 를 직접 부를 뿐이고,
 * "그 함수가 옳다"와 "`stack.ts` 가 모듈 평가 시점에 그 함수를 실제로
 * 부른다"는 다른 성질이다 - 후자를 어기는 리팩터(예: 호출을
 * `startStack()` 안으로 옮기는 것)는 `matrix.test.ts` 를 그대로 통과시킨 채
 * 조용히 그 보장을 깬다.
 *
 * `stack.ts` 를 동적으로 import 하면 도커는 건드리지 않는다 - 그 파일의
 * 최상위 코드는 `WEB_PORT`·`API_PORT`·`BACKEND_KIND` 같은 값 계산뿐이고,
 * 실제로 `docker`(`execFileSync`)를 부르는 `compose()`/`startStack()`/
 * `stopStack()` 은 함수 선언일 뿐 이 시점에 불리지 않는다 - 그래서
 * `BACKEND_KIND` 가 던지면 이 import 자체가 실패하고, 성공하면 도커를
 * 전혀 건드리지 않고 끝난다.
 */
describe('stack.ts — BACKEND_KIND 검증이 모듈 평가 시점에 실제로 도는가', () => {
  afterEach(() => {
    delete process.env.BACKEND_KIND
    vi.resetModules()
  })

  it('알려지지 않은 값이면 이 모듈을 불러오는 시점에 던진다 - 도커를 건드리기 전이다', async () => {
    process.env.BACKEND_KIND = 'fastpai' // 오타
    await expect(import('@/test/e2e/stack')).rejects.toThrow(/fastapi/)
  })

  it('알려진 값이면 조용히 로드되고, 그 값을 그대로 내보낸다', async () => {
    process.env.BACKEND_KIND = 'nestjs'
    const stack = await import('@/test/e2e/stack')
    expect(stack.BACKEND_KIND).toBe('nestjs')
  })
})
