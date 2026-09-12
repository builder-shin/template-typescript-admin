<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-11 | Updated: 2026-09-11 -->

# jsonapi

JSON:API 공통 코어의 문법·문서 형태·정규화·오류 분류·HTTP 요청 계약을 검사한다.

## 주요 파일

| 파일                    | 역할                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `document.test.ts`      | 오류·목록·단일 문서 판별과 잘못된 배열 원소·혼합 문서 경계        |
| `normalize.test.ts`     | `type:id` 색인, to-one/to-many 해석과 included가 없을 때의 식별자 |
| `query.test.ts`         | 쿼리 허용 문법·직렬화, 필터/페이지 이름과 정렬 토큰               |
| `errors.test.ts`        | pointer 기반 위치, 행동 분류, 합성 오류와 문구 그룹화             |
| `client.test.ts`        | URL·헤더·본문 조립, 응답·204·예외 해석과 언어 전달                |
| `error-routing.test.ts` | 실제 `request()` 결과를 `actionForErrors()`에 넣는 모듈 간 연결   |

## 작업 규칙

- 공통 코어는 자원 정책을 모른다. 문법에 맞는 미지원 필드·연산자도 백엔드에
  전달되는지 검사하고, 정책 필터링을 테스트 요구사항으로 추가하지 않는다.
- 정상 응답만으로 판별기를 검사하지 않는다. `data`·`errors` 혼합, 잘못된 오류 원소,
  누락된 관계와 included, 같은 id의 서로 다른 type을 별도로 다룬다.
- HTTP 테스트는 전역 `fetch`를 스텁하고 실제 `Response`·`Headers`로 결과를 만든다.
  후처리에서 전역 스텁과 모듈 상태를 정리한다.
- 합성 오류의 표시를 쓰는 쪽과 읽는 쪽을 각각 검사하는 데서 끝내지 않는다.
  `error-routing.test.ts`의 연결 검사를 유지한다.

## 검증과 의존성

루트에서 `pnpm exec vitest run test/unit/jsonapi`를 실행한다. 내부 의존성은
`lib/jsonapi/`·설정 모듈·`test/fixtures/documents.ts`이며 Vitest와 Node의 웹 API를
사용한다. 전체 게이트는 `./scripts/check.sh`다.

<!-- MANUAL: 이 아래의 수동 메모는 갱신 시 보존한다. -->
