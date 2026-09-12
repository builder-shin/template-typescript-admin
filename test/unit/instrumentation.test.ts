import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `register()` 가 실제로 `getSettings()` 를 부르는지, 그래서 깨진 설정이
 * 요청보다 먼저(모듈을 다시 불러온 직후) 드러나는지를 잰다.
 *
 * `getSettings()` 는 프로세스 스코프로 메모이즈하므로(settings.ts), 매
 * 테스트마다 `vi.resetModules()` 로 그 캐시를 비우고 모듈을 새로
 * 불러온다 - `test/unit/auth/logout.test.ts` 의 같은 관례.
 *
 * "시작 실패" 자체(프로세스가 죽는지)는 이 계층에서 잴 수 없다 - vitest 는
 * Next.js 서버 인스턴스를 띄우지 않는다. 그 실측(서버는 안 죽고 모든 요청이
 * 500 을 받는다)은 `instrumentation.ts` 자신의 주석에 `node
 * .next/standalone/server.js` 로 직접 확인해 적어 두었다. 여기서 재는 것은
 * 그보다 좁다 - "`register()` 를 부르면 `getSettings()` 가 실제로 실행된다"
 * 뿐이다.
 */
describe('register', () => {
  const ORIGINAL_BACKEND_URL = process.env.BACKEND_URL

  afterEach(() => {
    if (ORIGINAL_BACKEND_URL === undefined) delete process.env.BACKEND_URL
    else process.env.BACKEND_URL = ORIGINAL_BACKEND_URL
    vi.resetModules()
  })

  it('BACKEND_URL이 유효하면 예외 없이 끝난다', async () => {
    process.env.BACKEND_URL = 'http://probe-backend:4321'
    vi.resetModules()
    const { register } = await import('@/instrumentation')
    expect(() => register()).not.toThrow()
  })

  it('BACKEND_URL이 없으면 register() 를 부르는 시점에 바로 던진다 - 첫 요청이 아니다', async () => {
    delete process.env.BACKEND_URL
    vi.resetModules()
    const { register } = await import('@/instrumentation')
    expect(() => register()).toThrow(/BACKEND_URL/)
  })
})
