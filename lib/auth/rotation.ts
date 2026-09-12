/**
 * 회전 결정과 회전 결과 해석 - proxy.ts 가 쓰는 순수 함수들.
 *
 * proxy.ts 본체는 next/server 의 NextRequest/NextResponse 에 묶여 있고,
 * 실제 회전은 백엔드 fetch 를 낀다. 이 파일은 그중 **판단**만 뽑는다 - "이
 * 요청에서 회전할지"(decideRotation)와 "회전 응답을 어떻게 해석할지"
 * (interpretRotationOutcome). 둘 다 순수 함수라 next/server 나 fetch 를
 * 스텁하지 않고도 전수 테스트할 수 있다.
 *
 * 이 분리가 중요한 이유(실측): 백엔드는 refresh 회전 시 구 refresh token 을 즉시
 * 폐기하고, **폐기된 토큰을 다시 내밀면 그 사용자의 활성 세션이 전부
 * 끊긴다**(재사용 감지 - refresh(구 토큰) 후 refresh(방금 받은 새 토큰)까지
 * TOKEN_REVOKED 로 죽는 것을 정본에서 캡처했다). 회전이 요청당
 * 정확히 한 번만 일어난다는 것을 프레임워크를 띄우지 않고 검증하려면 결정
 * 로직이 순수해야 한다.
 */

import { request, withAcceptLanguage, type JsonApiResult } from '@/lib/jsonapi/client'
import { decodeAccessCookieValue } from './session'
import {
  isAccessExpiring,
  sessionFromTokenDocument,
  type AuthTokenAttributes,
  type Session,
} from './tokens'

/**
 * 프록시가 이번 요청에 무엇을 할지.
 *
 * `reason`을 destroy 갈래에 넣은 이유: 세션 파기는 사용자가 로그아웃되는
 * 사건인데 원인이 여럿이다(쿠키 반쪽 / 형식 깨짐 / 회전 거절). 로그에 남길
 * 수 있어야 조사가 된다 - 사용자에게 보여주는 문구가 아니다("프론트가
 * 문구를 만들지 않는다"는 사용자 대면 문구 이야기이고, 이건 로그다).
 */
export type RotationDecision =
  /** 세션 쿠키가 없다. 익명 요청이다. */
  | { kind: 'anonymous' }
  /** access 가 아직 넉넉하다. 그대로 통과시킨다. */
  | { kind: 'pass'; session: Session }
  /** access 가 임박했거나(또는 없거나) refresh 로 회전을 시도한다. */
  | { kind: 'rotate'; refreshToken: string }
  /** 쿠키가 깨졌거나 반쪽이다. 파기하고 익명으로 취급한다. */
  | { kind: 'destroy'; reason: string }

/**
 * cookies 는 원시 쿠키 값 그대로다(session.ts 의 SESSION_COOKIE_ACCESS/
 * SESSION_COOKIE_REFRESH 값) - accessExpiresAt 을 별도 필드로 받지 않는다.
 * 이유: session.ts 가 accessExpiresAt 을 access 쿠키 값 안에 `<epochMs>:<jwt>`
 * 형식으로 묶어 두기로 결정했다(원자성 - session.ts 파일 상단 주석). 이
 * 함수가 access 를 그대로 받아 decodeAccessCookieValue(session.ts 가 이미
 * export 해 둔 것)로 직접 해석하면, "만료 시각을 어떻게 꺼내는지"를 아는
 * 곳이 session.ts 하나로 유지된다 - 여기서 두 번째 파서를 만들면 형식이
 * 바뀔 때 한쪽만 고치는 어긋남이 생길 수 있다.
 */
export function decideRotation(
  // 선택 프로퍼티(access?:)가 아니라 필수 프로퍼티에 string | undefined 를
  // 쓴다 - exactOptionalPropertyTypes 아래에서는 이 둘이 다르다("생략 가능"
  // 대 "값이 있는데 undefined 일 수 있다"). 호출부(proxy.ts)가 넘기는
  // request.cookies.get(...)?.value 는 항상 프로퍼티가 존재하고 값만
  // string | undefined 이므로 이 모양이 정확하다 - session.ts 의
  // sessionFromCookieValues 와 같은 관례다.
  cookies: { access: string | undefined; refresh: string | undefined },
  now: number = Date.now(),
): RotationDecision {
  const { access, refresh } = cookies

  if (access === undefined) {
    if (refresh === undefined) return { kind: 'anonymous' }

    // refresh 만 있고 access 가 없다(판단이 필요한
    // 갈래). session.ts 의 sessionToCookies/clearSession 은 두 쿠키를
    // 항상 함께 쓰고 함께 지우므로 정상 경로로는 도달하지 않는 상태다 -
    // 브라우저가 용량 제한으로 쿠키 하나만 evict 했거나, 이전 응답의
    // Set-Cookie 일부만 적용됐을 때 생길 수 있는 이례적 상태로 본다.
    //
    // '즉시 파기' 대신 '회전 시도'를 고른다: 성공하면 사용자는 로그인
    // 화면을 보지 않고 세션을 회복한다. 실패하면(예: 이 refresh 마저
    // 이미 죽어 있어 TOKEN_REVOKED) interpretRotationOutcome 이 destroy 로
    // 수렴한다(아래) - 처음부터 destroy 를 고른 것과 결과가 같다. 즉 이
    // 선택은 최악의 경우가 같고 최선의 경우 더 낫다 - 순전히 이득이다.
    return { kind: 'rotate', refreshToken: refresh }
  }

  const decoded = decodeAccessCookieValue(access)
  if (decoded === undefined) {
    return { kind: 'destroy', reason: 'access 쿠키 형식이 깨졌다(decodeAccessCookieValue 실패)' }
  }

  if (refresh === undefined) {
    // access 만 있고 refresh 가 없다. readSession()(session.ts)의
    // sessionFromCookieValues 도 이 조합을 "세션 없음"으로 본다 - 두 값이
    // 모두 있어야 Session 을 만든다. 여기서 "아직 안 만료됐으니 통과"로
    // 봐주면 proxy 와 readSession 의 판단이 이 조합 하나에서만 갈라지고,
    // 지금 통과시켜도 이 access 가 만료되는 순간 refresh 가 없어 회전도
    // 못 하므로 결국 destroy 로 끝난다 - 미루지 않고 지금 끊는 것이
    // readSession 과 일관적이다. (참고: RotationDecision.pass 는 완전한
    // Session 을 실어야 하는데 Session.refreshToken 이 필수라 애초에
    // refresh 없이는 'pass' 를 만들 수조차 없다 - 타입이 이 결론과 일치한다.)
    return { kind: 'destroy', reason: 'refresh 쿠키가 없다(access 만 있는 반쪽 상태)' }
  }

  const session: Session = {
    accessToken: decoded.accessToken,
    refreshToken: refresh,
    accessExpiresAt: decoded.accessExpiresAt,
  }

  return isAccessExpiring(session, now)
    ? { kind: 'rotate', refreshToken: refresh }
    : { kind: 'pass', session }
}

/** 회전 요청(POST /auth/refresh)의 성공 응답이 회전 실패 시 destroy 로 이어진다. */
export type RotationOutcome =
  /** 회전 성공. 새 세션과, 두 쿠키에 쓸 maxAge(refreshExpiresIn, 초). */
  | { kind: 'rotated'; session: Session; refreshExpiresIn: number }
  /** 백엔드가 실제로 응답하고 거절했다(세션이 진짜 죽었다). 쿠키를 지운다. */
  | { kind: 'destroy'; reason: string }
  /** 백엔드가 판정을 내지 못했다(네트워크/타임아웃 등). 쿠키를 그대로 둔다. */
  | { kind: 'unreachable'; reason: string }

/**
 * POST /auth/refresh 의 성공 응답 모양(data.type=authTokens). attributes 는
 * tokens.ts 의 AuthTokenAttributes 와 같다 - 실측: test/fixtures/
 * documents.ts 의 AUTH_TOKENS 상수(정본에서 캡처한 값)가 이 모양이다.
 *
 * lib/jsonapi/document.ts 의 SingleDocument 를 그대로 쓰지 않는 이유:
 * 그 타입은 attributes 를 Attributes(Record<string, unknown>) | undefined 로
 * 느슨하게 잡아 이 호출부가 다시 좁혀야 한다 - 이 엔드포인트 하나만을 위한
 * 정밀한 모양을 여기 따로 둔다. request<T>() 는 T 를 런타임에 검증하지
 * 않으므로(이 저장소 전역 계약, client.ts) 이 좁힘은 백엔드가 계약대로
 * 응답한다는 신뢰 위에 있다 - 다른 request<T>() 호출부도 전부 같다.
 */
export interface AuthTokensDocument {
  data: {
    type: string
    id: string
    attributes: AuthTokenAttributes
  }
}

/**
 * 회전 요청의 결과(JsonApiResult)를 RotationOutcome 으로 해석한다.
 *
 * **TOKEN_REVOKED 와 네트워크 실패를 코드 문자열이 아니라 `status`로
 * 가른다.** client.ts 의 계약(REQUEST_ASSEMBLY_FAILED·NETWORK_ERROR 만
 * `status: 0`을 쓰고, 백엔드가 실제로 응답한 모든 경우는 `response.status`
 * 를 그대로 쓴다)이 이미 "백엔드가 판정을 냈는가"를 정확히 나눠 준다.
 *
 * `status !== 0`인 ok:false 는 전부 destroy 로 수렴시킨다 - TOKEN_REVOKED
 * 뿐 아니라 422 VALIDATION_ERROR(예: refreshToken 이 깨진 형식으로 갔을 때,
 * 실측)
 * 등 **어떤 거절 코드든** 같다 - 재시도하지 않는 정책 아래, 백엔드가 실제로
 * 응답해 거절한 토큰을 계속 들고 있어 봐야 다음 요청에서도 똑같이
 * 거절된다. code 별로 분기하지 않는 이유는 새 거절 코드가 추가돼도(백엔드
 * 카탈로그가 바뀌어도) 이 함수가 코드를 몰라도 옳게 동작해야 하기
 * 때문이다 - 판단 기준은 "백엔드가 응답했는가"이지 "어떤 코드였는가"가
 * 아니다.
 *
 * 오직 `status === 0`(백엔드가 아예 판정을 내지 못함)만 unreachable 이다 -
 * 세션이 죽었다는 증거가 없으므로 파기하지 않는다. 파기하면 백엔드가
 * 잠깐 죽었을 때 그 순간 회전이 필요했던 모든 사용자가 로그아웃된다.
 */
export function interpretRotationOutcome(
  result: JsonApiResult<AuthTokensDocument>,
  now: number = Date.now(),
): RotationOutcome {
  if (result.ok) {
    // JsonApiResult<T> 의 204 갈래는 status 로 좁혀지지 않는다(client.ts
    // 계약, tsc 실측) - document !== null 로 좁힌다.
    if (result.document === null) {
      // /auth/refresh 는 200 을 낸다(실측표) - 204 는 계약 위반이다. 세션을
      // 만들 재료(attributes)가 없으므로 파기한다.
      return { kind: 'destroy', reason: '회전 응답에 본문이 없다(204) - 계약 위반' }
    }
    const attributes = result.document.data.attributes
    return {
      kind: 'rotated',
      session: sessionFromTokenDocument(attributes, now),
      refreshExpiresIn: attributes.refreshExpiresIn,
    }
  }

  if (result.status === 0) {
    return {
      kind: 'unreachable',
      reason: `백엔드에 닿지 못했다: ${result.errors[0]?.code ?? 'UNKNOWN'}`,
    }
  }

  return {
    kind: 'destroy',
    reason: `백엔드가 회전을 거절했다(status ${result.status}, code ${result.errors[0]?.code ?? 'UNKNOWN'})`,
  }
}

/**
 * 실제로 백엔드에 회전을 요청하는 유일한 자리 - proxy.ts 가 이 함수 하나만
 * 부른다.
 *
 * 요청 본문 모양(`{ data: { type: 'refreshTokens', attributes: {
 * refreshToken } } }`)은 **실측하지 못했다** - Docker 가 내려가 있어 이
 * 태스크에서 실제 백엔드에 회전을 걸어 보지 못했다. 스펙(`POST /api/v1/auth/refresh refreshTokens →
 * authTokens`)의 표기와, 이 저장소가 다른 모든 자원 type 을 복수형으로
 * 쓰는 관례(authTokens, users, examples)를 근거로 추정했다.
 *
 * 위 추정은 그 뒤 정본 소스(`app/schemas/auth.py` 의
 * `RefreshTokenResource`)로 확인했다 - 모양이 정확히 같다.
 *
 * **실제 HTTP 왕복으로 확인했다 - 추정이 맞았다.**
 * test/e2e/auth.spec.ts 의 "만료가 임박한 access 쿠키가 들어오면 프록시가
 * 회전한다" 가 정본 백엔드를 상대로 이 요청을 실제로 내보내고, 새 쌍이
 * 발급돼 두 쿠키가 갱신되는 것을 본다. `type` 을 단수형(`refreshToken`)으로
 * 바꾸는 뮤테이션은 죽는다 - 정본이 422 를 내고 interpretRotationOutcome 이
 * destroy 로 수렴해 쿠키가 지워진다(실측).
 *
 * **아직 안 잰 것:** 그 E2E 는 쿠키의 만료 시각을 앞당겨 회전을 유도한다.
 * 백엔드가 내려준 `expiresIn` 이 **시간이 실제로 흘러** 회전을 발동시키는지는
 * 검증하지 않았다.
 *
 * `acceptLanguage` 를 함께 받아 백엔드로 전달한다. 회전 실패
 * 문구는 리다이렉트 때문에 사용자 눈에 닿지 않지만, "브라우저 요청을 대신해
 * 나가는 모든 백엔드 호출은 그 요청의 Accept-Language 를 전달한다"는 규칙을
 * 호출부마다 예외 판단 없이 적용한다 - 규칙이 예외보다 단순하고, 어느 오류가
 * 화면에 보이는지는 나중에 바뀔 수 있다.
 */
export async function rotateSession(
  refreshToken: string,
  acceptLanguage: string | null,
  now: number = Date.now(),
): Promise<RotationOutcome> {
  const result = await request<AuthTokensDocument>(
    '/api/v1/auth/refresh',
    withAcceptLanguage(
      {
        method: 'POST',
        body: { data: { type: 'refreshTokens', attributes: { refreshToken } } },
      },
      acceptLanguage,
    ),
  )
  return interpretRotationOutcome(result, now)
}
