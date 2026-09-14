<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# lib/resources/ 작업 지침

자원이 무엇인지 아는 유일한 자리다. 자원의 타입 이름·화면 슬러그·HTTP 경로·쓰기 가능 여부·속성(종류·라벨·
nullable·readOnly)·관계(cardinality·대상 타입·라벨)·대표 속성(`heading`)·열
구성·필터 정책·정렬 가능 필드·include 이름·표시 라벨을 소유한다.

## 선언은 데이터다

`lib/resources/*.ts`에 JSX를 두지 않는다. 이 디렉터리가 아는 것은 "자원이
무엇인가"이지 "어떻게 그리는가"가 아니다 - 렌더링은 `app/`과
`components/grid/`의 일이다. `fetch`도 두지 않는다 - 요청 조립은
`lib/grid/`·`lib/jsonapi/`의 일이다. 이 디렉터리 자신은 아무 내부 모듈도
import하지 않는다 - `lib/jsonapi/`조차 소비하지 않는 순수 선언 계층이다.

## 주요 파일

| 파일          | 역할                                                                                                                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `define.ts`   | 쓰는 형태 `ResourceInput` 과 읽는 형태 `ResourceDef`, `AttributeDef`·`RelationshipDef`·`ColumnInput`·`FilterInput`·`ColumnDef`·`FilterDef`·`FilterOperator` 타입, `defineResource()`(열·필터의 `label`·`kind`·`options` 를 속성·관계에서 유도하고 깊게 동결), `formAttributes()`·`readOnlyAttributes()`·`isRequiredAttribute()`. |
| `example.ts`  | `examples` 선언 - 전체 CRUD, 이 저장소의 유일한 쓰기 가능 자원.                                                                                                                                                                                                                                                                  |
| `category.ts` | `exampleCategories` 선언 - 읽기 전용 참조 자원, 열 하나(`name`).                                                                                                                                                                                                                                                                 |
| `tag.ts`      | `exampleTags` 선언 - 읽기 전용 참조 자원, 열 하나(`name`).                                                                                                                                                                                                                                                                       |
| `index.ts`    | `RESOURCES` 배열과 `resourceByType()`·`resourceBySlug()`·`relationshipHeading()` 조회.                                                                                                                                                                                                                                           |

## 선언은 두 형태다

작성자는 `ResourceInput` 을 쓴다 - 속성·관계·`slug`·`heading` 을 적고, 열은
`{ key, sortable }`, 필터는 `{ key, operators, uiOperator }` 만 적는다.
`defineResource` 가 그것을 소비자가 읽는 `ResourceDef` 로 펼친다 - 열의
`label`·`kind`(string·text→text, int→number, enum→badge, datetime→datetime,
to-one→badge, to-many→badges)와 필터의 `label`·`options`(enum 의 `values`)는
유도된다. 같은 라벨을 두 번 적는 자리는 없다.

유도는 던지지 않는다 - 선언에 없는 키를 가리키는 열·필터는 `text` 와 키
이름으로 떨어진다. 대신 `test/unit/resources/index.test.ts` 가 모든 자원에
대해 불변식 아홉을 잰다: slug 유일·URL 안전, heading ∈ 속성, 열 비어 있지
않음·열 키 ∈ 속성∪관계, 필터 키 ∈ 속성∪`관계.id`, uiOperator ∈ operators,
sortable 열 ∈ sorts, includes ⊆ 관계, 관계 type ∈ RESOURCES, enum values 비어
있지 않음. 선언을 잘못 적으면 여기서 드러난다.

폼이 그릴 속성은 `readOnly` 가 거짓인 것(`formAttributes`), 필수는 거기에
`nullable` 도 거짓인 것(`isRequiredAttribute`)이다 - 별도 폼 스키마는 두지
않는다(`docs/superpowers/specs/2026-09-14-declarative-resources-design.md` 4.2).

## 새 자원을 더하는 절차 - 세 단계, 전부 손으로

1. 선언 파일을 만든다(`example.ts`가 본이다). 열·필터·정렬·include는 백엔드
   소스에서 실측해 옮겨 적는다 - 기억으로 채우지 않는다. 연산자 이름은
   백엔드의 `FilterField` 정책이 정한다 - 화면이 바라는 이름을 지어내면 그
   선언은 이 디렉터리의 테스트에서만 통과하고 실제 백엔드에서 거절당한다.
2. `index.ts`의 `RESOURCES` 배열에 손으로 더한다.
3. `app/`에 그 자원의 라우트를 손으로 만든다.

**자동 탐색(glob·`import.meta.glob`·동적 `import`)을 쓰지 않는다.**
`RESOURCES`에 없는 자원은 존재하지 않는 것과 같다는 것이 이 계층의 계약이다.
자동 탐색은 그 계약을 지운다 - 선언 파일 하나를 디렉터리에 두는 것만으로
라우트도 없이 자원이 "생기고", 반대로 파일을 지워도 번들이 이전 참조를
캐시해 조용히 남을 수 있다. 배열에 손으로 적어야 "이 저장소가 아는 자원
전부"가 이 파일 하나를 읽는 것만으로 드러난다.

## 필터·정렬 정책은 거울이다

`FilterDef.operators`는 백엔드가 그 필드에 실제로 허용한 연산자 전부를
옮겨 적은 것이다 - 화면이 편한 부분집합이 아니다. `uiOperator`는 화면이
기본으로 쓰는 연산자 하나이고 반드시 `operators` 안에 있어야 한다. 관계
필터의 키는 관계 이름이 아니라 백엔드가 선언한 그대로 옮긴다(`category`가
아니라 `category.id`) - 다르게 적으면 백엔드가 모르는 파라미터가 된다.

`ColumnDef.sortable`을 켠 열의 `key`는 그 자원의 `sorts`에도 있어야 한다.
백엔드가 그 필드로 정렬을 받지 않는데 화면이 정렬 가능으로 표시하면 클릭한
사용자가 500을 받는다.

## 검증과 의존성

`define.ts`의 순수 동결 동작은 `test/unit/resources/define.test.ts`가, 세
자원의 선언과 위 불변식 아홉은 `test/unit/resources/index.test.ts`가
모든 자원에 대해 확인한다. 최종 검증은 `./scripts/check.sh`다.

소비자는 `lib/grid/`·`components/grid/`·`app/`이다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
