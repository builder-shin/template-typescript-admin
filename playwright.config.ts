import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './test/e2e/stack'

/**
 * E2E 설정.
 *
 * **모킹 계층을 두지 않는다.** 여기서 도는 모든 요청은 실제 프로덕션 빌드를
 * 거쳐 실제 백엔드에 닿는다(`test/e2e/stack.ts`).
 *
 * ## 재시도를 두지 않는다
 *
 * `retries: 0` 이다. 이 저장소에서 E2E 는 "단위 테스트가 구조적으로 볼 수
 * 없는 자리"를 지키는 유일한 가드다(`proxy.ts`·`app/(auth)/actions.ts`·
 * `app/(admin)/examples/page.tsx` 등의 관측 불가 주석들 - `headers()`·
 * `cookies()`·`redirect()` 가 요청 스코프를 요구해 vitest(node)에서 던지고,
 * 이 저장소는 그것을 스텁하지 않는 관례를 갖는다). 재시도를 켜면 그 자리에서
 * 실제로 깨지기 시작한 것이 "가끔 빨간 초록"으로 바뀌어 게이트를 통과한다 -
 * 가드가 있는데 없는 것과 같아진다. 흔들리면 재시도로 덮지 말고 원인을 고쳐라.
 *
 * ## 워커 하나
 *
 * 각 테스트가 고유한 이메일을 쓰므로(`test/e2e/probe-email.ts`) 데이터는 이미
 * 독립적이다. 그래도 하나로 두는 이유는 백엔드가 컨테이너 하나라 병렬이 주는
 * 이득이 작고, 회전 테스트가 refresh 재사용 감지에 닿는 자리를 다루기
 * 때문이다(`proxy.ts` 의 "요청 간 경합" 절) - 시나리오가 늘어 실제로 느려지면
 * 그때 올려라.
 *
 * ## locale 을 명시한다
 *
 * 기본값을 러너의 브라우저에 맡기면 백엔드가 협상해 내려주는 문구가 실행
 * 환경마다 달라진다(오류 문구의 정본은 백엔드다 - `Accept-Language` 로
 * 협상한다). 여기서 `ko-KR` 로 고정하고, 언어 왕복을 재는 테스트만 자기
 * 컨텍스트에서 다른 값을 준다.
 *
 * ## reporter 를 `list` 하나로 고정한다
 *
 * 기본 리포터(`html`)를 켜 두면 실행마다 `playwright-report/` 에 HTML +
 * 생성된 JS 가 쌓인다 - `.gitignore` 는 덮지만 `prettier --check`·`eslint`
 * 는 gitignore 를 읽지 않아 작업 트리에 남은 그 산출물이 게이트를 두 단계
 * (`[2/9]`·`[3/9]`)에서 그대로 걸리게 한다(`.prettierignore`·
 * `eslint.config.mjs` 가 그 두 디렉터리를 이미 넓혀 두었지만, 애초에 불필요한
 * HTML 리포터를 켜지 않는 편이 낫다). `list` 는 콘솔에 즉시 찍히므로 로컬·CI
 * 어디서든 같은 출력으로 충분하다.
 *
 * ## `expect` 타임아웃을 기본(5초)보다 늘린다
 *
 * 보호 경로 복귀·생성 폼처럼 로그인 리다이렉트 + 페이지 자신의 데이터
 * 요청(분류·라벨 옵션)이 한 네비게이션 안에서 이어지는 자리가 있다 - 실측:
 * Docker Desktop(Windows, WSL2 백엔드) 위에서 이 사슬이 기본 5초를 넘겨
 * `getByRole('heading').last()` 단언이 "Dashboard"(셸의 고정 h1)에서 멈춘
 * 채로 죽는다(응답은 계속 오고 있었다 - 새로고침 없이 3초쯤 더 기다리면
 * 화면 자신의 h1 이 그 뒤에 나타난다). 네트워크가 아니라 컨테이너 자체가
 * 이 환경에서 느린 것이라 재시도(`retries: 0`, 위 절)로 덮을 문제가 아니다 -
 * 대신 기다리는 시간을 늘린다.
 */
export default defineConfig({
  testDir: './test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  globalTeardown: './test/e2e/global-teardown.ts',
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
