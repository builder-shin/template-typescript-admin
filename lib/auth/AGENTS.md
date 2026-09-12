<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-11 | Updated: 2026-09-11 -->

# lib/auth/ 작업 지침

인증 요청과 결과 해석, 세션 쿠키, 만료 판정과 Server Action 가드를 소유한다.
쿠키·이동 같은 요청 스코프의 동작과 단위 테스트가 부를 수 있는 판단을 구분한다.

## 주요 파일

| 파일             | 역할                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `credentials.ts` | 가입·로그인 문서와 요청, 응답 해석, 가입 후 로그인 흐름.            |
| `flow.ts`        | 안전한 복귀 경로, 인증 폼 오류 상태, 로그인·가입 후 실행할 결정 값. |
| `form-state.ts`  | 런타임 import 없는 폼 상수·상태·전송 실패 안내.                     |
| `guard.ts`       | `LOGIN_PATH`와 쓰기 Action의 `requireSession()` 가드.               |
| `logout.ts`      | 쿠키를 먼저 지우고 refresh 세션 폐기를 요청하는 `endSession()`.     |
| `rotation.ts`    | 회전 필요 여부와 응답의 순수 판정, refresh 요청.                    |
| `session.ts`     | 두 쿠키의 직렬화·속성·읽기·쓰기·삭제.                               |
| `tokens.ts`      | 세션·토큰 타입과 `expiresIn` 기반 절대 만료 시각, 60초 여유 판정.   |

## 작업 규칙

- 회전의 호출 지점은 루트 `proxy.ts` 하나다. HTTP 클라이언트나 Action에
  401 재시도·추가 회전을 만들지 않는다. 폐기된 refresh 토큰 재사용은 세션을 끊는다.
- access 쿠키의 만료 시각과 토큰은 `session.ts`의 인코더·디코더를 거친다.
  `readSession()`과 가드는 세션 존재만 보고 만료 판정을 추가하지 않는다.
- `writeSession()`과 `clearSession()`은 Server Action·Route Handler에서만 쓴다.
  서버 컴포넌트는 읽기만 한다. 두 쿠키의 수명은 `refreshExpiresIn`으로 함께 정한다.
- `form-state.ts`에 import를 추가하지 않는다. 클라이언트가 읽는 값에 서버의
  설정·HTTP 의존성을 끌어들이지 않기 위한 경계다. 폼 상태에는 비밀번호를 담지 않는다.
- 요청의 `Accept-Language`를 인자로 받아 전달한다. 인증 실패 문구는 백엔드가
  준 포인터와 문구로 배치하며 오류 코드별 필드·문구 카탈로그를 만들지 않는다.
- 로그아웃은 쿠키 삭제가 백엔드 호출보다 먼저다. `flow.ts`는 이동 대상을 값으로
  반환하고 Action이 실행한다. `lib/`에서 라우팅 모듈 `proxy.ts`를 import하지 않는다.

## 검증과 의존성

순수한 결정·직렬화는 `test/unit/auth/`, 실제 쿠키·회전·가드·폼 왕복은
`test/e2e/auth.spec.ts`가 확인한다. 요청 스코프를 단위 테스트에서 스텁하지
않는 저장소 규칙을 지킨다. 최종 검증은 `./scripts/check.sh`다.

내부 의존성은 `lib/jsonapi/`와 `lib/config/settings.ts`, 외부 의존성은
`next/headers`·`next/navigation`이다. 호출부는 `proxy.ts`와 `app/`에 있다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
