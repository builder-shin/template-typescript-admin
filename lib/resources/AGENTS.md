<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# lib/resources/ 작업 지침

자원이 무엇인지 아는 유일한 자리다. 자원의 타입 이름·HTTP 경로·쓰기 가능
여부·열 구성·필터 정책·정렬 가능 필드·include 이름·표시 라벨을 소유한다.

## 선언은 데이터다

`lib/resources/*.ts`에 JSX를 두지 않는다. 이 디렉터리가 아는 것은 "자원이
무엇인가"이지 "어떻게 그리는가"가 아니다 - 렌더링은 `app/`과
`components/grid/`의 일이다.

**선언 파일(`define.ts`·`example.ts`·`category.ts`·`tag.ts`·`index.ts`)은 아무
내부 모듈도 import하지 않는다** - `lib/jsonapi/`조차 소비하지 않는 순수
선언 계층이다.

`count.ts`는 이 규칙의 유일한 예외다 - `fetch`를 직접 부르지는 않지만
`lib/jsonapi/client`(`RequestOptions`·`withAcceptLanguage`)와
`lib/jsonapi/document`(`CollectionDocument`)를 소비해 요청 튜플을 조립한다.
예외인 이유: 총합 조회는 특정 화면의 URL 상태(`app/(admin)/examples/list.ts`
의 `listRequest`가 다루는 것)가 아니라 **자원 자체의 능력**이다 - 인자가
`resource` 하나뿐이라 어느 화면이든 그대로 재사용한다. 그래서 화면별
조립(`app/`)이 아니라 자원 옆(`lib/resources/`)에 둔다. 새 자원별 요청
조립이 더 필요해져도 이 규칙을 계속 넓히지 마라 - 화면의 URL 상태를 읽어야
하는 조립은 여전히 `app/`의 몫이다(`listRequest`가 그 경계다).

## 주요 파일

| 파일          | 역할                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `define.ts`   | `ResourceDef`·`ColumnDef`·`FilterDef`·`FilterOperator` 타입과 `defineResource()`.                       |
| `example.ts`  | `examples` 선언 - 전체 CRUD, 이 저장소의 유일한 쓰기 가능 자원.                                         |
| `category.ts` | `exampleCategories` 선언 - 읽기 전용 참조 자원, 열 하나(`name`).                                        |
| `tag.ts`      | `exampleTags` 선언 - 읽기 전용 참조 자원, 열 하나(`name`).                                              |
| `index.ts`    | `RESOURCES` 배열과 `resourceByType()` 조회.                                                             |
| `count.ts`    | `countRequest()`(총합 전용 요청 튜플)·`readTotal()`(`meta.totalCount` 읽기, 없으면 던짐). 위 예외 참고. |

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
자원의 선언과 위 두 정합성 규칙은 `test/unit/resources/index.test.ts`가
모든 자원에 대해 확인한다. `count.ts`는 `test/unit/resources/count.test.ts`가
확인한다 - `page[size]=1`·`page[totals]=true`·`include` 미포함·경로·
`meta.totalCount` 읽기와 그 부재 시 던짐을 각각 잰다. 최종 검증은
`./scripts/check.sh`다.

소비자는 `lib/grid/`·`components/grid/`·`app/`이다. `count.ts`는 추가로
`app/(admin)/page.tsx`(대시보드 카드 셋)가 쓴다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
