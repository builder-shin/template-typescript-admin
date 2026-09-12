import { expect, test as base, type Page } from '@playwright/test'
import { provisionOperator } from '@/lib/auth/provision'
import { BACKEND_BASE_URL } from './stack'

/**
 * E2E 픽스처 - 브라우저가 스스로 내는 신호를 단언하는 가드와, 운영자를
 * 만들어 로그인하는 공용 절차.
 *
 * ## 왜 이걸 켰나, 그리고 무엇을 못 잡는가
 *
 * 켠 이유는 정적 분석·타입·빌드를 전부 통과하고 **브라우저에서만** 드러나는
 * 결함 계층이 있기 때문이다. 리스너 몇 줄이면 그 계층이 게이트에 들어온다.
 *
 * **`error` 와 `warning` 만 본다.** `log`·`info`·`debug` 는 정상 동작 중에도
 * 나오는 채널이라 섞으면 게이트가 소음으로 죽는다.
 *
 * ## HTTP 실패는 콘솔이 아니라 응답으로 잰다
 *
 * 크롬은 4xx·5xx **문서**로 이동하면 콘솔에 `Failed to load resource: the
 * server responded with a status of 404 (Not Found)` 를 찍는다. 그 한 줄은
 * 애플리케이션이 말한 것이 아니라 **브라우저가 네트워크를 중계한 것**이라,
 * 콘솔 채널에서 걸러 내고 대신 응답 자체를 본다.
 *
 * 걸러 내기만 하면 진짜 결함(깨진 청크 404, 잘못된 prefetch)까지 함께
 * 사라진다. 그래서 **선언으로 바꾼다**: 테스트가 기대하는 실패만
 * `expectHttpFailure()` 로 미리 밝히고, 선언하지 않은 4xx·5xx 는 전부 실패다.
 *
 * ## 왜 픽스처인가
 *
 * `page` 를 쓰는 모든 테스트에 자동으로 붙는다(`auto: true`). 자기 컨텍스트를
 * 따로 여는 테스트(언어 왕복)는 `consoleGuard.watch(page)` 로 직접 붙인다 -
 * `browser.newContext()` 는 픽스처를 거치지 않으므로 자동으로는 못 붙는다.
 */
export interface ConsoleGuard {
  /** 이 페이지의 콘솔·응답도 감시 대상에 넣는다. 테스트가 끝날 때 함께 단언된다. */
  watch(page: Page): void
  /**
   * 이 테스트가 **의도적으로** 받는 HTTP 실패 응답을 미리 선언한다.
   * 선언하지 않은 4xx·5xx 응답은 하나라도 있으면 테스트가 실패한다.
   */
  expectHttpFailure(pattern: RegExp): void
}

/** 크롬이 네트워크 응답을 중계하는 줄. 앱이 말한 것이 아니다 - 위 주석 참고. */
const BROWSER_NETWORK_NARRATION = /^Failed to load resource:/

/**
 * 로그인한 모든 화면에서 항상 404 로 죽는 자리 하나 - `components/app-sidebar.tsx`
 * 의 하드코딩된 데모 데이터(`avatar: '/avatars/shadcn.jpg'`)를 `nav-user.tsx`
 * 가 그대로 그린다. `public/` 디렉터리 자체가 이 저장소에 없어(Dockerfile 의
 * 같은 이름 절) 이 요청은 항상, 예외 없이 404 다 - 개별 테스트가
 * `expectHttpFailure()` 로 매번 선언하게 하는 대신 여기서 한 번 걸러 낸다.
 * 사이드바 블록 자체(가짜 사용자·`url: '#'` 내비게이션)를 실재하는 것으로
 * 바꾸는 일은 이 태스크의 범위 밖이다 - 그 파일을 고치는 태스크가 이 줄도
 * 함께 지운다.
 */
const KNOWN_DECORATIVE_404 = /\/avatars\/shadcn\.jpg$/

export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = []
      const expectedFailures: RegExp[] = []

      const watch = (target: Page): void => {
        target.on('console', (message) => {
          const type = message.type()
          if (type !== 'error' && type !== 'warning') return
          const text = message.text()
          if (BROWSER_NETWORK_NARRATION.test(text)) return
          problems.push(`[console.${type}] ${text}`)
        })
        // 잡히지 않은 예외는 콘솔 채널이 아니라 이쪽으로 온다.
        target.on('pageerror', (error) => {
          problems.push(`[pageerror] ${error.message}`)
        })
        target.on('response', (response) => {
          if (response.status() < 400) return
          const url = response.url()
          if (KNOWN_DECORATIVE_404.test(url)) return
          if (expectedFailures.some((pattern) => pattern.test(url))) return
          problems.push(`[http ${response.status()}] ${url}`)
        })
      }

      watch(page)
      await use({
        watch,
        expectHttpFailure: (pattern) => expectedFailures.push(pattern),
      })

      expect(problems, '브라우저 콘솔 오류·경고와 선언되지 않은 HTTP 실패가 없어야 한다').toEqual(
        [],
      )
    },
    { auto: true },
  ],
})

export { expect }

/**
 * 운영자를 하나 만들고(`lib/auth/provision.ts` 의 `provisionOperator`) 로그인
 * 화면에서 실제로 로그인한다.
 *
 * ## 왜 `provisionOperator` 를 부르는가 - 가입 화면이 없다
 *
 * 이 어드민에는 공개 표면이 아예 없다(`/login` 하나뿐 - `proxy.ts` 의
 * `PROTECTED_PATH_PATTERNS`). 운영자는 스스로 가입하지 않고, 첫 운영자는
 * `scripts/seed-operator.ts` 가 `provisionOperator` 를 불러 만든다. E2E 도
 * **같은 함수**를 불러 운영자를 만든다 - 그래야 그 시드 절차가 문서에만
 * 있는 죽은 절차가 되지 않고, 매 E2E 실행이 그 절차를 실제로 돈다.
 *
 * `backendUrl` 은 `BACKEND_BASE_URL`(`test/e2e/stack.ts`) - 호스트에 공개된
 * `api-*` 포트다. 이 호출은 Playwright 러너(Node, 호스트)에서 도는 것이지
 * 브라우저 안이 아니므로, `web` 컨테이너만 아는 `http://api:4000` 이 아니라
 * 호스트에서 실제로 닿는 주소를 써야 한다.
 *
 * 로그인은 **화면을 통해서** 한다(백엔드에 직접 로그인 요청을 보내지 않는다) -
 * 이 함수가 여는 것은 `lib/auth/flow.ts`·`app/(auth)/actions.ts`·`proxy.ts`
 * 전체가 실제로 맞물리는 유일한 자리이기 때문이다. 여기서 백엔드로 지름길을
 * 내면 그 배선 전체가 다시 무가드가 된다.
 *
 * **제출 뒤 `/login` 을 벗어날 때까지 기다린다.** `loginAction` 은 서버 왕복 +
 * 쿠키 쓰기 + `redirect()` 를 도는 비동기 Server Action 이라, 클릭
 * 자체(`.click()`)는 그 완료를 기다려 주지 않는다 - 클릭만 하고 바로
 * 돌아오면 호출부가 곧장 다른 곳으로 `page.goto()` 하거나 쿠키를 읽을 때
 * 로그인이 아직 세션을 쓰기 전일 수 있다(실측: 이 대기가 없으면 그 경합이
 * 실제로 나타나 로그인 직후 첫 네비게이션이 `/login` 으로 되돌아온다 -
 * "로그인은 됐는데 다음 화면이 다시 로그인"). `waitForURL` 을 클릭 **전에**
 * 걸어 두는 이유는 클릭과 리다이렉트 사이의 경합을 없애기 위해서다 -
 * 클릭 뒤에 걸면 리다이렉트가 그 사이에 이미 끝났을 수 있다.
 */
export async function provisionAndSignIn(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await provisionOperator({ backendUrl: BACKEND_BASE_URL, email, password })

  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login')),
    page.getByRole('button', { name: '로그인' }).click(),
  ])
}
