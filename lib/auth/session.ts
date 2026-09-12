/**
 * 쿠키 세션 - 읽기·쓰기·삭제.
 *
 * 쿠키는 둘뿐이다: `session_access`, `session_refresh`(SESSION_COOKIE_ACCESS/SESSION_COOKIE_REFRESH). 암호화 세션 라이브러리를
 * 쓰지 않는다 - 담는 값이 이미 서명된 JWT 이고 쿠키가 httpOnly 라 브라우저
 * 스크립트가 읽을 수 없으므로 별도 암호화 계층이 막아 줄 위협이 없다.
 *
 * ## accessExpiresAt 을 어디에 담나 - 세 선택지와 판단
 *
 * tokens.ts 의 Session 은 accessToken 과 함께 accessExpiresAt(절대 만료 시각,
 * epoch ms)을 들고 다닌다. 이걸 쿠키로 내릴 때 세 선택지가 있었다:
 *
 * 1. 세 번째 쿠키(예: session_access_expires_at)에 숫자만 담는다.
 * 2. access 쿠키의 값 자체에 accessToken 과 함께 담는다(이 파일이 고른 것).
 * 3. 쿠키의 maxAge 로 표현한다 - **탈락**. HTTP 쿠키는 Max-Age/Expires 를
 *    서버로 되돌려주지 않는다 - 브라우저가 다음 요청에 보내는 `Cookie` 헤더는
 *    이름=값 쌍뿐이다(실측: `@edge-runtime/cookies`의 `RequestCookie` 타입이
 *    `Pick<CookieListItem, 'name' | 'value'>`이고, `next/headers`의 cookies()
 *    가 감싸는 `ReadonlyRequestCookies`·`NextRequest.cookies`가 감싸는
 *    `RequestCookies` 둘 다 이 타입을 쓴다 - node_modules/next/dist/compiled/
 *    @edge-runtime/cookies/index.d.ts 로 확인). 즉 이 요청에서 maxAge 로
 *    설정해도 다음 요청에서 proxy.ts 가 그 값을 다시 읽을 방법이 없다 -
 *    isAccessExpiring 판정 자체가 불가능해진다. 대안이 아니라 애초에 성립하지
 *    않는 선택지였다.
 *
 * 1번과 2번 중 2번을 골랐다. 이유는 원자성이다 - accessToken 이 회전될 때마다
 * accessExpiresAt 도 함께 바뀌어야 하는데, 두 값이 서로 다른 쿠키에 있으면
 * "쓰기 하나를 깜빡했다"는 실수가 두 쿠키를 서로 다른 세대로 어긋나게 만들
 * 수 있다(새 토큰 + 헌 만료 시각, 혹은 그 반대). encodeAccessCookieValue 를
 * 유일한 쓰기 경로로 두면 이 어긋남 자체가 구조적으로 불가능해진다. 대가는
 * session_access 쿠키의 값이 더 이상 "그 자체로 JWT"가 아니라는 것이다 -
 * 브라우저 devtools 에서 값을 복사해 곧바로 Authorization 헤더에 쓸 수
 * 없다(만료 시각과 콜론으로 묶여 있다). decodeAccessCookieValue 가 이 형식을
 * 아는 유일한 곳이라, 이 트레이드오프를 감수할 만하다고 판단했다.
 *
 * ## maxAge - 세션의 실제 수명은 refresh 토큰이 정한다
 *
 * 두 쿠키 모두에 `refreshExpiresIn`(초, authTokens 문서의 그 필드)을 그대로
 * `maxAge`로 준다(최초 버전은 브라우저 세션 쿠키로 남겨
 * 두었었다). 그 필드가 문서에 실려 오는 이유가 정확히 "클라이언트가 이만큼
 * 세션을 유지해도 된다"이고, `expiresIn`은 쓰면서 `refreshExpiresIn`만
 * 버리면 같은 문서의 두 필드를 비대칭으로 다루는 것이다 - 30일짜리 refresh
 * 토큰을 쥐고도 브라우저를 닫으면 로그아웃되는 건 그 계약을 잘못 시연한다.
 *
 * access 쿠키에도 (자신의 `expiresIn`이 아니라) 같은 `refreshExpiresIn`을
 * 준다. access 토큰 자신의 만료는 이미 쿠키 값 안에 절대 시각으로 들어
 * 있으므로(위 2번 선택) 브라우저 쪽 수명을 짧게 잡을 이유가 없다 - 짧게
 * 잡으면 "refresh 는 살아 있는데 access 쿠키만 사라진" 상태가 브라우저를
 * 재시작할 때마다 생기고, 그 갈래를 proxy.ts 가 추가로 다뤄야 한다.
 *
 * `refreshExpiresIn`을 상수로 박지 않는다 - `sessionCookieAttributes`가
 * 인자로 받고, `writeSession`이 호출자에게서 그대로 받아 넘긴다. 백엔드의
 * refresh 만료 설정(`expiresIn`이 `JWT_ACCESS_EXPIRES_SECONDS`를 그대로
 * 반영하는 것으로 실측됐던 것과 같은 종류의 설정값)이 바뀌면 프론트가
 * 재배포 없이도 그 값을 그대로 따라간다.
 *
 * **보안 절충.** `maxAge`를 주면 공용 컴퓨터에서 브라우저를 닫아도 세션이
 * 최대 `refreshExpiresIn`(기본 30일)만큼 남는다. 사고가 아니라 그 필드가
 * 존재하는 계약의 의도이지만, 배포 맥락에 따라 원치 않을 수 있다. **그때는**
 * `SessionCookieAttributes`에서 `maxAge`를 다시 선택 필드로 풀고
 * `sessionCookieWrites`가 `sessionCookieAttributes(secure)`를 `maxAge`
 * 없이 부르게 되돌리면 브라우저 세션 쿠키(브라우저를 닫으면 사라짐)로
 * 복귀한다 - `writeSession`을 포함한 나머지 코드는 안 건드려도 된다.
 *
 * ## ⚠️ Next 16 의 cookies() 함정 - 타입이 막아 주지 않는다
 *
 * `next/headers`의 `cookies()`는 Promise 다 - 반드시 `await` 한다.
 * 반환 타입 `ReadonlyRequestCookies`는
 * `Omit<RequestCookies, 'set'|'clear'|'delete'> & Pick<ResponseCookies, 'set'|'delete'>`
 * 라 `.set()`·`.delete()`가 타입에 버젓이 있다 - 하지만 **서버 컴포넌트에서
 * 부르면 런타임에 던진다.** Server Action·Route Handler 에서만 실제로
 * 동작한다. 타입 검사기는 이 구분을 전혀 모른다 - `writeSession`·
 * `clearSession`을 서버 컴포넌트에서 호출해도 `pnpm typecheck`는 통과하고
 * `next build`도 통과한다. 오직 이 주석과 함수 앞의 경고만이 방어선이다.
 */

import { cookies } from 'next/headers'
import { getSettings } from '@/lib/config/settings'
import type { Session } from './tokens'

export const SESSION_COOKIE_ACCESS = 'session_access'
export const SESSION_COOKIE_REFRESH = 'session_refresh'

/**
 * access 쿠키 값 안에서 만료 시각과 토큰을 가르는 구분자.
 *
 * JWT(base64url)는 콜론을 담지 않으므로 콜론을 쓴다. 이 상수는 export 하지
 * 않는다 - 이 파일 밖에서 값을 직접 split 하면 형식이 두 곳에 흩어져 위
 * 파일 주석이 막으려는 "원자성이 깨지는" 실수의 축소판이 재현된다. 형식을
 * 알아야 하는 코드는 encodeAccessCookieValue/decodeAccessCookieValue 를 거쳐라.
 *
 * **와이어에서는 이 콜론이 `%3A` 다(실측).** Next 의
 * `ResponseCookies.set()` 이 값을 퍼센트 인코딩하므로 브라우저가 보관하는
 * 값은 `1788...%3AeyJhbGci...` 이고, 읽을 때 `RequestCookies` 가 되돌려
 * 주므로 `decodeAccessCookieValue` 는 콜론을 본다. 왕복이 성립하니 코드는
 * 손댈 것이 없지만, devtools 로 쿠키를 들여다보는 사람이 형식을 못 알아보는
 * 일이 없도록 적어 둔다(위 파일 상단이 말한 "그 자체로 JWT 가 아니다"에
 * 인코딩까지 더해진다).
 */
const ACCESS_COOKIE_SEPARATOR = ':'

/** 정수 문자열만 허용한다. Number()만 쓰면 ' '(0)·'0x10'(16)·'1e3'(1000)까지 통과한다. */
const INTEGER_PATTERN = /^-?\d+$/

function parseEpochMs(raw: string): number | undefined {
  if (!INTEGER_PATTERN.test(raw)) return undefined
  return Number(raw)
}

export function encodeAccessCookieValue(accessToken: string, accessExpiresAt: number): string {
  return `${accessExpiresAt}${ACCESS_COOKIE_SEPARATOR}${accessToken}`
}

export function decodeAccessCookieValue(
  raw: string,
): { accessToken: string; accessExpiresAt: number } | undefined {
  const separatorIndex = raw.indexOf(ACCESS_COOKIE_SEPARATOR)
  if (separatorIndex === -1) return undefined

  // 토큰 자체는 콜론을 담지 않지만(base64url), 혹시 담더라도 첫 구분자 이후
  // 전부를 토큰으로 본다 - 뒷부분을 잘라내면 서명 검증이 깨진다.
  //
  // 아래 두 가드(accessToken 공백, accessExpiresAt 파싱 실패)의 순서를
  // 바꿔도 결과는 같다(실측: 뮤테이션 테스트로 확인, 23개 테스트 전부 통과) -
  // 서로 다른 부분 문자열만 보는 독립적인 조건이라 순서와 무관하게 같은
  // undefined 로 수렴한다. 지금 순서(토큰 먼저)는 위 주석의 서술 순서를
  // 따른 것뿐이다.
  const accessToken = raw.slice(separatorIndex + 1)
  if (accessToken === '') return undefined

  const accessExpiresAt = parseEpochMs(raw.slice(0, separatorIndex))
  if (accessExpiresAt === undefined) return undefined

  return { accessToken, accessExpiresAt }
}

/**
 * 세션을 이루는 쿠키 이름 **전부** - 지울 때 쓴다(`clearSession`, `proxy.ts` 의
 * 두 파기 지점).
 *
 * `sessionCookieWrites` 와 같은 이유로 순수 함수다(그 함수 주석 참고). 삭제
 * 쪽에는 그 대응물이 없었고, 그 공백에서 **쿠키 하나만 지우는 뮤턴트가
 * 살아남았다**. 실패 시나리오가 정확히
 * 나쁘다: `session_refresh` 만 남으면 `sessionFromCookieValues` 가 두 쿠키를
 * 모두 요구하므로 사용자에게는 로그아웃된 것처럼 보이는데, 백엔드 폐기가
 * 실패한 경우(= 로그아웃이 이 순서로 설계된 바로 그 상황 - logout.ts 의
 * `endSession`) **살아 있는 장기 자격증명이 브라우저에 만료까지 남는다.**
 *
 * 목록을 `sessionToCookies` 에서 생성하지 않는 이유: 그 함수는 이름뿐 아니라
 * 값도 만들어야 해서 쿠키마다 유도 방식이 다르다(access 는 만료 시각과 묶고
 * refresh 는 날것이다). 즉 둘은 진짜로 서로 다른 두 목록이고, 그래서 "쓰는
 * 목록과 지우는 목록이 같다"가 지켜야 할 계약으로 남는다 - session.test.ts 가
 * 그 둘을 직접 맞춰 본다. 한쪽으로 생성하게 만들면 그 계약을 지킬 자리가
 * 사라진다.
 *
 * **"그 목록을 다 쓰는가"까지 이제 지켜진다.** 위 순수 함수들은
 * 목록의 *내용*을 지키지만, `clearSession`·`writeSession` 이 그 목록을 온전히
 * 소비하는지는 `cookies()` 가 요청 스코프를 요구해 단위 테스트가 볼 수 없었고
 * `.slice(0, 1)` 뮤턴트가 거기 살았다. test/e2e/auth.spec.ts 가 가입 뒤
 * 두 쿠키가 다 있고 로그아웃 뒤 하나도 안 남는지를 브라우저에서 보므로 그
 * 뮤턴트 둘이 이제 죽는다(실측).
 */
export function sessionCookieNames(): string[] {
  return [SESSION_COOKIE_ACCESS, SESSION_COOKIE_REFRESH]
}

export interface SessionCookieEntry {
  name: string
  value: string
}

/** Session 을 실제로 쿠키에 쓸 이름·값 쌍 두 개로 바꾼다. 순서는 access, refresh 다. */
export function sessionToCookies(session: Session): SessionCookieEntry[] {
  return [
    {
      name: SESSION_COOKIE_ACCESS,
      value: encodeAccessCookieValue(session.accessToken, session.accessExpiresAt),
    },
    { name: SESSION_COOKIE_REFRESH, value: session.refreshToken },
  ]
}

/**
 * 두 쿠키의 원시 값에서 Session 을 복원한다. 쿠키가 하나라도 없거나
 * access 쿠키 값이 깨져 있으면 undefined - 반쯤 복원된 세션을 만들지 않는다.
 *
 * 여기서 만료 판정을 하지 않는다 - 이미 만료된 세션도 그대로 돌려준다.
 * "만료됐으니 세션이 아니다"를 판단하는 곳은 isAccessExpiring(tokens.ts)
 * 하나뿐이어야 하고, 회전은 proxy.ts 하나뿐이어야 한다 - 이 함수가
 * 나름의 만료 판정을 얹으면 그 판정이 isAccessExpiring 과 조용히 갈라질 수 있다.
 */
export function sessionFromCookieValues(
  accessValue: string | undefined,
  refreshValue: string | undefined,
): Session | undefined {
  if (accessValue === undefined || refreshValue === undefined) return undefined

  const decoded = decodeAccessCookieValue(accessValue)
  if (decoded === undefined) return undefined

  return {
    accessToken: decoded.accessToken,
    refreshToken: refreshValue,
    accessExpiresAt: decoded.accessExpiresAt,
  }
}

export interface SessionCookieAttributes {
  httpOnly: true
  sameSite: 'lax'
  path: '/'
  secure: boolean
  maxAge: number
}

/**
 * 두 세션 쿠키가 공통으로 쓰는 속성. `maxAge`는 초 단위 상대값을
 * 인자 그대로 받는다 - 이 함수는 그 값이 `refreshExpiresIn`에서 왔다는 것도,
 * 왜 access 쿠키에도 같은 값을 쓰는지도 모른다(그 판단과 근거는 파일 상단
 * "maxAge" 절, 실제 결정은 writeSession 이 한다). 이 함수는 순수하게 "쿠키
 * 속성 객체를 만든다"만 한다 - `maxAge`를 상수로 박지 않고 인자로 받는 것
 * 자체가 그 분리를 지킨다.
 */
export function sessionCookieAttributes(secure: boolean, maxAge: number): SessionCookieAttributes {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge }
}

export interface SessionCookieWrite extends SessionCookieEntry {
  attributes: SessionCookieAttributes
}

/**
 * writeSession 이 두 쿠키에 실제로 쓸 이름·값·속성을 전부 계산한다 - 어떤
 * 값이든 이 함수를 거치지 않고는 store.set() 에 닿지 않는다.
 *
 * writeSession 을 next/headers 없이 단위 테스트할 수 없어서(파일 상단
 * 주석 참고) 이 함수를 따로 뺐다 - refreshExpiresIn 을 상수로 바꿔치기하는
 * 뮤테이션이 writeSession 안에 있으면 아무 테스트도 못 잡는다는 것을 직접
 * 확인했다(24개 전부 통과). 그 판단 로직 전부를 여기로 옮기고 나면
 * writeSession 에는 store.set() 을 호출하는 것 말고 판단이 남지 않는다.
 */
export function sessionCookieWrites(
  session: Session,
  secure: boolean,
  refreshExpiresIn: number,
): SessionCookieWrite[] {
  const attributes = sessionCookieAttributes(secure, refreshExpiresIn)
  return sessionToCookies(session).map((entry) => ({ ...entry, attributes }))
}

/**
 * 현재 세션을 읽는다. 읽기 전용이라 서버 컴포넌트에서도 안전하다.
 *
 * 쿠키가 없거나 깨져 있으면 undefined - 호출자가 "로그인 안 됨"으로 다룬다.
 * accessToken 이 이미 만료됐어도 그대로 돌려준다(sessionFromCookieValues 참고) -
 * 만료 판정은 isAccessExpiring 몫이다.
 */
export async function readSession(): Promise<Session | undefined> {
  const store = await cookies()
  return sessionFromCookieValues(
    store.get(SESSION_COOKIE_ACCESS)?.value,
    store.get(SESSION_COOKIE_REFRESH)?.value,
  )
}

/**
 * 세션 쿠키를 쓴다(로그인·회전).
 *
 * `refreshExpiresIn`(초, authTokens 문서의 그 필드를 호출자가 그대로 넘긴다)을
 * 두 쿠키의 maxAge 로 함께 쓴다 - 파일 상단 "maxAge" 절이 근거다. 호출자
 * (로그인 흐름, 회전 로직)는 같은 authTokens 문서에서 Session 과
 * refreshExpiresIn 을 함께 얻으므로 이 함수가 따로 어딘가에서 값을 끌어올
 * 필요가 없다.
 *
 * 어떤 이름·값·속성을 쓸지는 전부 sessionCookieWrites 가 정한다 - 이
 * 함수 자신은 그 결과를 store.set() 에 그대로 넘기는 것 말고는 판단이 없다
 * (이 함수를 next/headers 없이 단위 테스트할 수 없어서 판단 로직을 전부
 * 그쪽으로 뺐다).
 *
 * ⚠️ Server Action·Route Handler 전용이다. 서버 컴포넌트에서 부르면 타입
 * 검사는 통과하지만 런타임에 던진다 - 파일 상단 주석 참고.
 */
export async function writeSession(session: Session, refreshExpiresIn: number): Promise<void> {
  const store = await cookies()
  const writes = sessionCookieWrites(session, getSettings().sessionCookieSecure, refreshExpiresIn)
  for (const { name, value, attributes } of writes) {
    store.set(name, value, attributes)
  }
}

/**
 * 세션 쿠키를 지운다(로그아웃).
 *
 * **무엇을 지울지는 `sessionCookieNames()` 가 정한다** - writeSession 이
 * sessionCookieWrites 에 판단을 맡긴 것과 같은 분리다. 이 함수 자신에는
 * 목록이 남아 있지 않다(여기 이름 둘을 늘어놓고 있으면
 * 하나를 빠뜨리는 뮤턴트를 아무 테스트도 잡지 못한다).
 *
 * ⚠️ Server Action·Route Handler 전용이다 - writeSession 과 같은 런타임 제약.
 */
export async function clearSession(): Promise<void> {
  const store = await cookies()
  for (const name of sessionCookieNames()) {
    store.delete(name)
  }
}
