import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'

/**
 * 로그인한 운영자 조회 - `count.ts`·`health.ts`와 같은 이유로 화면(`layout.tsx`)
 * 옆에 둔다(lib/resources/ 는 어떤 내부 모듈도 import 하지 않는 순수 선언
 * 계층이라 `RequestOptions`를 값으로 끌어오는 이 함수를 두면 그 규칙이
 * 깨진다). `users`는 `lib/resources/`가 아는 자원이 아니다 - 실측(2026-09-12):
 * `/api/v1/users`는 `GET /me` 하나뿐이고 목록·필터·정렬이 없어 `ResourceDef`가
 * 표현하는 것(필터·정렬·폼 스키마)을 하나도 갖지 않는다.
 *
 * 실측(2026-09-12, `user` 모델 칼럼): `id`·`email`·`password_hash`·
 * `is_active`와 타임스탬프뿐이다 - **`name`이 계약에 없다.** 그래서 이 파일이
 * 내보내는 `Operator`는 이메일 하나만 갖는다(사이드바가 "이름이 있는 척"
 * 하지 않는다 - `components/nav-user.tsx`).
 */
export const OPERATOR_PATH = '/api/v1/users/me'

/**
 * `/me`는 토큰이 곧 신원이다 - 다른 자원과 달리 누구의 정보인지 물을 방법이
 * accessToken 뿐이라 **필수 인자다**(countRequest 등의 acceptLanguage 필수
 * 인자와 같은 이유 - 잊고 안 넘기면 컴파일이 막아야 한다).
 */
export function operatorRequest(
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [OPERATOR_PATH, withAcceptLanguage({ accessToken }, acceptLanguage)]
}

export interface Operator {
  readonly email: string
}

/**
 * 단일 문서에서 이메일만 뽑는다. `email`이 문자열이 아니면(계약 위반이거나
 * `data`가 아예 없거나) `null` - `options.ts`의 `optionsFromDocument`와 같은
 * 방어이되, 대체값을 만들지 않는 쪽을 고른 이유는 이메일에는 id 같은
 * "대신 보여줘도 되는" 값이 없기 때문이다. 호출자(`layout.tsx`)는 이 `null`을
 * "그 영역을 비운다"로 다룬다 - "알 수 없는 사용자" 같은 문구를 지어내지
 * 않는다(`components/nav-user.tsx`).
 */
export function operatorFromDocument(document: SingleDocument): Operator | null {
  const email = document.data?.attributes?.email
  return typeof email === 'string' ? { email } : null
}

/**
 * 요청 자체가 실패했거나(네트워크·4xx·5xx) 204(본문 없음)인 경우까지 묶어서
 * `null`로 접는다 - `classifyHealth`(health.ts)와 같은 판단이다: 운영자 카드
 * 하나를 못 그린다고 화면 전체를 `error.tsx`로 끌고 내려갈 이유가 없다(count.ts
 * 의 `readTotal`이 없는 총합에 던지는 것과 다른 선택 - 총합 없음은 계약
 * 위반이지만, 운영자 조회 실패는 세션 만료·백엔드 일시 장애처럼 화면이 계속
 * 살아 있어야 하는 흔한 갈래다).
 */
export function operatorFromResult(result: JsonApiResult<SingleDocument>): Operator | null {
  if (!result.ok || result.document === null) return null
  return operatorFromDocument(result.document)
}
