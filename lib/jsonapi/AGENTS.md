<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-11 | Updated: 2026-09-11 -->

# lib/jsonapi/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 이 디렉터리에 배정한 것: 문서 파싱
(`document.ts`) · `included` 정규화와 관계 해석(`normalize.ts`) · 쿼리 파라미터
직렬화(`query.ts`) · 오류 분류(`errors.ts`) · HTTP 클라이언트(`client.ts`). 백엔드
템플릿들의 `app/jsonapi/`와 마주 보는 계층이다.

## 자원을 모른다

이 디렉터리는 어떤 자원 이름도 몰라야 한다. `lib/resources/`가
자원을 선언하고, 이 디렉터리는 그 자원이 무엇이든 상관없이 동작해야 한다.

위반의 정의 - 다음 중 하나라도 코드에 나타나면 위반이다(주석의 설명적
언급은 위반이 아니다 - 예를 들어 이 파일 위쪽 문단처럼 규칙 자체를 설명하는
문장은 대상이 아니다):

- `examples` · `exampleTags` · `exampleCategories`처럼 이 저장소의 실제 자원
  이름을 가리키는 문자열 리터럴.
- 자원별 필드 이름(`title` · `score` · `category` 등)에 의존하는 분기.
- `app/`이 아는 것(화면 경로, 폼 스키마, 표시 라벨)을 가져와 쓰는 코드.

이 디렉터리에 있어도 되는 문자열은 JSON:API 문법 자체(`'data'` · `'attributes'`
· `'relationships'` · `page[...]`), 연산자 이름, 오류 **코드**(문구가 아니다),
미디어 타입, HTTP 헤더 이름이다.

검증은 기계적인 grep 하나로 끝나지 않는다 - 자원 이름 문자열을 흉내 낸 예시가
설명 주석에 등장할 수 있어서, 히트가 나오면 사람이 "실제 코드 참조인가 설명
문장인가"를 확인해야 한다(인용부호를 붙여도 `document.ts`의 설명 주석 자체가
`'examples'`를 그대로 인용하고 있어서 계속 걸린다).

## 오류 문구 카탈로그를 두지 않는다

`errors.ts`는 code로 동작만 분기한다(`destroySession` · `notFound` ·
`fieldErrors` · `banner` · `transport`). 표시 문구(`title` · `detail`)는 백엔드가
낸 값을 그대로 쓴다 - 프론트가 문구 카탈로그를 따로 두면 백엔드가 문구를
고쳐도 화면은 옛 문구를 보여주는 상태가 조용히 생긴다.

예외는 `client.ts`가 합성하는 세 코드(`REQUEST_ASSEMBLY_FAILED` ·
`NETWORK_ERROR` · `NON_JSONAPI_RESPONSE`)뿐이다 - 백엔드가 응답조차 주지 못한
상황이라 프론트가 문구를 가질 수밖에 없다. 이 세 코드의 `detail`은
고정 문구여야 한다 - 엔진이 던진 원문 예외 메시지를 그대로 담지 않는다(사용자
배너에 영어 원문이 새 나간다). 원문이 필요하면 `meta`처럼 사용자 대면이 아닌
자리로 보낸다.

이 세 코드는 `actionForErrors`에서 `'transport'`로 분류된다 - `banner`와
달리 화면이 아니라 `app/error.tsx`가 받는다. 분류
수단은 code 문자열이 아니라 `client.ts`가 내보내는 `isSyntheticError`다 -
`synthesizeError`를 거쳐 만든 오류라면 무엇이든 자동으로 이 표시가 붙으므로,
합성 코드를 새로 추가해도 `synthesizeError` 호출 하나 외에는 고칠
자리가 없다. 화면이든 다른 모듈이든 `NETWORK_ERROR` 같은 문자열을 직접
비교하면 이 규칙 위반이다 - `actionForErrors(...) === 'transport'`를 대신
써라.

## 파일 탐색과 검증

| 파일           | 역할                                                                |
| -------------- | ------------------------------------------------------------------- |
| `document.ts`  | 문서·자원·오류 타입과 `unknown` 문서 판별.                          |
| `normalize.ts` | type와 id를 함께 쓰는 색인, 관계 대상 복원과 식별자 대체값.         |
| `query.ts`     | 쿼리 문법 필터링, 필터·정렬·페이지 직렬화와 링크 쿼리 추출.         |
| `errors.ts`    | 포인터별 오류 배치, 오류 동작 우선순위와 문구 묶음.                 |
| `client.ts`    | JSON:API 미디어 타입·언어·토큰 헤더, `no-store` 요청과 결과 유니온. |

정책의 허용 여부는 백엔드가 판정한다. 쿼리 계층은 문법을 골라 전달하며 커서를
해석하거나 직접 만들지 않는다. `request<T>()`의 `T`는 성공 문서의 런타임
검증기가 아니다. 204는 `document: null`이므로 `document !== null`로 좁힌다.
클라이언트에 인증 재시도를 더하지 않는다. 배포 설정 오류는 `getSettings()`에서
던지며 요청별 실패를 합성하는 `try` 안으로 옮기지 않는다.

단위 검증은 `test/unit/jsonapi/`, 실제 계약은 `test/e2e/`에서 확인한다.
최종 검증은 `./scripts/check.sh`다. 내부 설정 의존성은
`lib/config/settings.ts`이고 HTTP·URL 처리는 표준 `fetch`·`Headers`·
`URLSearchParams`를 사용한다. 이 계층을 실제로 import하는 곳은
`lib/auth/`(요청 조립과 오류 분류), `app/(admin)/examples/`(목록 화면이
`request`를 직접 부른다)와 `components/grid/`(응답 문서 정규화)다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
