import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE_ACCESS,
  SESSION_COOKIE_REFRESH,
  sessionCookieNames,
  sessionCookieWrites,
  type SessionCookieWrite,
} from '@/lib/auth/session'
import { decideRotation, rotateSession } from '@/lib/auth/rotation'
import { getSettings } from '@/lib/config/settings'

/**
 * 보호된 경로 - 로그인해야 접근할 수 있다.
 *
 * 어드민에는 공개 표면이 없다 - 목록·상세를 포함해 `/login` 을 뺀 모든
 * 경로가 운영자 로그인을 요구한다. 그래서 개별 경로를 열거하는 형제
 * 저장소의 방식 대신, `/login` 하나만 예외로 남기는 부정 전방탐색
 * (negative lookahead) 패턴 하나를 쓴다 - 새 화면이 추가돼도 이 배열을
 * 건드릴 필요가 없고, 반대로 "보호 목록에 추가하는 것을 깜빡하는" 실수
 * 자체가 구조적으로 불가능하다(무언가를 보호 목록에 넣어야 보호되는 것이
 * 아니라, `/login` 을 예외 목록에서 빼야 공개되므로 기본값이 이미 "보호"다).
 *
 * `/register` 도 이 패턴에 걸려 보호된다 - 그 화면은 만들지 않기로 했지만
 * (첫 운영자는 백엔드 시드로 만든다), 화면이 없다고 경로가 저절로
 * 막히는 것은 아니다. 나중에 누군가 그 경로에 화면을 붙이면서 보호를
 * 깜빡해도 이 패턴이 이미 막고 있다.
 */
export const PROTECTED_PATH_PATTERNS: readonly RegExp[] = [/^(?!\/login$).*$/]

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
}

/**
 * 로그인 후 원래 가려던 곳으로 돌아가기 위한 쿼리 파라미터 이름.
 *
 * **로그인 Server Action 과의 계약이다.** 로그인 Server Action 이 성공 후 이
 * 파라미터(`searchParams.get(LOGIN_REDIRECT_PARAM)`)를 읽어 그 경로로
 * redirect 해야 "로그인 후 원래 페이지로 복귀"가 완성된다 - 그러지 않으면
 * 로그인 성공 후 사용자가 항상 같은 곳(예: 홈)으로만 보내진다.
 *
 * **그 계약을 지키는 것은 E2E 하나뿐이다.** 단위 테스트는 이
 * 파일이 파라미터를 **붙이는 것**까지만 본다 - 로그인 화면이 같은 이름으로
 * 그것을 **읽는지**는 양쪽이 같은 상수를 가져다 쓰므로 등가 뮤턴트다.
 * test/e2e/auth.spec.ts 의 "보호 경로에서 막힌 뒤 로그인하면 원래 경로로
 * 돌아온다" 가 실제 왕복을 돈다. 죽는 것을 확인한 뮤테이션 셋(실측):
 * 로그인 페이지가 다른 이름으로 읽기 · 아래 `${pathname}${search}` 에서
 * `search` 빼기 · 아래 경로 가드의 부정 뒤집기.
 */
export const LOGIN_REDIRECT_PARAM = 'next'

/**
 * 이번 요청의 `${pathname}${search}` 를 downstream 서버 컴포넌트에 넘기는 헤더 이름.
 *
 * **왜 필요한가.** Next.js 는 서버 컴포넌트(레이아웃 포함)가 현재 요청의
 * pathname 을 읽는 공식적인 방법을 제공하지 않는다 - `usePathname()` 문서가
 * 명시한다: "Reading the current URL from a Server Component is not
 * supported. This design is intentional to support layout state being
 * preserved across page navigations."(node_modules/next/dist/docs/01-app/
 * 03-api-reference/04-functions/use-pathname.md). `app/(admin)/layout.tsx` 는
 * 서버 컴포넌트라 `searchParams`/`params` 도 받지 않고, 그 계층에서 세션이
 * 죽은 것을 감지해 `/login`으로 보낼 때 `LOGIN_REDIRECT_PARAM` 에 실을
 * "지금 보던 경로"를 이 헤더 말고는 구할 방법이 없다.
 *
 * **메커니즘은 새로 만든 것이 아니다.** 이 파일이 회전된 access 쿠키를
 * 같은 요청의 downstream 에 전달하는 데 이미 쓰는 바로 그 기법이다
 * (`request.cookies.set` 뒤 `NextResponse.next({request:{headers}})`로
 * 넘기기 - 파일 상단 "이 메커니즘이 실제로 되는가" 절, `request.cookies`
 * 는 `request.headers` 의 `Cookie` 헤더를 감싼 것뿐이다). 같은 forwarding 을
 * 쿠키가 아닌 일반 헤더에 적용한 것이 이 상수다 - 실측(pnpm dev + curl,
 * 이 헤더를 상수 대신 하드코딩한 이전 버전으로): `/login?next=%2Ffoo%2Fbar`
 * 에 curl 하면 로그인 페이지(서버 컴포넌트)의 `headers()` 가 이 헤더 값으로
 * 정확히 `/login?next=%2Ffoo%2Fbar` 를 돌려주었다 - 별도 백엔드도 세션
 * 쿠키도 필요 없었다(이 헤더는 프록시가 다는 것이지 백엔드가 다는 것이
 * 아니라서).
 *
 * 값을 검사하지 않고 그대로 싣는다 - `LOGIN_REDIRECT_PARAM` 을 그대로
 * bind 하는 login/page.tsx 의 관례(그 파일 주석: "검사는 decideAfterSignIn
 * 한 곳에서만 한다")와 같은 이유다.
 */
export const REQUEST_PATH_HEADER = 'x-admin-request-path'

/**
 * 토큰 회전의 유일한 지점이자 경로 가드.
 *
 * 파일명 이력: 원래 middleware.ts였다. Next.js 16이 "middleware" 파일 컨벤션을
 * 폐기하고 proxy로 이름을 바꿨다(https://nextjs.org/docs/messages/middleware-to-proxy).
 *
 * 이름만 바뀐 게 아니다 - 실측으로 확인했다. middleware.ts는 기본 런타임이
 * Edge였고 `runtime: 'nodejs'`를 선택적으로 지정할 수 있었지만, proxy.ts는
 * **항상 Node.js 런타임에서만 돈다.** `config`에 `runtime`을 지정하면 그게
 * 무엇이든(`'nodejs'`를 명시해도) 프로덕션 빌드가 다음 에러로 죽는다 -
 * `Route segment config is not allowed in Proxy file ... Proxy always runs on
 * Node.js runtime.`(Next.js 16.3.4, next build로 직접 재현). 즉 proxy.ts에는
 * runtime 관련 config를 아예 넣지 않는다 - 넣을 수 없어서다.
 *
 * Docker 내부 주소(http://api:4000)로의 fetch는 middleware.ts(Edge 기본)일
 * 때도, proxy.ts(Node.js 고정)일 때도 예외 없이 200을 반환하는 것을 각각
 * 실측했다 - 어느 쪽이든 백엔드를 호출하는 데는 문제가 없다.
 *
 * ## 회전이 여기에만 있는 이유 - 재사용 감지 실측
 *
 * 백엔드는 refresh 회전 시 구 refresh token을 **즉시 폐기**한다. 정본에서 실제로 캡처한 순서:
 *
 *   ① refresh(유효한 토큰)        → 200, 새 쌍 발급
 *   ② refresh(①에서 쓴 구 토큰)   → 401 TOKEN_REVOKED
 *   ③ refresh(①이 준 새 토큰)     → 401 TOKEN_REVOKED   ← 새 토큰까지 죽었다
 *
 * ②가 재사용 감지를 발동시켜 **그 사용자의 활성 세션을 전부 폐기**한다 -
 * ③이 그 증거다. 한 페이지의 여러 서버 컴포넌트가 동시에 회전을 시도하면
 * 두 번째부터 정확히 이 ②를 밟아 사용자가 아무 잘못 없이 로그아웃된다.
 *
 * 이 자리는 요청당 정확히 한 번 돌고(아래 proxy() 는 decideRotation 이
 * 'rotate' 를 고른 요청 하나당 rotateSession 을 정확히 한 번만 부른다 -
 * 재시도하지 않는다), 그래서 경합이 원천적으로 없다. **이 파일을 나중에
 * 고치는 사람에게:** "회전을 여기 말고 저기서도 하면 편하겠는데"가 떠오르는
 * 순간 이 절을 다시 읽어라 - 두 곳에서 돌면 위 ②가 재현된다.
 *
 * **알려진 한계 - 요청 "안"이 아니라 요청 "간"의 경합은 이 설계 밖이다.**
 * 위 보장("요청당 정확히 한 번")은 *한 요청 안*의 이야기다. 같은 만료 임박
 * 쿠키를 실은 서로 다른 HTTP 요청 여러 개가 거의 동시에 도착하면(다중 탭,
 * 빠른 연속 네비게이션, Next App Router 의 링크 prefetch 등 - 전부 이
 * matcher 에 걸려 각자 proxy() 를 돈다) 그중 하나만 회전에 성공하고 나머지는
 * 이미 소비된 구 refresh 토큰을 내밀어 위 ②를 밟는다 - 실측(정본 백엔드,
 * 만료 임박 쿠키 하나로 동시 curl 5개): **1개 생존, 4개 TOKEN_REVOKED 로
 * 파기.** 각 요청은 자기 몫의 결과를 정확하게 처리했다(버그가 아니다) -
 * 다만 그 넷 각각의 사용자는 로그아웃된다.
 *
 * **왜 이대로 두는가.** 이걸 막으려면 요청 *간* 상태 공유가 필요하다 -
 * 인메모리 락은 이 프로세스 하나에서만 유효해 다중 인스턴스 배포에서
 * 깨지고, 외부 저장소(Redis 뮤텍스 등)는 이 프론트엔드 템플릿의 범위를
 * 넘는 새 인프라 의존성이다. **진짜 해법은 백엔드 쪽에 있다** - 회전 직후
 * 구 refresh 토큰에 짧은 유예(N 초)를 두는 것. 세 백엔드 템플릿 전체에
 * 걸친 결정이라 이 프론트엔드 프로젝트의 범위 밖에 있다.
 *
 * 이 자리가 이 역할을 독점하는 것은 구조적 제약이기도 하다 - 서버 컴포넌트는
 * 쿠키를 읽을 수만 있고 쓸 수 없다. 모든 요청을 거치면서 쿠키를 읽고 쓸 수
 * 있는 자리는 여기뿐이다. 공식 문서도 이런 경우(다른 방법으로 대체할 수 없을
 * 때)에만 이 자리를 쓰라고 명시적으로 권한다 - 이 저장소가 정확히 그 경우다.
 * 나중에 "권장하지 않는다니 없애자"는 논의가 나오면 이 문단을 근거로 삼는다.
 *
 * ## 결정과 결과 해석은 lib/auth/rotation.ts 가 순수 함수로 갖는다
 *
 * decideRotation(이번 요청에서 회전할지)과 interpretRotationOutcome(회전
 * 응답을 어떻게 해석할지)은 next/server 도 fetch 도 모르는 순수 함수다 -
 * 단위 테스트(test/unit/auth/rotation.test.ts)가 프레임워크를 스텁하지
 * 않고 "요청당 정확히 한 번"과 TOKEN_REVOKED/네트워크 실패 구별을 검증한다.
 * 이 파일(proxy())은 그 판단을 실제 NextRequest/NextResponse 에 기계적으로
 * 옮기는 얇은 층이다 - 그 옮김 자체도 test/unit/proxy.test.ts 가 실제
 * NextRequest 를 만들어 검증한다(next/server 는 next/headers 와 달리 요청
 * 스코프 밖에서도 던지지 않는다 - 실측: 이 파일의 테스트가 그냥 통과한다).
 *
 * ## 이 메커니즘이 실제로 되는가 - 실측
 *
 * 이 설계 전체가 두 가지에 의존한다: (1) 응답에 Set-Cookie 를 낼 수 있는가
 * (2) 같은 요청의 downstream(서버 컴포넌트의 next/headers 의 cookies())에
 * 회전된 값을 전달할 수 있는가. 추측하지 않고 pnpm dev + curl 로 실측했다.
 * 결론만: 둘 다 된다. (2)는 일반 커스텀 헤더가 아니라 **이 파일이 실제로
 * 쓰는 기법**(request.cookies.set 으로 Cookie 요청 헤더 자체를 다시 쓰고
 * NextResponse.next({request:{headers}})로 넘기기)으로 확인했다 - downstream
 * 서버 컴포넌트가 next/headers 의 cookies() 로 새 값을 정확히 읽었다.
 */
export async function proxy(request: NextRequest) {
  const decision = decideRotation({
    access: request.cookies.get(SESSION_COOKIE_ACCESS)?.value,
    refresh: request.cookies.get(SESSION_COOKIE_REFRESH)?.value,
  })

  // sessionPresent 는 "이 요청이 끝난 뒤 세션 쿠키가 존재하는가"이지 "access
  // 토큰이 지금 유효한가"가 아니다. 후자(백엔드가 실제로 access 를 받아줄지)
  // 는 이 자리의 책임이 아니다 - 만료된 토큰으로 시도하다 나는 401 은
  // errors.ts 의 destroySession 액션이 이후 요청에서 다룬다.
  // 이 구분 덕에 경로 가드는 "로그인했었는가"만 보면 되고 "지금 이 순간
  // 토큰이 신선한가"는 몰라도 된다.
  let sessionPresent: boolean
  let pendingWrites: readonly SessionCookieWrite[] = []
  let clearCookies = false

  if (decision.kind === 'anonymous') {
    sessionPresent = false
  } else if (decision.kind === 'pass') {
    sessionPresent = true
  } else if (decision.kind === 'destroy') {
    sessionPresent = false
    clearCookies = true
    console.warn(`[proxy] 세션 파기: ${decision.reason}`)
  } else {
    // decision.kind === 'rotate' - rotateSession 을 이 요청 안에서 정확히
    // 한 번만 부른다. 실패해도 재시도하지 않는다.
    // 브라우저의 Accept-Language 를 그대로 실어 보낸다.
    // 값이 없으면 headers.get 이 null 을 주고, withAcceptLanguage 가 헤더
    // 자체를 빼 백엔드 기본 언어로 떨어진다.
    const outcome = await rotateSession(
      decision.refreshToken,
      request.headers.get('accept-language'),
    )

    if (outcome.kind === 'rotated') {
      sessionPresent = true
      pendingWrites = sessionCookieWrites(
        outcome.session,
        getSettings().sessionCookieSecure,
        outcome.refreshExpiresIn,
      )
      // 같은 요청의 downstream(서버 컴포넌트의 next/headers 의 cookies())이
      // 새 access 토큰을 보게 한다 - 파일 상단 주석이 바로
      // 이 기법(request.cookies.set + NextResponse.next({request:{headers}}))
      // 이 동작함을 확인했다. response 의 Set-Cookie(아래)는 *다음* 요청을
      // 위한 것이고, 이 request.cookies.set 은 *이번* 요청의 downstream 을
      // 위한 것이다 - 서로 다른 문제를 푼다.
      for (const write of pendingWrites) {
        request.cookies.set(write.name, write.value)
      }
    } else if (outcome.kind === 'destroy') {
      sessionPresent = false
      clearCookies = true
      console.warn(`[proxy] 회전 거절 - 세션 파기: ${outcome.reason}`)
    } else {
      // outcome.kind === 'unreachable' - 세션은 죽지 않았다(백엔드가 판정을
      // 못 냈을 뿐이다 - 실측이 아니라 부재). 쿠키도 downstream 요청도
      // 건드리지 않는다 - 만료(예정)인 access 토큰을 그대로 통과시킨다.
      //
      // 판단: 파기하면 백엔드가 잠깐 죽은
      // 순간에 회전이 필요했던 모든 사용자가 로그아웃된다 - 자기 세션과
      // 무관한 장애로 쫓겨나는 것이다. 파기하지 않으면 이번 요청만 만료된
      // 토큰으로 시도하다 실패한다(그 401 은 이후 요청에서 errors.ts 의
      // destroySession 액션이 다룬다). 후자가 훨씬 싸다 -
      // "이번 요청 하나의 오류 배너" 대 "장애가 지속되는 동안 전원 로그아웃".
      sessionPresent = true
      console.warn(`[proxy] 회전 보류(백엔드 unreachable) - 기존 쿠키 유지: ${outcome.reason}`)
    }
  }

  const { pathname, search } = request.nextUrl
  if (isProtectedPath(pathname) && !sessionPresent) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(LOGIN_REDIRECT_PARAM, `${pathname}${search}`)
    const redirectResponse = NextResponse.redirect(loginUrl)
    if (clearCookies) {
      // path 를 명시하지 않아도 된다 - 처음엔 RFC 6265 의 default-path
      // 규칙(경로 없는 Set-Cookie 삭제는 "요청 경로"를 기본값으로 써서,
      // 이 두 쿠키(항상 path:'/'로 쓰였다 - session.ts)가 '/'가 아닌
      // 경로에서 지워지면 원래 쿠키와 어긋나 실제로 지워지지 않을 것)을
      // 근거로 명시적 path:'/' 를 넣었었다. 뮤테이션으로 지워 봐도 0개
      // 실패 - 조사해 보니 틀린 전제였다: RequestCookies.delete 는
      // 내부적으로 .set() 을 거치고, .set() 이 부르는 normalizeCookie
      // (node_modules/next/dist/compiled/@edge-runtime/cookies/index.js)
      // 가 `path`를 넘기지 않으면(undefined/null) 무조건 '/'로 채운다 -
      // 즉 이 라이브러리 계층에서 "요청 경로 기본값"은 애초에 적용되지
      // 않는다. clearSession()(session.ts)도 처음부터 path 없이
      // store.delete(name) 만 불렀는데 그게 옳았다 - 이 파일도 그 관례를
      // 따른다.
      //
      // **무엇을 지울지는 sessionCookieNames() 가 정한다**(session.ts) -
      // 이 파일의 두 파기 지점과 clearSession() 이 같은 목록을 쓴다. 여기
      // 이름을 늘어놓고 있으면 세 자리 중 하나만 어긋나도 아무 테스트가
      // 잡지 못한다.
      for (const name of sessionCookieNames()) {
        redirectResponse.cookies.delete(name)
      }
    }
    return redirectResponse
  }

  // REQUEST_PATH_HEADER 상수 선언부 참고 - 서버 컴포넌트가 pathname 을 읽을
  // 공식적인 방법이 없어서 여기서 실어 보낸다. pendingWrites/clearCookies 를
  // 건드리는 코드보다 먼저 두는 이유는 없다(순서 무관 - 이 둘은 서로 다른
  // 헤더/속성을 건드린다) - 그냥 이 응답이 옮기는 것 중 "이번 요청 자체의
  // 성질"인 것을 먼저 적었을 뿐이다.
  request.headers.set(REQUEST_PATH_HEADER, `${pathname}${search}`)
  const response = NextResponse.next({ request: { headers: request.headers } })
  for (const write of pendingWrites) {
    response.cookies.set(write.name, write.value, write.attributes)
  }
  if (clearCookies) {
    for (const name of sessionCookieNames()) {
      response.cookies.delete(name)
    }
  }
  return response
}

/**
 * proxy() 는 여기 잡힌 경로에만 돈다 - 여기서 빠지면 PROTECTED_PATH_PATTERNS
 * 는 그 요청을 아예 보지 못한다(그 경로의 Server Action 호출도 마찬가지다 -
 * lib/auth/guard.ts 상단 주석 참고).
 *
 * PROTECTED_PATH_PATTERNS 가 예외 목록(`/login` 만 공개)인 것과 이 매처가
 * 상호작용한다: 여기서 빠지는 모든 경로는 로그인 여부와 무관하게 항상
 * 통과한다. 지금은 `public/` 이 비어 있어 무해하지만, 로고·robots.txt·
 * manifest 같은 정적 자산을 `public/` 에 처음 추가하면 그 요청 경로도
 * proxy() 를 거친다 - 여기 예외에 추가하지 않으면 그 자산도 익명
 * 사용자에게는 `/login` 으로 리다이렉트된다(test/unit/proxy.test.ts 의
 * "public/ 자산 경로도 오늘은 보호된다" 가 오늘의 동작을 고정해 둔다).
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
