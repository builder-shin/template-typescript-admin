import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, type NextResponse } from 'next/server'
import { proxy, isProtectedPath, LOGIN_REDIRECT_PARAM, REQUEST_PATH_HEADER, config } from '@/proxy'
import {
  SESSION_COOKIE_ACCESS,
  SESSION_COOKIE_REFRESH,
  decodeAccessCookieValue,
  encodeAccessCookieValue,
} from '@/lib/auth/session'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'

/**
 * proxy() 자체를 실제 NextRequest 로 부르는 통합 테스트.
 *
 * next/server 는 next/headers 와 다르다 - session.test.ts 가 실측한 대로
 * next/headers 의 cookies() 는 요청 스코프 밖에서 부르면 던지지만(Next 16
 * 이 request-scoped async storage 밖 호출을 막는다), NextRequest/NextResponse
 * 는 그냥 Request/Response 서브클래스라 이 vitest(node 환경)에서 직접
 * 생성하고 부를 수 있다 - 아래 테스트가 그냥 통과하는 것 자체가 그 확인이다.
 *
 * 이 파일이 있어야 하는 이유: lib/auth/rotation.ts 의 순수 함수(decideRotation·
 * interpretRotationOutcome)는 "판단"만 검증한다. 그 판단을 실제로 Set-Cookie·
 * 리다이렉트·downstream 요청 헤더로 옮기는 proxy() 자신의 배선(글루)은 별개의
 * 코드이고, 그 배선에 있는 버그는 rotation.test.ts 가 절대 잡지 못한다 -
 * 이 파일이 그 자리를 덮는다.
 *
 * now 를 주입하지 않고 Date.now() 를 그대로 쓴다(이 저장소의 다른 테스트
 * 파일과 다른 점) - proxy(request) 는 Next.js 가 실제로 부르는 시그니처라
 * 테스트용 now 매개변수를 추가할 수 없다. 대신 만료 판정에 필요한 상대
 * 오프셋(예: Date.now() - 1000)만 쓰고 절대 시각을 단언하지 않는다 - 정확한
 * accessExpiresAt 계산은 이미 rotation.test.ts 가 주입된 now 로 정밀하게 덮는다.
 */

function cookieHeader(parts: Record<string, string>): string {
  return Object.entries(parts)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function makeRequest(path: string, cookies?: Record<string, string>): NextRequest {
  const url = `http://localhost${path}`
  // cookies 가 undefined 일 때 { headers: undefined } 를 만들지 않는다 -
  // exactOptionalPropertyTypes 아래에서는 "생략"과 "undefined 를 명시적으로
  // 담음"이 다르다(RequestInit.headers?: HeadersInit 는 후자를 거부한다).
  if (cookies === undefined) return new NextRequest(url)
  return new NextRequest(url, { headers: { cookie: cookieHeader(cookies) } })
}

function locationOf(response: NextResponse): URL {
  const location = response.headers.get('location')
  if (location === null) throw new Error('리다이렉트가 없다')
  return new URL(location)
}

describe('어드민의 보호 경로', () => {
  // nextjs 는 목록·상세가 공개이고 쓰기만 보호된다. 어드민은 읽기조차
  // 운영자만 본다 - 공개는 /login 하나뿐이고 나머지는 전부 보호 대상이다.
  it('공개는 /login 하나다', () => {
    expect(isProtectedPath('/login')).toBe(false)
  })

  it.each(['/', '/examples', '/examples/abc', '/examples/new', '/examples/abc/edit'])(
    '%s 는 보호된다',
    (path) => {
      expect(isProtectedPath(path)).toBe(true)
    },
  )

  it('/register 는 오늘 보호된다 - 화면이 없어서가 아니라, 이 목록이 /login 만 예외로 아는 기본값이라서다', () => {
    // 이 값이 앞으로도 계속 true 여야 하는 것은 아니다 - 가입 화면을
    // 붙이는 사람은 반드시 이 목록에 /register 예외를 추가해야 한다(그
    // 화면은 세션 없는 방문자가 와야 하는 유일한 화면이라, 보호된 채로
    // 두면 아무도 가입할 수 없다 - proxy.ts 의 PROTECTED_PATH_PATTERNS
    // 머리말). 이 테스트는 "예외를 깜빡한 채 화면만 붙였다"는 상태를
    // 오늘의 값(true)과 다르게 만들지 않는다 - 그 실수를 잡는 것은 이
    // 자리가 아니라 그 화면을 붙이는 사람이 proxy.ts 머리말을 읽는 것이다.
    expect(isProtectedPath('/register')).toBe(true)
  })

  it('아직 없는 public/ 자산 경로도 오늘은 보호된다 - public/ 에 첫 파일이 생기면 config.matcher 의 예외도 함께 넓혀야 한다', () => {
    // config.matcher(아래 describe)는 `_next/static`·`_next/image`·
    // `favicon.ico` 셋만 뺀다 - `public/`에서 직접 서빙되는 파일(로고,
    // robots.txt, manifest 등)의 경로는 여기 없다. PROTECTED_PATH_PATTERNS 는
    // `/login`만 빼고 전부 보호하므로, `public/`이 비어 있는 지금은 무해할 뿐
    // 이 둘의 조합은 이미 함정이다 - 그 자산이 실제로 생기면 익명 사용자에게
    // 보여야 할 로고·robots.txt 요청이 `/login`으로 리다이렉트된다.
    // 이 단언은 오늘의 동작(자산 모양 경로도 보호된다)을 고정해 둔다 -
    // public/ 에 첫 파일을 추가하는 사람이 이 문구를 보고 config.matcher 의
    // 예외 목록도 함께 넓혀야 함을 알도록 하기 위해서다.
    expect(isProtectedPath('/logo.png')).toBe(true)
  })
})

describe('config.matcher — 정적 자산 제외', () => {
  /**
   * config.matcher 의 문자열은 순수 JS 정규식이 아니다 - Next.js 가
   * path-to-regexp 기반 자체 컴파일러(next/dist/lib/try-to-parse-path 의
   * tryToParsePath, next/dist/shared/lib/router/utils/middleware-route-matcher.js
   * 가 그 결과로 .exec() 한다)를 거친다. 처음엔 `new RegExp(matcherSource)`로
   * 직접 테스트했다가 **틀렸다** - 앵커(`^`/`$`)가 없어 `/_next/static/chunk.js`
   * 안의 나중 `/`(예: "/chunk.js" 앞)에서 우연히 매치해 true 가 나왔다(실측:
   * 첫 시도에서 테스트가 실패했다). tryToParsePath 를 직접 불러 실제 컴파일
   * 결과를 확인했다:
   *
   *   $ node -e "console.log(require('next/dist/lib/try-to-parse-path')
   *     .tryToParsePath('/((?!_next/static|_next/image|favicon.ico).*)').regexStr)"
   *   ^(?:\/((?!_next\/static|_next\/image|favicon.ico).*))[\/#\?]?$
   *
   * 이 실제 컴파일 정규식으로 재검증: '/_next/static/chunk.js'→false,
   * '/_next/image'→false, '/favicon.ico'→false, '/'→true, '/examples/new'→true.
   * 즉 정적 자산 요청에는 proxy() 가 전혀 돌지 않는다(회전을 시도하지 않는다).
   *
   * 이 컴파일 함수(next/dist/lib/...)는 Next 의 비공개 내부 API 라 버전이
   * 바뀌면 사라지거나 동작이 달라질 수 있다 - 그래서 테스트 자체는 그 함수를
   * 불러 매번 재컴파일하지 않고, **소스 문자열이 그대로인지**만 고정한다.
   * 문자열이 바뀌면 이 주석의 실측이 더 이상 그 값을 보증하지 않으므로
   * 위 명령으로 다시 실측해야 한다는 신호다.
   */
  it('정해진 값 그대로다(값을 바꾸면 위 주석의 실측을 다시 해야 한다)', () => {
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)'])
  })
})

describe('proxy()', () => {
  // 실전 예시 값(`http://api:4000` · `http://localhost:4000`, .env.example)을
  // 쓰지 않는다 - 픽스처가 실전값과 같으면 "설정에서 읽었다"와 "박아 넣었다"가
  // 구별되지 않는다(rotation.test.ts 가 먼저 이 관례를 세웠다). 오늘은
  // settings.ts 가 BACKEND_URL 누락 시 던져서(기본값 없음) 우연히 무해하지만,
  // 그 보호는 이 파일 밖에 있다.
  const BACKEND = 'http://probe-backend:4321'
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.BACKEND_URL = BACKEND
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  function jsonApiResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': JSONAPI_MEDIA_TYPE },
    })
  }

  it('익명 요청 + 보호되지 않은 경로 → 통과, Set-Cookie 없음, fetch 를 부르지 않는다', async () => {
    const response = await proxy(makeRequest('/login'))
    expect(response.headers.get('location')).toBeNull()
    expect(response.cookies.getAll()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('익명 요청 + 보호된 경로 → /login?next=<원래 경로> 로 리다이렉트한다', async () => {
    const response = await proxy(makeRequest('/examples/new?foo=bar'))
    const location = locationOf(response)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get(LOGIN_REDIRECT_PARAM)).toBe('/examples/new?foo=bar')
  })

  it('유효한(만료 임박 아닌) 세션 + 보호된 경로 → 통과시키고 회전하지 않는다', async () => {
    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('a', Date.now() + 10 * 60_000),
      [SESSION_COOKIE_REFRESH]: 'r',
    })
    const response = await proxy(request)
    expect(response.headers.get('location')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.cookies.getAll()).toEqual([])
  })

  it('통과하는 요청은 downstream(request.headers)에 REQUEST_PATH_HEADER 로 pathname+search 를 싣는다', async () => {
    // app/(admin)/layout.tsx 가 세션 죽음을 감지해 /login?next=<현재 경로> 로
    // 보낼 때 "현재 경로"를 구할 다른 방법이 없다(서버 컴포넌트는 pathname 을
    // 읽는 공식 방법이 없다 - REQUEST_PATH_HEADER 선언부 주석). request.cookies.set
    // 이 회전된 쿠키를 downstream 에 실어 보내는 것과 같은 자리(같은 request
    // 객체를 그대로 뮤테이션)이므로 같은 방식(원래 request 를 다시 읽는다)으로 잰다.
    const request = makeRequest('/examples/new?foo=bar', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('a', Date.now() + 10 * 60_000),
      [SESSION_COOKIE_REFRESH]: 'r',
    })
    await proxy(request)
    expect(request.headers.get(REQUEST_PATH_HEADER)).toBe('/examples/new?foo=bar')
  })

  it('로그인으로 리다이렉트하는 요청은 REQUEST_PATH_HEADER 를 싣지 않는다(그 갈래는 그 줄에 도달하지 않고 일찍 반환한다)', async () => {
    const request = makeRequest('/examples/new?foo=bar')
    await proxy(request)
    expect(request.headers.get(REQUEST_PATH_HEADER)).toBeNull()
  })

  it('access 만 있고 refresh 가 없는 반쪽 쿠키 + 보호된 경로 → fetch 없이 즉시 리다이렉트 + 쿠키 삭제', async () => {
    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('a', Date.now() + 10 * 60_000),
    })
    const response = await proxy(request)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(locationOf(response).pathname).toBe('/login')
    expect(response.cookies.get(SESSION_COOKIE_ACCESS)?.value).toBe('')
    expect(response.cookies.get(SESSION_COOKIE_ACCESS)?.path).toBe('/')
  })

  it('만료 임박 + 회전 성공 → 새 쌍을 Set-Cookie 로 내리고, 같은 요청의 downstream(request.cookies)에도 반영하고, 보호 경로도 통과시킨다', async () => {
    // expiresIn·refreshExpiresIn 을 실전값(900·2,592,000)이 아닌 값(300·
    // 86,400)으로 준다 - proxy() 가 outcome.refreshExpiresIn 을
    // sessionCookieWrites 에 그대로 넘기는 배선 지점도 이 파일이 실전값을
    // 입력으로 쓰는 한, 그 인자를 상수 2_592_000 으로 하드코딩해도 이 테스트가
    // 못 잡는다 - 입력과 하드코딩값이 같아서다.
    fetchMock.mockResolvedValue(
      jsonApiResponse({
        data: {
          type: 'authTokens',
          id: 'jti',
          attributes: {
            accessToken: 'rotated-access',
            refreshToken: 'rotated-refresh',
            tokenType: 'Bearer',
            expiresIn: 300,
            refreshExpiresIn: 86_400,
          },
        },
      }),
    )

    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('old-access', Date.now() - 1_000),
      [SESSION_COOKIE_REFRESH]: 'old-refresh',
    })
    const response = await proxy(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toBeNull() // 세션을 회복했으니 리다이렉트하지 않는다

    // 다음 요청을 위한 Set-Cookie.
    const setAccess = response.cookies.get(SESSION_COOKIE_ACCESS)
    expect(setAccess?.maxAge).toBe(86_400)
    const decodedSetAccess = decodeAccessCookieValue(setAccess?.value ?? '')
    expect(decodedSetAccess?.accessToken).toBe('rotated-access')
    expect(decodedSetAccess?.accessExpiresAt).toBeGreaterThan(Date.now() + 295_000) // ~300초, 여유
    expect(decodedSetAccess?.accessExpiresAt).toBeLessThan(Date.now() + 305_000)
    expect(response.cookies.get(SESSION_COOKIE_REFRESH)?.value).toBe('rotated-refresh')

    // 같은 요청의 downstream 이 볼 값 - request.cookies.set 이
    // Cookie 요청 헤더를 다시 쓰는 기법이 이 코드에서도 실제로 동작하는지 확인한다.
    const downstreamAccess = request.cookies.get(SESSION_COOKIE_ACCESS)?.value
    const decodedDownstream = decodeAccessCookieValue(downstreamAccess ?? '')
    expect(decodedDownstream?.accessToken).toBe('rotated-access')
    expect(request.cookies.get(SESSION_COOKIE_REFRESH)?.value).toBe('rotated-refresh')
  })

  it('회전 호출에 브라우저의 Accept-Language 를 그대로 실어 보낸다', async () => {
    // 이 배선이 없으면 백엔드가 협상해 내려주는 오류 문구가 항상 기본
    // 언어로 온다 - 화면은 그것을 그대로 그리므로 사용자는
    // 자기 언어가 아닌 문구를 본다. 실패가 아니라 조용한 오작동이라
    // 이 단언 말고는 아무것도 잡지 못한다.
    //
    // 값은 어느 브라우저도 어느 기본값도 만들 수 없는 것을 쓴다 - 실전에
    // 나올 법한 'ko-KR,ko;q=0.9' 를 쓰면 "전달했다"와 "우연히 같다"가
    // 구별되지 않는다.
    const probeAcceptLanguage = 'xx-ZZ,qq;q=0.3'

    fetchMock.mockResolvedValue(
      jsonApiResponse({ errors: [{ status: '401', code: 'TOKEN_REVOKED' }] }, 401),
    )

    const request = new NextRequest('http://localhost/examples/new', {
      headers: {
        cookie: cookieHeader({
          [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('old-access', Date.now() - 1_000),
          [SESSION_COOKIE_REFRESH]: 'old-refresh',
        }),
        'accept-language': probeAcceptLanguage,
      },
    })
    await proxy(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      headers[name] = value
    })
    // 맵 전체를 비교한다 - 헤더 하나만 골라 보면 나머지는 지켜지지 않는다.
    expect(headers).toEqual({
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
      'accept-language': probeAcceptLanguage,
    })
  })

  it('Accept-Language 헤더가 없는 요청이면 회전 호출에도 그 헤더가 없다', async () => {
    fetchMock.mockResolvedValue(
      jsonApiResponse({ errors: [{ status: '401', code: 'TOKEN_REVOKED' }] }, 401),
    )

    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('old-access', Date.now() - 1_000),
      [SESSION_COOKIE_REFRESH]: 'old-refresh',
    })
    await proxy(request)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).has('accept-language')).toBe(false)
  })

  it('만료 임박 + 회전이 TOKEN_REVOKED 로 거절 + 보호 경로 → 로그인으로 리다이렉트하고 쿠키를 지운다', async () => {
    fetchMock.mockResolvedValue(
      jsonApiResponse(
        { errors: [{ status: '401', code: 'TOKEN_REVOKED', title: '토큰 폐기됨' }] },
        401,
      ),
    )

    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('old-access', Date.now() - 1_000),
      [SESSION_COOKIE_REFRESH]: 'reused-refresh',
    })
    const response = await proxy(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(locationOf(response).pathname).toBe('/login')
    expect(response.cookies.get(SESSION_COOKIE_ACCESS)?.value).toBe('')
    expect(response.cookies.get(SESSION_COOKIE_REFRESH)?.value).toBe('')
  })

  it('만료 임박 + 회전이 네트워크 실패(unreachable) + 보호 경로 → 쿠키를 건드리지 않고 통과시킨다(재로그인 강제하지 않는다)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const originalAccess = encodeAccessCookieValue('stale-access', Date.now() - 1_000)
    const request = makeRequest('/examples/new', {
      [SESSION_COOKIE_ACCESS]: originalAccess,
      [SESSION_COOKIE_REFRESH]: 'stale-refresh',
    })
    const response = await proxy(request)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toBeNull() // 세션이 죽었다는 증거가 없으므로 로그인으로 보내지 않는다
    expect(response.cookies.getAll()).toEqual([]) // Set-Cookie 를 내지 않았다 - 다음 요청에서 다시 시도한다
    expect(request.cookies.get(SESSION_COOKIE_ACCESS)?.value).toBe(originalAccess) // downstream 도 원래 값 그대로
  })

  it('보호되지 않은 경로에서는 회전에 성공해도 리다이렉트가 없다(가드는 보호 경로에만 적용된다)', async () => {
    fetchMock.mockResolvedValue(
      jsonApiResponse({
        data: {
          type: 'authTokens',
          id: 'jti',
          attributes: {
            accessToken: 'rotated-access',
            refreshToken: 'rotated-refresh',
            tokenType: 'Bearer',
            expiresIn: 900,
            refreshExpiresIn: 2_592_000,
          },
        },
      }),
    )
    const request = makeRequest('/login', {
      [SESSION_COOKIE_ACCESS]: encodeAccessCookieValue('old-access', Date.now() - 1_000),
      [SESSION_COOKIE_REFRESH]: 'old-refresh',
    })
    const response = await proxy(request)
    expect(response.headers.get('location')).toBeNull()
    expect(response.cookies.get(SESSION_COOKIE_ACCESS)).not.toBeUndefined()
  })

  it('세션이 반쪽(access 형식 깨짐) + 비보호 경로 → 리다이렉트 없이 통과하되 두 쿠키를 지운다', async () => {
    // 기존 테스트는 "파기 + 보호 경로"(리다이렉트 분기의
    // clearCookies, 위 반쪽 쿠키 테스트)만 덮었지 "파기 + 비보호 경로"
    // (response 를 그대로 돌려주는 뒷부분의 clearCookies 분기)는 전혀 덮지
    // 않아서 그 블록을 통째로 지워도 177개 전부 통과했다. 현재 코드는 옳다(그 블록이
    // 실제로 있다) - 이건 라이브 버그가 아니라 순수한 커버리지 공백이었다.
    // 실제 영향: 이 블록이 없으면 깨진 쿠키를 들고 공개 페이지를 방문한
    // 사용자의 죽은 쿠키가 안 지워진 채 남아 다음 요청마다 회전을 다시
    // 시도하다 다시 실패하는 것이 반복된다.
    const request = makeRequest('/login', {
      [SESSION_COOKIE_ACCESS]: 'not-a-valid-cookie-value',
      [SESSION_COOKIE_REFRESH]: 'r',
    })
    const response = await proxy(request)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBeNull() // 비보호 경로라 리다이렉트하지 않는다
    expect(response.cookies.get(SESSION_COOKIE_ACCESS)?.value).toBe('')
    expect(response.cookies.get(SESSION_COOKIE_REFRESH)?.value).toBe('')
  })
})
