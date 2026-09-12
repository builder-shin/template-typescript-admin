import type { Browser, BrowserContext, Cookie, Page } from '@playwright/test'
import { provisionOperator } from '@/lib/auth/provision'
import { expect, provisionAndSignIn, test, type ConsoleGuard } from './fixtures'
import { probeEmail } from './probe-email'
import { BACKEND_BASE_URL, BASE_URL } from './stack'

/**
 * 인증 E2E - 가입(프로비저닝)·로그인·로그아웃, 보호 경로 복귀, access 회전과
 * 쿠키 수명.
 *
 * ## 이 파일이 존재하는 이유 - 단위가 구조적으로 볼 수 없는 자리
 *
 * `next/headers` 의 `cookies()`·`headers()` 와 `next/navigation` 의
 * `redirect()` 가 전부 요청 스코프를 요구해 vitest(node)에서 던지고, 이
 * 저장소는 그것을 스텁하지 않는 관례를 갖는다(`app/(auth)/actions.ts`·
 * `lib/auth/session.ts`·`proxy.ts` 의 관측 불가 주석들). 그 자리들을 브라우저가
 * 처음으로 덮는다.
 *
 * ## 픽스처 규칙 - 실전값과 같은 값을 쓰지 않는다
 *
 * `RETURN_PATH` 를 기본 로그인 목적지(`/`)로 잡으면 복귀가 되든 안 되든
 * 결과가 같다 - 그래서 보호 경로이면서 `/` 가 아닌 값을 쓰고, **쿼리 문자열도
 * 단다**(proxy 가 `${pathname}${search}` 를 싣는지까지 재려면 search 가 비어
 * 있으면 안 된다). 이메일은 실행마다·테스트마다 다르다 - 중복 가입은 409 라
 * 재실행이 조용히 다른 갈래를 탄다(`probe-email.ts`).
 */

const PASSWORD = 'probe-operator-password'

function uniqueEmail(label: string): string {
  return probeEmail(`probe-e2e-auth-${label}`)
}

const SESSION_COOKIE_NAMES = ['session_access', 'session_refresh']

/** 한글이 하나라도 있는가. 언어 왕복 테스트가 문구를 박지 않고 쓰는 술어다. */
const HANGUL = /[가-힣]/

/**
 * 로그인 후 돌아갈 경로. `proxy.ts` 의 `PROTECTED_PATH_PATTERNS` 에 걸리는
 * 보호 경로여야 하고(`/login` 을 뺀 전부가 보호된다), `DEFAULT_POST_LOGIN_PATH`
 * (`/`)와 달라야 한다.
 *
 * `/examples`(목록)가 아니라 `/examples/new` 를 쓴다 - 목록 화면은
 * `<ResourceGrid>` 만 그려 고유한 `<h1>` 이 없다(사이드바 셸의 "Dashboard"
 * 뿐이다). "URL 만 맞고 실제로는 다른 것이 그려졌을 가능성"을 막으려면
 * 화면 자신의 제목을 단언해야 하는데, 그러려면 자기 h1(`예제 만들기`)을
 * 가진 화면이어야 한다.
 */
const RETURN_PATH = '/examples/new?probe=e2e-return'

async function sessionCookies(context: BrowserContext): Promise<Cookie[]> {
  const cookies = await context.cookies()
  return cookies
    .filter((cookie) => SESSION_COOKIE_NAMES.includes(cookie.name))
    .sort((left, right) => left.name.localeCompare(right.name))
}

/** 쿠키의 **와이어 값**. 디코드하지 않는다(`session.ts` 의 퍼센트 인코딩 실측). */
function cookieValue(cookies: Cookie[], name: string): string {
  const cookie = cookies.find((candidate) => candidate.name === name)
  if (cookie === undefined) throw new Error(`쿠키가 없다: ${name}`)
  return cookie.value
}

/** 앱이 실제로 보는 값 - `session.ts` 의 `<epochMs>:<jwt>` 형식은 이쪽이다. */
function decodedCookieValue(cookies: Cookie[], name: string): string {
  return decodeURIComponent(cookieValue(cookies, name))
}

/**
 * 두 세션 쿠키가 `session.ts` 의 `sessionCookieAttributes` 가 정한 속성을
 * 갖는지 잰다.
 *
 * `secure`·`sessionCookieSecure` 를 실제로 정하는 자리는 호출부 둘이다
 * (`writeSession` - 로그인, `proxy.ts` 의 회전 갈래). 그 둘은 각자
 * `getSettings().sessionCookieSecure` 를 읽는데, 단위 테스트는 그 호출부를
 * 볼 수 없다(순수 함수 `sessionCookieAttributes`·`sessionCookieWrites` 는
 * 인자로 받은 secure 만 잰다) - 그래서 한쪽에서만 부르면 다른 쪽 호출부가
 * 무가드로 남는다. 이 함수를 로그인 뒤 한 번, 회전 뒤 한 번 부른다.
 *
 * `docker-compose.e2e.yml` 이 `web` 에 `SESSION_COOKIE_SECURE: 'true'` 를
 * 주므로(그 파일의 같은 이름 절), `secure` 가 여기서 `true` 로 잡혀야 두
 * 호출부가 실제로 설정을 읽는다는 것이 확인된다.
 */
function expectSessionCookieAttributes(cookies: Cookie[], label: string): void {
  for (const cookie of cookies) {
    const at = `${label} ${cookie.name}`
    expect(cookie.httpOnly, `${at} 은 httpOnly 다`).toBe(true)
    expect(cookie.path, `${at} 의 path`).toBe('/')
    expect(cookie.sameSite, `${at} 의 sameSite`).toBe('Lax')
    expect(cookie.secure, `${at} 의 secure 가 설정에서 온다`).toBe(true)
  }
}

/**
 * 세션 쿠키의 **만료**만 따로 잰다 - `refreshExpiresIn`(기본 30일)이 두 쿠키
 * 모두의 `maxAge` 로 온다는 `session.ts` 의 "maxAge" 절 판단. 하루보다 멀리
 * 잡는 이유는 `expiresIn`(기본 900초)을 잘못 넘기는 뮤테이션을 "만료 시각이
 * 있는가"만으로는 못 잡기 때문이다.
 */
function expectSessionCookieMaxAge(cookies: Cookie[], label: string): void {
  const oneDayFromNow = Date.now() / 1000 + 86_400
  for (const cookie of cookies) {
    expect(
      cookie.expires,
      `${label} ${cookie.name} 의 만료가 refreshExpiresIn 에서 온다`,
    ).toBeGreaterThan(oneDayFromNow)
  }
}

/**
 * 만료가 임박한 access 쿠키를 심고 한 번 이동해 `proxy.ts` 의 회전 갈래를
 * 태운다. 위조하는 것은 **만료 시각 하나뿐**(앞의 epoch 숫자)이다 - 나머지
 * (구분자·인코딩·JWT)는 백엔드와 Next 가 만든 그대로라, 회전이 실제로
 * 일어났는지를 값 비교로 잴 수 있다.
 */
async function rotateOnce(
  page: Page,
  context: BrowserContext,
): Promise<{ accessBefore: string; refreshBefore: string; after: Cookie[] }> {
  const before = await sessionCookies(context)
  const accessBefore = cookieValue(before, 'session_access')
  const refreshBefore = cookieValue(before, 'session_refresh')
  const accessCookie = before.find((cookie) => cookie.name === 'session_access')
  if (accessCookie === undefined) throw new Error('session_access 쿠키가 없다')

  const nearlyExpired = accessBefore.replace(/^\d+/, String(Date.now() + 1_000))
  expect(nearlyExpired, '만료 시각만 바뀌어야 한다').not.toBe(accessBefore)
  await context.addCookies([{ ...accessCookie, value: nearlyExpired }])

  await page.goto('/')

  return { accessBefore, refreshBefore, after: await sessionCookies(context) }
}

/** 로그인 폼 상단 오류 배너. */
function formBanner(page: Page) {
  return page.locator('form [role="alert"]')
}

async function signInViaUi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
}

test.describe('가입(프로비저닝) · 로그인 · 로그아웃', () => {
  test('프로비저닝된 운영자가 로그인하면 세션 쿠키 둘이 생기고, 로그아웃하면 둘 다 사라진다', async ({
    page,
    context,
  }) => {
    const email = uniqueEmail('lifecycle')

    await provisionAndSignIn(page, email, PASSWORD)
    // next 없이 로그인했으므로 기본 목적지(`/`)로 간다.
    await expect(page).toHaveURL('/')

    const established = await sessionCookies(context)
    expect(established.map((cookie) => cookie.name)).toEqual(SESSION_COOKIE_NAMES)

    // access 쿠키 값은 `<epochMs>:<jwt>` 다 - session.ts 의
    // encodeAccessCookieValue 가 만드는 유일한 형식.
    expect(decodedCookieValue(established, 'session_access')).toMatch(
      /^\d+:[\w-]+\.[\w-]+\.[\w-]+$/,
    )

    // 호출부 둘 중 로그인 쪽(writeSession)을 잰다 - 회전 쪽은 아래 회전
    // 테스트가 같은 함수로 잰다. 만료는 아래 전용 테스트가 잰다.
    expectSessionCookieAttributes(established, '로그인 직후')

    // 로그아웃 - 사이드바 사용자 메뉴를 열고 "로그아웃"을 누른다. 트리거는
    // 셸이 만든 고정 데모 사용자("shadcn")를 보여줄 뿐이다(app-sidebar.tsx) -
    // 부분 일치로 잡아 정확한 접근성 이름 조합(아바타 alt·이메일 공백 등)에
    // 기대지 않는다.
    await page.getByRole('button', { name: 'shadcn' }).click()
    await page.getByRole('menuitem', { name: '로그아웃' }).click()

    // POST_LOGOUT_PATH(logout.ts)는 '/' 이지만 그 경로도 보호 대상이라
    // (proxy.ts, `/login` 만 예외) 세션이 사라진 채로 다시 그 경로에 닿으면
    // 곧장 로그인으로 되돌아온다 - 로그아웃이 실제로 세션을 지웠다는 증거다.
    await expect(page).toHaveURL(/\/login(\?|$)/)
    expect(await sessionCookies(context), '로그아웃 뒤 세션 쿠키 둘 다 남지 않아야 한다').toEqual(
      [],
    )
  })

  test('보호 경로에서 막힌 뒤 로그인하면 원래 경로(쿼리 포함)로 돌아온다', async ({ page }) => {
    const email = uniqueEmail('return')
    // provisionAndSignIn(fixtures.ts) 을 쓰지 않는다 - 그 헬퍼는 `/login` 으로
    // 곧장 들어가 `next` 파라미터가 없는 로그인을 한다. 여기서 재는 것은
    // **proxy 가 붙인 `next` 를 이 화면이 그대로 들고 있다가 실제로 쓰는가**라,
    // provisionOperator 만 따로 불러 계정을 만들고 로그인은 이 테스트가 직접 한다.
    await provisionOperator({ backendUrl: BACKEND_BASE_URL, email, password: PASSWORD })

    // 익명으로 보호 경로에 곧장 들어간다 - proxy.ts 가 /login?next=... 로
    // 되돌려야 한다.
    await page.goto(RETURN_PATH)
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(RETURN_PATH)}`)

    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()

    // 목적지가 기본값(`/`)이 아니라 원래 가려던 경로여야 하고, 쿼리까지
    // 살아 있어야 한다 - LOGIN_REDIRECT_PARAM 계약(proxy.ts)의 유일한 왕복
    // 시험이다(단위는 "그 이름으로 붙이는가"까지만 본다).
    await expect(page).toHaveURL(RETURN_PATH)
    // h1 이 둘이다 - 사이드바 셸의 고정 "Dashboard"(site-header.tsx)가 항상
    // 먼저 그려지고, 화면 고유의 제목("예제 만들기")이 그 뒤에 온다.
    await expect(page.getByRole('heading', { level: 1 }).last()).toHaveText('예제 만들기')
  })

  /**
   * 닫는 관측 공백: `app/(auth)/actions.ts` 의
   * `(await headers()).get('accept-language')` 한 줄 - 그 아래(값이 실제
   * 헤더로 나가는 것, 없으면 헤더가 빠지는 것)는 단위(`credentials.test.ts`)
   * 가 지킨다.
   *
   * 백엔드 문구를 박지 않는다 - 재는 것은 "브라우저 언어가 백엔드까지
   * 갔는가"이고, 그것은 **영어 쪽에 한글이 없는가**로 잰다. 한국어 쪽만
   * 단언하면 배선을 지워도 통과한다 - 헤더가 빠지면 백엔드가 `ko` 로
   * 떨어지기 때문이다.
   *
   * 존재하지 않는 계정을 쓴다 - 백엔드는 없는 이메일에도 같은 401
   * INVALID_CREDENTIALS 를 낸다(계정 열거 방지) - 가입 단계가 필요 없다.
   */
  test('로그인 실패 문구가 브라우저 언어를 따른다', async ({ browser, consoleGuard }) => {
    const email = uniqueEmail('locale')

    const korean = await failedLoginBanner(browser, consoleGuard, 'ko-KR', email)
    const english = await failedLoginBanner(browser, consoleGuard, 'en-US', email)

    expect(korean).not.toBe('')
    expect(english).not.toBe('')
    expect(english, '두 언어가 같은 문구면 Accept-Language 가 전달되지 않은 것이다').not.toBe(
      korean,
    )
    expect(korean).toMatch(HANGUL)
    expect(english).not.toMatch(HANGUL)
  })
})

test.describe('access 회전', () => {
  /**
   * 닫는 관측 공백 둘:
   *
   *   - `rotation.ts` 의 refresh 요청 본문 모양 - 실제 HTTP 왕복은 여기서
   *     처음 돈다.
   *   - `proxy.ts` 회전 갈래의 `getSettings().sessionCookieSecure` 조회 -
   *     회전은 `sessionCookieWrites` 를 부르는 **두 번째** 호출부이고, 로그인
   *     쪽 단언은 이 자리를 지키지 못한다.
   *
   * 짧은 만료 스택을 따로 띄우지 않는다 - 그 스택에서는 회전 직후 받은
   * 토큰도 곧바로 "만료 임박"이라 링크 prefetch 같은 동시 요청이 곧장 refresh
   * 재사용 감지를 밟는다(`proxy.ts` 의 "요청 간 경합" 절). 대신 쿠키의 만료
   * 시각만 위조한다(`rotateOnce`) - refresh 토큰은 백엔드가 준 진짜이고, 회전
   * 요청과 그 응답 전부가 실제 왕복이다.
   */
  test('만료가 임박한 access 쿠키가 들어오면 프록시가 회전한다', async ({ page, context }) => {
    await provisionAndSignIn(page, uniqueEmail('rotate'), PASSWORD)
    await expect(page).toHaveURL('/')

    const { accessBefore, refreshBefore, after } = await rotateOnce(page, context)
    expect(
      after.map((cookie) => cookie.name),
      '회전이 거절되면 두 쿠키가 지워진다 - 본문 모양이 틀리면 여기서 죽는다',
    ).toEqual(SESSION_COOKIE_NAMES)

    // 백엔드가 회전 때 새 쌍을 발급한다(구 refresh 는 즉시 폐기된다).
    expect(cookieValue(after, 'session_refresh')).not.toBe(refreshBefore)
    expect(cookieValue(after, 'session_access')).not.toBe(accessBefore)

    // 새 만료 시각은 백엔드의 expiresIn(기본 900초)에서 온다 - 위조한 값
    // (지금+1초)이 그대로 남아 있으면 회전이 아니라 통과였다는 뜻이다.
    const [epochMs] = decodedCookieValue(after, 'session_access').split(':')
    expect(Number(epochMs)).toBeGreaterThan(Date.now() + 60_000)

    // 회전 쪽(proxy.ts) 호출부를 잰다 - 로그인 쪽 단언이 이 자리를 대신 지켜
    // 주지 못한다(다른 호출부다).
    expectSessionCookieAttributes(after, '회전 직후')
  })

  test('로그인 직후 세션 쿠키 둘의 만료가 refreshExpiresIn 에서 온다', async ({
    page,
    context,
  }) => {
    await provisionAndSignIn(page, uniqueEmail('maxage-login'), PASSWORD)
    await expect(page).toHaveURL('/')
    expectSessionCookieMaxAge(await sessionCookies(context), '로그인 직후')
  })

  test('회전 직후 세션 쿠키 둘의 만료가 refreshExpiresIn 에서 온다', async ({ page, context }) => {
    await provisionAndSignIn(page, uniqueEmail('maxage-rotate'), PASSWORD)
    await expect(page).toHaveURL('/')

    const { after } = await rotateOnce(page, context)
    expect(
      after.map((cookie) => cookie.name),
      '회전이 거절되면 두 쿠키가 지워진다',
    ).toEqual(SESSION_COOKIE_NAMES)
    expectSessionCookieMaxAge(after, '회전 직후')
  })
})

/**
 * 주어진 로케일의 새 컨텍스트에서 로그인을 실패시키고 배너 문구를 돌려준다.
 * `browser.newContext()` 는 `use.locale`(playwright.config.ts 의 `ko-KR`)을
 * 물려받지 않으므로 두 호출 모두 로케일을 명시한다.
 */
async function failedLoginBanner(
  browser: Browser,
  consoleGuard: ConsoleGuard,
  locale: string,
  email: string,
): Promise<string> {
  const context = await browser.newContext({ locale, baseURL: BASE_URL })
  try {
    const page = await context.newPage()
    consoleGuard.watch(page)

    await signInViaUi(page, email, 'probe-wrong-password')

    const banner = formBanner(page)
    await expect(banner).toBeVisible()
    return (await banner.innerText()).trim()
  } finally {
    await context.close()
  }
}
