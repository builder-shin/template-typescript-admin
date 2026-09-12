<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# lib/grid/ 작업 지침

URL 검색 파라미터와 JSON:API 쿼리 파라미터 사이의 변환을 소유한다. 화면이 무엇을
보여줄지(렌더링)도, 어떻게 가져올지(`fetch`)도 이 디렉터리의 일이 아니다 - "URL 이
말하는 것을 그대로 백엔드에게 묻는다"는 경계 하나만 갖는다.

## 자원을 모른다

이 디렉터리는 이 저장소의 실제 자원이 무엇인지 몰라야 한다. 함수는 전부
`ResourceDef` 를 인자로 받고, 그 값이 건네주는 필터·정렬·열·include 선언만
읽는다 - 자원이 `examples` 든 다른 무엇이든 이 디렉터리의 코드는 똑같이
동작해야 한다.

위반의 정의 - 다음 중 하나라도 코드에 나타나면 위반이다(규칙 자체를 설명하는
문장 안의 예시는 대상이 아니다):

- `examples` · `exampleTags` · `exampleCategories`처럼 이 저장소의 실제 자원
  이름을 가리키는 문자열 리터럴.
- 자원별 필드 이름(`title` · `score` · `category.id` 등)에 의존하는 분기 -
  이런 이름은 전부 인자로 받은 `ResourceDef.filters` · `.sorts` · `.columns` ·
  `.includes` 를 순회해서 얻는다.
- JSX. 렌더링은 `components/grid/` 와 `app/`의 일이다.
- `fetch` 호출. 요청 전송은 `lib/jsonapi/`의 일이다 - 이 디렉터리는 무엇을
  물을지만 만들고 직접 묻지 않는다.

이 디렉터리에 있어도 되는 문자열은 JSON:API 문법 자체(`filter` · `sort` ·
`include` · `page[...]`)와 이 계층이 URL 에서 쓰는 자체 어휘(`pageSize` ·
`hide`)뿐이다 - 둘 다 어떤 자원인지와 무관하게 항상 같다.

## 필터·정렬은 선언에 있는 키만 남긴다

`readGridState` 는 `ResourceDef.filters` 의 키, `ResourceDef.sorts` 의 이름에
없는 값을 조용히 버린다. 필터·정렬에서 이것은 스타일이 아니라 정확성이다 -
백엔드는 `filter` · `sort` · `include` · `page` 네 접두사로 시작하는
파라미터만 인식하고 나머지는 400 `INVALID_QUERY_PARAMETER` 로 거절한다(실측
`app/jsonapi/query.py:152,167`). URL 에 낯선 파라미터가 하나만 섞여도 목록은
빈 것이 아니라 **실패한 것**으로 돌아온다 - 그래서 `gridQuery` 가 만드는 것은
언제나 이 걸러진 상태뿐이다.

`hide`(숨긴 열)에도 같은 "선언에 없으면 버린다" 규칙을 적용하지만 이유는
다르다 - 숨긴 열은 애초에 질의로 나가지 않으므로(아래) 400 의 위험이 없다.
그래도 버리는 이유는 사라진 열 이름이 URL 에 죽은 값으로 계속 남는 것을
막기 위해서다.

## 숨긴 열은 표시 상태이지 질의가 아니다

`GridState.hiddenColumns` 는 `gridQuery` 의 어떤 출력에도 나타나지 않는다.
어떤 열을 그리는지는 `components/grid/` 가 `hiddenColumns` 를 직접 읽어서
결정할 문제이고, 백엔드에게 무엇을 묻는지와는 다른 질문이다 - 열을 숨겨도
그 열이 참조하는 관계(`include`)나 필터는 그대로 요청된다.

## 커서는 해석하지 않는다

`page[after]` · `page[before]` · `page[number]` 처럼 위치를 가리키는 page
파라미터는 백엔드가 응답 링크(`links.next` · `links.prev`)에 실어 발급한
불투명한 값이다. `readGridState` 는 이 값을 원래 파라미터 이름 그대로
`pageQuery` 에 옮겨 담을 뿐 내용을 들여다보지 않고, `gridQuery` 도 그 값을
그대로 다시 펼친다. 커서 문자열은 정렬 서명을 포함할 수 있어 정렬 조건이
바뀌면 같은 커서가 400 이 될 수 있다 - 이 디렉터리가 커서를 만들거나 고치면
그 불변식을 깨뜨릴 여지가 생긴다. 그래서 앞뒤 이동이 필요로 하는 값은 언제나
백엔드가 준 것을 그대로 왕복시키기만 한다.

## 총합(`page[totals]`)은 항상 요청한다

`gridQuery` 는 매 목록 질의에 `page[totals]=true` 를 무조건 싣는다. 총합은
opt-in 이라 이 플래그 없이는 `meta.totalCount` 가 오지 않고 `links.last` 도
null 이다(실측 `app/controllers/concerns/crud_actions.py:162,179-213`) - 표가
전체 쪽 수를 계산하려면 매 쪽 요청에 이 플래그가 있어야 한다.

대가가 있다: 이 플래그가 켜지면 백엔드는 매 쪽마다 `COUNT` 쿼리를 한 번 더
돈다. 백엔드가 이것을 opt-in 으로 남겨 둔 이유가 정확히 그 비용이다. 그
비용이 문제가 되는 배포는 이 플래그를 끄면 되고, 그때 잃는 것은 전체 쪽 수와
"전체 N건" 표시뿐이다 - 다음/이전 페이지 이동은 프로브 행 하나로 결정되므로
총합 없이도 그대로 동작한다.

## 주요 파일

| 파일        | 역할                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `state.ts`  | URL `↔` `GridState` 변환(`readGridState` · `writeGridState`), 쪽당 건수 상한. |
| `query.ts`  | `GridState` `→` JSON:API 쿼리 파라미터(`gridQuery`) - 필터 연산자, 항상 켜는 `include`·`page[totals]`, 커서 통과. |

## 검증과 의존성

순수 변환은 `test/unit/grid/`가 확인한다. 최종 검증은 `./scripts/check.sh`다.

내부 의존성은 `lib/resources/`가 내보내는 `ResourceDef` 타입 하나뿐이다 -
`lib/jsonapi/`를 비롯한 다른 내부 모듈은 import하지 않는다. 소비자는
`components/grid/`와 `app/`이다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
