<!-- Created: 2026-09-14 -->

# 선언 하나로 자원 화면 전부를 만드는 설계

`lib/resources/` 의 선언 파일 하나와 `index.ts` 의 한 줄만 적으면 그 자원의
목록·생성·상세·수정·삭제 화면과 사이드바 항목이 생기게 하는 설계다. 오늘은
목록만 그렇고 나머지는 자원마다 손으로 쓴다.

## 0. 이 문서의 위치

`2026-09-12-admin-template-design.md`(이하 "원 스펙")의 판정 하나를 뒤집는
문서다. 원 스펙 10절은 "제네릭 화면 생성기"를 넣지 않는 것으로 정했고 그
근거로 형제 저장소 `template-typescript-nextjs` 스펙 1.1 을 들었다. 그 1.1 은
**"비목표 (YAGNI)"** 목록이다 - 기술적으로 안 된다는 판정이 아니라 "아직
필요 없다"는 범위 판단이었다. 이 문서는 그것이 지금 필요해졌다고 정한다.
원 스펙의 나머지(계층 소유권·서버 구동 표·일괄 작업·인증·게이트)는 그대로
유효하고, 이 문서는 그 위에 얹힌다. 원 스펙 5.1 과 10절에는 이 문서를
가리키는 정정 註를 달았다.

계층 계약의 운용 정본은 구현 뒤에도 루트 `AGENTS.md` 가 갖는다. 이 문서는
**왜 이 형태인가**를 소유한다.

측정은 모두 2026-09-14 에 이 저장소(`ffbeeb0`)와 형제 저장소의 GitHub
`main` 을 읽어 수행했다.

## 1. 목적과 경계

### 1.1 무엇인가 - 성공 기준

새 자원을 더하는 절차가 **두 단계**가 된다.

1. `lib/resources/<이름>.ts` 에 선언을 적는다.
2. `lib/resources/index.ts` 의 `RESOURCES` 배열에 한 줄 더한다.

그러면 `/<slug>` 목록, `/<slug>/new` 생성, `/<slug>/[id]` 상세·수정·삭제
화면과 사이드바 항목, 대시보드 카운트 카드가 생긴다. `app/` 에 그 자원의
파일은 하나도 만들지 않는다. 읽기 전용 자원(`writable: false`)도 목록·상세를
갖되 만들기·수정·삭제·일괄 선택 UI 만 빠진다.

특정 자원의 화면을 다르게 그리고 싶으면 `app/(admin)/<slug>/` 정적 폴더를
만든다 - 그것이 동적 세그먼트를 이긴다(6.6). 그 밖의 덮어쓰기 장치는 두지
않는다.

### 1.2 무엇이 아닌가

- **react-admin 의 JSX 문법이 아니다.** `<List><Datagrid><TextField
  source="title"/>` 같은 부품 어휘를 만들지 않는다. 선언은 데이터다
  (`lib/resources/AGENTS.md`) - 그 규칙을 지키면서 목표를 이루는 쪽을
  골랐다(3장).
- **백엔드를 바꾸지 않는다.** 원 스펙 1.2 그대로다. OpenAPI 에서 선언을
  생성하지도 않는다 - 선언은 오늘처럼 손으로 베낀 거울이다.
- **폼 검증 스키마를 따로 두지 않는다.** 필수·선택은 선언의 `readOnly` ·
  `nullable` 두 플래그에서 유도한다(4.2). 형제 저장소가 같은 판정을 내렸고
  (그쪽 스펙 5.1 의 정정 註, 2026-09-08), 이 저장소도 따른다.

## 2. 측정한 현재 상태

### 2.1 손으로 쓰는 것

`app/(admin)/examples/` 아래 파일 15개, 1,796행이 `examples` 하나를 위해
있다. 자원 하나를 더할 때 손으로 쓰는 것을 화면별로 쟀다.

| 화면                                             | 손으로 쓰는가                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| 목록 - 열·필터·정렬·쪽·일괄 삭제·로딩 스켈레톤 | 아니오. `ResourceGrid` 가 선언만 읽는다                                     |
| 생성·수정 폼                                     | 예. `[id]/edit-form.tsx` 346행이 필드 여섯을 컴포넌트로 직접 조립한다     |
| 쓰기 요청 조립                                   | 예. `write.ts` 가 속성·관계 이름을 박아 둔다                               |
| Server Action 넷                                 | 예. `actions.ts` 가 리다이렉트 경로와 조립 함수를 자원 이름으로 든다        |
| 상세 화면                                        | 예. `[id]/page.tsx` 가 오른쪽 카드(분류·라벨·생성일·수정일)를 손으로 그린다 |
| 라우트 파일                                      | 예. `page.tsx` · `loading.tsx` 가 목록·생성·상세에 각각                    |
| 사이드바 항목                                    | 예. `app-sidebar.tsx` 의 `NAV_MAIN_ITEMS` 두 줄                            |
| 셸 헤더 제목                                     | 예. `site-header-title.ts` 가 `/examples` 경로 넷을 분기한다               |
| 대시보드 카드                                    | 예. `SectionCards` 가 `exampleCount` · `categoryCount` · `tagCount` 를 받는다 |

원인은 하나다. **`ResourceDef` 에 폼 스키마가 없다.** `lib/resources/define.ts`
의 `ResourceDef` 는 `type` · `path` · `label` · `writable` · `columns` ·
`filters` · `sorts` · `includes` 여덟 필드뿐이다. 루트 `AGENTS.md` 의 계층
소유권 표는 `lib/resources/` 가 "폼 스키마"를 소유한다고 적지만, 그 문구는
형제 저장소의 표에서 복사돼 온 것이고 실물이 없다.

그 밖에 이번에 함께 드러난 사실 셋:

- **"새로 만들기" 진입점이 화면 어디에도 없다.** `/examples/new` 는 주소를
  직접 쳐야 간다(실측: `app` · `components` 에서 `/new` 를 href 로 쓰는 곳이
  0건, `site-header-title.ts` 의 제목 분기만 그 경로를 안다).
- **그리드는 일괄 삭제 Action 이 없어도 선택 체크박스를 그린다**
  (`resource-grid.tsx` 의 `enableRowSelection: true` 가 무조건이다). 선택 바만
  `bulkDeleteAction` 유무로 숨는다.
- **빈 점수를 0 으로 보낸다.** `write.ts` 의 `score: Number(textOf(...))` 는
  빈 문자열을 `0` 으로 바꾼다 - 운영자가 비워 둔 것과 0 을 적은 것이 같은
  요청이 된다.

### 2.2 형제 저장소가 이미 가진 것

`template-typescript-nextjs` 의 선언은 속성마다 `kind` · `label` · `nullable` ·
`readOnly` 를, 관계마다 `cardinality` · `type` · `label` 을 갖는다
(`lib/resources/define.ts`). 폼을 선언에서 그리는 `components/resource/
resource-form.tsx` · `relationship-picker.tsx` 와, `FormData` 를 쓰기 문서로
바꾸는 `lib/resources/form.ts`(`writeDocument` · `initialFormValues` ·
`formStateFromErrors`)가 있다. 이 저장소는 코어 넷(`lib/jsonapi` · `lib/auth` ·
`lib/config` · `proxy.ts`)만 복사했고 그 부분은 가져오지 않았다.

다만 그쪽도 **라우트는 손으로 쓴다**(`app/(app)/examples/` 아래 `page.tsx` ·
`actions.ts` · `example-form.tsx` · `paths.ts` 등이 자원 이름을 들고 있다). 이
문서는 그 지점을 넘어간다.

### 2.3 이 문서가 기대는 Next.js 사실

설치된 `next@16.3.4` 에서 읽었다.

- **정적 세그먼트가 동적 세그먼트를 이긴다.** 라우트 정렬기
  (`node_modules/next/dist/shared/lib/router/utils/sorted-routes.js` 의
  `_smoosh`)가 같은 층위에서 정적 자식을 이름순으로 먼저 내고, 그 다음
  `[slug]`, 그 다음 `[...rest]`, 그 다음 `[[...rest]]` 를 낸다. 정적 폴더
  덮어쓰기(6.6)는 이 순서 하나에 기댄다.
- **`loading.tsx` 는 인자를 받지 않지만 클라이언트 컴포넌트가 될 수 있다.**
  문서(`docs/01-app/03-api-reference/03-file-conventions/loading.md`): "Loading
  UI components do not accept any parameters" 와 "can also be used as a Client
  Component through the 'use client' directive". `useParams` 는 클라이언트
  컴포넌트 훅이라 그 안에서 현재 `slug` 를 읽을 수 있다.
- **`useParams` 가 Suspense 를 요구하는 경우는 Cache Components 가 켜졌을
  때뿐이다**(`use-params.md` 의 Behavior 절). 이 저장소는 그 옵션을 켜지
  않는다(`next.config.ts` 실측: `reactStrictMode` · `output` 둘뿐).

## 3. 결정 세 가지와 버린 대안

브레인스토밍에서 세 번 갈림길이 있었고 각각 아래로 정했다.

**첫째, 무엇까지 손으로 쓰는가 → 선언 하나로 전부.** 버린 대안 둘:

- *react-admin 문법 그대로.* 자원마다 `<List>` · `<Edit>` 조합을 담은 얇은
  페이지를 손으로 둔다. 필드 하나하나를 화면에서 고르는 자유가 있지만 부품이
  열 개 넘게 생기고, 선언이 데이터(`lib/resources`)와 JSX(`app`) 두 곳으로
  갈라져 "선언은 데이터다"는 규칙을 다시 써야 한다.
- *폼·상세만 선언화, 라우트는 손으로.* 형제 저장소가 멈춘 지점이다. 자원마다
  라우트 파일 여섯이 남는다.

**둘째, 읽기 전용 참조 자원도 화면을 갖는가 → 선언된 자원은 전부.** `writable`
이 거짓이면 쓰기 UI 만 빠진다. 버린 대안: 선언에 메뉴 표시 플래그를 둔다
(값의 정본이 백엔드에 없어 물어볼 데가 없는 플래그가 하나 는다), 쓰기 가능
자원만 화면을 갖는다(제네릭 화면이 자원 하나에서만 검증된다).

**셋째, 라우트를 어떻게 없애는가 → 동적 세그먼트 `[slug]` 한 벌 + 정적 폴더
덮어쓰기.** 버린 대안 둘:

- *스캐폴딩 생성기.* 스크립트가 선언에서 라우트 파일을 생성하고 생성물을
  커밋한다. 선언이 바뀌면 재생성해야 하고 손으로 고친 파일과 충돌한다. 새
  자원 절차가 선언·스크립트·커밋 세 단계가 되어 1.1 의 성공 기준을 어긴다.
- *단일 catch-all.* `[[...segments]]` 페이지 하나가 세그먼트를 읽어 스스로
  가른다. 세그먼트별 `loading.tsx` · `error.tsx` · `notFound()` 관례를 잃고
  우리 코드가 라우터를 다시 만든다. optional catch-all 은 `/` 도 잡아
  대시보드와 겹친다.

## 4. 선언의 형태

### 4.1 쓰는 형태와 읽는 형태를 나눈다

작성자는 `ResourceInput` 을 쓰고 `defineResource` 가 그것을 `ResourceDef` 로
펼친다. **`ResourceDef` 의 `columns` · `filters` 는 오늘 모양(`ColumnDef` ·
`FilterDef`) 그대로다.** 그래서 `lib/grid/` · `components/grid/` 는 이번
변경에 손대지 않는다 - 읽는 쪽이 바뀌지 않으니 그 계층의 단위 테스트도
그대로다. 형제 저장소가 같은 분리(`ResourceInput` / `ResourceDefinition`)를
쓴다.

`ResourceInput` 에 새로 적는 것:

| 필드            | 뜻                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`          | 화면 URL 의 첫 세그먼트. 백엔드 `path` 와 독립이라 둘 다 적는다(`exampleCategories` 의 path 는 `/api/v1/categories`, slug 는 `categories`)             |
| `heading`       | 그 자원 한 건을 대표하는 속성 키. 상세 제목과 관계 배지의 이름이 여기서 나온다                                                                       |
| `attributes`    | 속성 키 → `{ kind, label, nullable, readOnly }`. `kind` 는 `string` · `text` · `enum` · `int` · `datetime`. `enum` 은 `values` 를 **와이어 값**으로 갖는다 |
| `relationships` | 관계 키 → `{ cardinality, type, label }`. `cardinality: 'one'` 은 `nullable` 도 갖는다                                                               |
| `columns`       | `{ key, sortable }` 의 순서 있는 목록. 어떤 열을 어떤 순서로 보일지는 사람의 판단이라 그대로 적는다                                                  |
| `filters`       | `{ key, operators, uiOperator }`. 오늘의 `label` · `options` 는 지운다 - 유도한다                                                                    |

`type` · `path` · `label` · `writable` · `sorts` · `includes` 는 오늘과 같다.
`ResourceDef` 는 오늘의 여덟 필드에 `slug` · `heading` · `attributes` ·
`relationships` 넷을 더한 열두 필드가 된다.

속성 하나의 타입은 `kind` 로 갈라지는 판별 유니온이다 - `kind: 'enum'` 인데
`values` 가 없으면 컴파일되지 않는다. 다섯 종류는 오늘 세 백엔드가 노출하는
속성 전부를 덮는다(`examples` 의 여섯 속성과 참조 자원의 `name`). 부족해지는
날 유니온에 종류를 더한다 - 그것이 `components/resource/field-control.ts` 와
`lib/form/write.ts` 의 `switch` 에 갈래 하나를 더하는 일이 되도록 둘 다
`kind` 로만 분기한다.

### 4.2 `defineResource` 가 유도하는 것

| 유도되는 것          | 규칙                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns[].label`    | 그 키의 속성 또는 관계의 `label`                                                                                                             |
| `columns[].kind`     | `string` · `text` → `text`, `int` → `number`, `enum` → `badge`, `datetime` → `datetime`, to-one → `badge`, to-many → `badges`                 |
| `filters[].label`    | 그 키의 속성의 `label`. `관계.id` 꼴이면 그 관계의 `label`                                                                                   |
| `filters[].options`  | 그 키가 `enum` 속성이면 그 `values`. 아니면 키 자체를 두지 않는다(오늘 `define.test.ts` 가 "undefined 로 채우지 않는다"를 이미 잰다)          |
| 폼이 그리는 속성     | `readOnly === false` 인 속성, 선언 순서대로                                                                                                  |
| 필수 입력            | `readOnly === false && nullable === false`                                                                                                   |

유도 규칙은 `define.ts` 의 순수 함수이고 `test/unit/resources/define.test.ts`
가 잰다. `deepFreeze` 는 유도된 결과에 그대로 건다.

### 4.3 불변식 - `test/unit/resources/index.test.ts` 가 모든 자원에 대해 잰다

1. `slug` 는 자원 사이에 유일하고 `^[a-z][a-z0-9-]*$` 에 맞는다.
2. `heading` 은 `attributes` 안에 있다.
3. `columns` 는 비어 있지 않고, 각 `key` 는 `attributes` 또는 `relationships`
   안에 있다.
4. `filters[].key` 는 `attributes` 의 키이거나 `${관계 키}.id` 다.
5. `filters[].uiOperator` 는 그 필터의 `operators` 안에 있다(오늘 있다).
6. `sortable` 인 열의 `key` 는 `sorts` 안에 있다(오늘 있다).
7. `includes` 는 `relationships` 의 키 안에 있다.
8. `relationships[].type` 은 `RESOURCES` 의 어떤 `type` 과 같다.
9. `enum` 속성의 `values` 는 비어 있지 않다 - 필터 `options` 의 원천이다.

오늘의 "examples 의 필터 키와 연산자가 백엔드 정책과 같다" 테스트는 그대로
남는다 - 그것은 거울의 정확성이고 위 아홉은 선언의 자기 정합성이다.

### 4.4 `examples` 선언

```ts
export const examplesResource = defineResource({
  type: 'examples',
  slug: 'examples',
  path: '/api/v1/examples',
  label: '예제',
  heading: 'title',
  writable: true,
  attributes: {
    title:       { kind: 'string',   label: '제목',   nullable: false, readOnly: false },
    description: { kind: 'text',     label: '설명',   nullable: true,  readOnly: false },
    status:      { kind: 'enum',     label: '상태',   nullable: false, readOnly: false,
                   values: ['draft', 'active', 'archived'] },
    score:       { kind: 'int',      label: '점수',   nullable: false, readOnly: false },
    createdAt:   { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
    updatedAt:   { kind: 'datetime', label: '수정일', nullable: false, readOnly: true },
  },
  relationships: {
    category: { cardinality: 'one',  type: 'exampleCategories', label: '분류', nullable: true },
    tags:     { cardinality: 'many', type: 'exampleTags',       label: '라벨' },
  },
  columns: [
    { key: 'title', sortable: true },
    { key: 'description', sortable: false },
    { key: 'status', sortable: true },
    { key: 'score', sortable: true },
    { key: 'category', sortable: false },
    { key: 'tags', sortable: false },
    { key: 'createdAt', sortable: true },
    { key: 'updatedAt', sortable: true },
  ],
  filters: [
    { key: 'title',       operators: ['exact', 'contains'],                     uiOperator: 'contains' },
    { key: 'status',      operators: ['exact', 'in'],                           uiOperator: 'exact' },
    { key: 'score',       operators: ['exact', 'gt', 'gte', 'lt', 'lte', 'in'], uiOperator: 'gte' },
    { key: 'category.id', operators: ['exact', 'in', 'isNull'],                 uiOperator: 'exact' },
    { key: 'createdAt',   operators: ['exact', 'gt', 'gte', 'lt', 'lte'],       uiOperator: 'gte' },
  ],
  sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt'],
  includes: ['category', 'tags'],
})
```

참조 자원은 같은 꼴로 작다 - `exampleCategories` 는 `slug: 'categories'` ·
`heading: 'name'` · 속성 `name`(`string`, 필수, 쓰기 가능) 하나 · 관계 없음 ·
열 하나 · 필터 하나 · `writable: false`. `exampleTags` 는 `slug: 'tags'` 로
같다. 참조 자원에는 쓰기 라우트가 없다(정본 FastAPI 는 `POST /api/v1/categories`
에 405, NestJS·Rails 는 404 - 형제 저장소가 실측해 선언 주석에 남긴 값).
`writable: false` 는 그 사실의 거울이고, 속성 `name` 의 `readOnly: false` 와
층위가 다르다.

### 4.5 이 선언에 넣지 않는 것

- **enum 표시 라벨.** 오늘처럼 와이어 값(`draft`)을 배지와 필터에 그대로
  보인다. 한국어 라벨을 지어내면 목록·필터·폼·URL 이 서로 다른 이름을 갖는
  자리가 생긴다(오늘 `[id]/page.tsx` 가 같은 판단을 주석으로 남겼다).
- **`defaultSort`.** 백엔드 기본 정렬(`-createdAt`, 참조 자원은 `name`)이
  오늘처럼 온다.
- **속성별 `listed` 플래그.** 오늘 열 순서는 속성과 관계가 섞여 있다(분류·
  라벨이 점수와 생성일 사이). 선언 순서만으로는 그것을 표현할 수 없어
  `columns` 를 명시 목록으로 둔다.
- **아이콘.** 선언은 JSX 를 못 갖는다. 사이드바 항목은 아이콘 하나로
  통일한다(6.5).

## 5. 계층 소유권

### 5.1 소유권 표의 변경 - 두 줄이 늘고 한 줄이 바뀐다

| 위치                      | 소유하는 것                                                                | 소유하지 않는 것        |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| `lib/form/` (새로)         | 선언 + `FormData` → JSON:API 쓰기 문서, 응답 문서 → 폼 초기값, 오류 → 폼 상태 | JSX, `fetch`, 자원 분기 |
| `components/resource/` (새로) | 선언을 읽어 만드는 획일 폼·상세 UI                                       | 자원별 분기             |
| `app/(admin)/[slug]/`     | 세 화면 한 벌, Server Action 넷, 요청 조립 튜플                             | `fetch`, 쿼리 조립      |

위반의 정의가 하나 는다: **`lib/form/*` · `components/resource/*` 에 이
저장소의 실제 자원 이름이나 필드 이름을 가리키는 문자열 리터럴이 코드로
나타나면 위반이다.** `lib/grid/` 와 같은 규칙이다.

`lib/resources/AGENTS.md` 의 "새 자원을 더하는 절차 - 세 단계"는 두 단계가
된다. 셋째 단계 "`app/` 에 그 자원의 라우트를 손으로 만든다"가 사라진다.

### 5.2 의존 방향 - `lib/AGENTS.md` 표에 한 줄

| 디렉터리    | import할 수 있는 내부 모듈                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `lib/form/` | `lib/resources/` 타입, `lib/jsonapi/document.ts` 타입, `lib/jsonapi/normalize.ts` · `lib/jsonapi/errors.ts` **값**. `lib/jsonapi/client.ts` 는 쓰지 않는다 |

`lib/auth/` 가 `lib/jsonapi/` 를 값으로 쓰는 것과 같은 줄기다. `client.ts` 를
쓰지 않는 이유는 그 파일이 `lib/config/settings.ts`(서버 전용)에 닿기
때문이다 - `lib/form/form-state.ts` 는 클라이언트 폼이 값으로 가져가므로
런타임 import 가 0개여야 하고(9장), 나머지 셋도 그 사슬에 들어가지 않게
둔다. `[path, options]` 튜플 조립(`withAcceptLanguage` 를 쓴다)은 오늘처럼
`app/(admin)/[slug]/write.ts` 가 갖는다.

### 5.3 파일 배치

오늘의 `app/(admin)/examples/` 15개 파일은 전부 지운다. 그 자리를 아래가
대신한다.

```
app/(admin)/[slug]/
  resource.ts          slug → ResourceDef. 선언에 없으면 notFound()
  page.tsx             목록
  loading.tsx          'use client'. useParams 로 열·필터 수를 세는 스켈레톤
  new/page.tsx         생성. writable 이 아니면 notFound()
  new/loading.tsx
  [id]/page.tsx        상세 (writable 이면 인라인 편집·삭제)
  [id]/loading.tsx
  [id]/detail.ts       오늘 파일 그대로
  actions.ts           'use server'. 네 Action 이 slug 를 첫 인자로 받는다
  list.ts  options.ts  write.ts  bulk-outcome.ts   오늘 파일을 옮긴다
lib/form/
  form-state.ts        ResourceFormState · IDLE_RESOURCE_FORM_STATE · 고정 문구. 런타임 import 0개
  flow.ts              resourceFormState(errors) - 오늘 examplesFormState 의 판단 그대로
  write.ts             writeDocument(resource, formData, id?)
  values.ts            initialFormValues(resource, document)
lib/resources/
  define.ts            ResourceInput · 유도 · 불변식의 대상
  index.ts             RESOURCES · resourceByType · resourceBySlug
components/resource/
  field-control.ts     kind · cardinality → 컨트롤 종류. 지시어 없음
  resource-form.tsx    'use client'. 속성은 kind 로, 관계는 cardinality 로 컨트롤을 고른다
  resource-detail.tsx  값 표 - 속성은 <dl>, 관계는 배지
```

`app/(admin)/count.ts` · `health.ts` · `recent.ts` · `read-result.ts` ·
`operator.ts` 는 그대로다. `app/(admin)/page.tsx` 가 `./examples/list` 에서
가져오던 `toSearchParams` 는 `./[slug]/list` 에서 가져온다.

## 6. 화면

### 6.1 라우트와 slug

| 경로            | 인증 | 내용                                                                        |
| --------------- | ---- | --------------------------------------------------------------------------- |
| `/`             | 필요 | 대시보드. 카운트 카드가 `RESOURCES` 를 돈다                                  |
| `/[slug]`       | 필요 | 목록. `writable` 이면 새로 만들기 · 다중 선택 · 일괄 삭제                    |
| `/[slug]/new`   | 필요 | 생성. `writable` 이 아니면 404                                              |
| `/[slug]/[id]`  | 필요 | 상세. `writable` 이면 인라인 편집·삭제, 아니면 읽기 전용                     |
| `/login`        | 공개 | 로그인                                                                      |

`proxy.ts` 의 보호 패턴은 `/login` 만 빼는 예외 목록이라 새 경로는 자동으로
보호된다 - 손댈 것이 없다.

세 화면의 첫 줄이 `resourceFromParams(params)` 다(`[slug]/resource.ts`). slug
로 `resourceBySlug` 를 찾고 없으면 `notFound()` 다. `generateStaticParams` +
`dynamicParams = false` 로 같은 404 를 얻는 길도 있지만 쓰지 않는다 - 코드
한 줄이 같은 일을 하고, 정적 파라미터 등록이 프리렌더와 얽히는 자리(2.3 의
`useParams` 절이 그 경계를 설명한다)를 만들지 않는다.

### 6.2 목록

```
resourceFromParams → listRequest(resource, params, lang)
                   + 관계 필터(키가 `관계.id`)마다 대상 자원의 optionsRequest, 병행
                   → ResourceGrid
```

`ResourceGrid` 에 넘기는 것: `resource` · `document` · `reauthHref` ·
`rowHrefBase = /<slug>` · `filterOptions`(오늘과 같은 접기 규칙 - 조회가
실패하면 그 필터는 텍스트 입력으로 떨어진다) · **`writable` 일 때만**
`bulkDeleteAction`(`bulkDeleteResourceAction.bind(null, resource.slug)`)과
`newHref = /<slug>/new`.

그리드가 바뀌는 것 둘: 선택 열과 체크박스는 `bulkDeleteAction` 이 있을 때만
그린다(오늘은 무조건이다). `newHref` 가 있으면 툴바에 "새로 만들기" 버튼을
그린다(오늘은 진입점이 없다). 둘 다 자원 이름을 모르는 prop 이라
`components/grid/` 의 규칙 안이다.

### 6.3 생성

```
resourceFromParams → writable 이 아니면 notFound()
                   → 관계마다 대상 자원의 optionsRequest, 병행
                   → ResourceForm(action = createResourceAction.bind(null, slug))
```

성공하면 Action 이 `/<slug>/<새 id>` 로 보낸다(오늘과 같다).

### 6.4 상세

```
resourceFromParams → detailRequest(resource, id, lang)
                   + writable 이면 관계마다 optionsRequest, 병행
                   → 머리글 + (writable ? 두 열 : 카드 하나)
```

**머리글**은 오늘 모양이다. `heading` 속성 값이 h1(비어 있으면 `(이름 없음)`),
`enum` 속성들의 값이 그 옆 배지, id 가 그 아래 mono 다. h1 은 값 하나만
담는다 - E2E 가 `heading level 1` 의 마지막 것을 제목과 비교한다.

**`writable` 이면 두 열**이다. 왼쪽 카드 "내용 수정"에 `ResourceForm`
(`initialValues` 는 `initialFormValues(resource, document)`), 오른쪽에 카드
둘. "지금 저장된 값"은 `role="group" aria-label="관계"` 안에 관계마다 라벨과
배지(비면 "없음"), 그 아래 `<dl>` 에 `readOnly` 속성들(datetime 은
`formatDateTime`). "위험 구역"은 `ConfirmedDeleteForm(action =
deleteResourceAction.bind(null, slug, id))`. 폭 산수(55.5rem · 34rem · 17rem)와
`xl` 경계는 오늘 `[id]/page.tsx` 머리말의 계산 그대로다.

오늘의 group 이름 "분류와 라벨"은 관계 이름 둘을 이어 붙인 것이라 제네릭이
될 수 없다. "관계"로 바꾸고 E2E 의 그 locator 하나를 같이 바꾼다.

**`writable` 이 아니면 카드 하나**다. `ResourceDetail` 이 모든 속성(선언
순서, `<dl>`)과 모든 관계(배지)를 보인다. 폼도 위험 구역도 없다.

**관계 배지의 이름**은 오늘 `components/grid/format.ts` 의
`relationshipLabel` 이 `attributes.name` 을 박아 읽는다. 대상 자원의
`heading` 을 읽도록 바꾼다 - `relationshipLabel(target, headingKey)`. 그리드
셀과 상세가 같은 함수를 쓰므로 `name` 이 아닌 자원도 배지에 제 이름이 뜬다.
서버 컴포넌트가 값으로 호출하는 함수라 그 파일은 계속 지시어가 없다.

### 6.5 셸 - 사이드바 · 헤더 제목 · 대시보드

- **사이드바**(`app-sidebar.tsx`): 항목은 대시보드 + `RESOURCES` 순서대로
  `{ title: label, url: /<slug> }`. 아이콘은 자원 전부 `ListIcon` 하나다.
- **헤더 제목**(`site-header-title.ts`): 경로의 첫 세그먼트로 `resourceBySlug`
  를 찾아 `/<slug>` 는 `label`, `/<slug>/new` 는 `<label> 만들기`,
  `/<slug>/<id>` 는 `<label> 상세`. `/` 는 "대시보드". 못 찾으면 빈 문자열.
  오늘 E2E 가 `예제 만들기` 제목을 찾으므로 문구 규칙을 그대로 둔다.
- **대시보드 카드**(`section-cards.tsx`): `exampleCount` · `categoryCount` ·
  `tagCount` 세 prop 대신 `counts: { label, href, count }[]` 하나를 받고,
  `app/(admin)/page.tsx` 가 `RESOURCES` 마다 `countRequest` 를 병행한다.
  **최근 표는 그대로 둔다** - `RecentRow` 가 `title` · `status` · `score` ·
  `updatedAt` 에 묶여 있고 그 표는 블록의 드래그 부품과 함께 온 것이다. 차트와
  같은 층위의 "표본"으로 루트 `AGENTS.md` 의 "화면에는 보이지 않는 계약"
  절에 적는다.

### 6.6 덮어쓰기

`app/(admin)/<slug>/` 정적 폴더가 있으면 그 자원의 그 경로만 그 파일로
그린다. 2.3 의 정렬 규칙이 장치의 전부다. 덮어쓰는 폴더는 자기 `loading.tsx`
도 스스로 가져야 한다 - `[slug]/loading.tsx` 는 형제 세그먼트에 적용되지
않는다.

**이번 구현에서는 덮어쓰기 예시를 남기지 않는다.** 오늘의 examples 폴더를
남겨 두면 제네릭 화면이 정작 `examples` 에서 검증되지 않는다. 장치와
실측(11장 1번)은 `app/AGENTS.md` 에 사실 문장으로 적는다.

### 6.7 로딩

`[slug]/loading.tsx` 는 `'use client'` 로 `useParams` 에서 slug 를 읽고
`resourceBySlug` 로 열 수와 필터 수를 세어 오늘 `examples/loading.tsx` 와 같은
스켈레톤을 그린다. `lib/resources` 는 내부 모듈을 하나도 import 하지 않으므로
클라이언트 번들에 들어가도 서버 전용 코드에 닿지 않는다(오늘 `edit-form.tsx`
가 이미 같은 import 를 한다). 선언에 없는 slug 면 열 0개짜리 스켈레톤을
그린다 - 곧 `notFound()` 가 온다. 생성·상세의 `loading.tsx` 도 같은 방법으로
폼 필드 수를 센다. 텍스트는 두지 않는다(원 스펙 5.3).

## 7. 폼과 쓰기

### 7.1 컨트롤 규칙 - `components/resource/field-control.ts`

| 선언                                | 컨트롤                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| `string`                            | `Input type="text"`                                          |
| `text`                              | `Textarea`                                                   |
| `enum`                              | `Select`, 항목은 `values` 그대로                             |
| `int`                               | `Input type="number"`                                        |
| `datetime`(readOnly 가 아닌 것)     | `Input type="datetime-local"` - 오늘 그런 속성은 없다        |
| 관계 `one`                          | `Select`. `nullable` 이면 값 `''` 의 "없음" 항목이 맨 앞     |
| 관계 `many`                         | `Checkbox` 묶음(`FieldSet` + `FieldLegend`)                  |

input 의 `name` 은 속성 키·관계 키 그대로다. 오늘 `form-state.ts` 의 상수
여섯(`TITLE_FIELD = 'title'` 등)이 하던 "input name = FormData 키 = JSON:API
키 = 오류 포인터의 키" 계약을 선언의 키가 대신한다. 라벨은 속성·관계의
`label` 이다 - E2E 가 `getByLabel('제목')` · `getByRole('combobox', { name:
'분류' })` 로 찾으므로 `FieldLabel htmlFor` 배선은 오늘 그대로다. `Select`
에는 반드시 `items` 를 넘긴다(오늘 `edit-form.tsx` 와 `filter-bar.tsx` 가
실측한 결함 - 넘기지 않으면 트리거에 UUID 가 뜬다).

`ResourceForm` 의 props: `resource` · `action`(bind 된 Server Action) ·
`options: Record<관계 키, OptionItem[]>` · `initialValues?`. `initialValues`
는 `{ attributes: Record<string, string>, relationships: Record<string,
string[]> }` 다 - 값이 전부 문자열인 것은 `FormData` 가 그렇기 때문이다.
`initialValues` 가 없는 생성 폼의 기본값은 `enum` 이 첫 `values`, `nullable`
아닌 to-one 이 첫 보기, 나머지는 빈 값이다(오늘 `StatusField` 가 첫 값을
고르는 것과 같다). 저장·취소 버튼 행(`grid grid-cols-2`)과 `type="reset"`
취소는 오늘 그대로다.

### 7.2 `writeDocument` 규칙 - `lib/form/write.ts`

`writeDocument(resource, formData, id?)` 가 `{ data: { type, id?, attributes,
relationships } }` 를 돌려준다. "빈 값"은 앞뒤 공백을 지운 결과가 빈
문자열인 것이다. 보내는 값은 원문 그대로다 - 정규화는 백엔드의 일이다.

| 선언                    | 빈 값                                                 | 비어 있지 않은 값                                              |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `readOnly` 속성         | 보내지 않는다                                         | 보내지 않는다                                                  |
| `string` · `text` · `enum` · `datetime` | `nullable` 이면 `null`, 아니면 `''`   | 문자열 그대로                                                  |
| `int`                   | `nullable` 이면 `null`, 아니면 **키를 뺀다**          | `^-?\d+$` 에 맞으면 `Number`, 아니면 원문 문자열 그대로        |
| 관계 `one`              | `{ data: null }`                                      | `{ data: { type: 대상 type, id } }`                            |
| 관계 `many`             | `{ data: [] }`                                        | `getAll` 의 값마다 `{ type, id }`                              |

`int` 의 두 규칙이 오늘과 다르다. 빈 값에 키를 빼는 이유는 백엔드가 "필수
속성이 없다"를 그 필드 아래 오류로 돌려주게 하기 위해서다 - 오늘처럼 `0`
을 보내면 운영자가 비워 둔 것이 조용히 `0` 으로 저장된다. 정수가 아닌
문자열을 그대로 보내는 이유는 `Number('abc')` 가 `NaN` 이고 `JSON.stringify`
가 `NaN` 을 `null` 로 쓰기 때문이다 - 그러면 잘못 적은 값이 "없음"으로
둔갑한다. 원문을 보내면 백엔드가 타입 오류를 그 필드 아래 낸다.

### 7.3 폼 상태와 판단 - `lib/form/form-state.ts` · `flow.ts` · `values.ts`

`ResourceFormState` 는 오늘 `ExamplesFormState` 와 같은 네 필드
(`attributeErrors` · `relationshipErrors` · `documentErrors` · `unusable`)다.
`IDLE_RESOURCE_FORM_STATE` · `UNUSABLE_RESOURCE_MESSAGE`(문구는 오늘 것
그대로) · `ResourceFormAction` 타입이 함께 있고, 이 파일은 런타임 import 가
0개다. `resourceFormState(errors)` 는 오늘 `examplesFormState` 의 판단을
글자 그대로 옮긴다(transport 면 unusable, `groupErrors` 로 묶고, 세 버킷이 다
비면 unusable). `initialFormValues(resource, document)` 는 상세 응답의
`data.attributes` 를 속성 키마다 문자열로(`null` 은 `''`, 숫자는 `String`),
`relationships` 를 `resolveToOne` · `resolveToMany` 로 id 배열로 편다.

### 7.4 Server Action 넷 - `app/(admin)/[slug]/actions.ts`

| Action                                          | 성공                            | 실패                                    |
| ----------------------------------------------- | ------------------------------- | --------------------------------------- |
| `createResourceAction(slug, prev, formData)`    | `redirect(/<slug>/<새 id>)`     | `ResourceFormState` 를 돌려준다         |
| `updateResourceAction(slug, id, prev, formData)`| `redirect(/<slug>/<id>)`        | `ResourceFormState` 를 돌려준다         |
| `deleteResourceAction(slug, id)`                | `redirect(/<slug>)`             | 던진다. "이미 없음"은 성공으로 친다    |
| `bulkDeleteResourceAction(slug, id)`            | `BulkOutcome { ok: true }`      | `BulkOutcome { ok: false, bucket }`     |

넷 다 첫 줄이 `writableResource(slug)` 다 - `resourceBySlug` 로 찾고 없거나
`writable` 이 아니면 던진다. 화면이 그 경로를 제공하지 않으므로 사용자
문구는 두지 않는다. 그 뒤는 오늘 `actions.ts` 와 같다: `requireSession` ·
`headers()` 의 `accept-language` · 세션 사망(`destroySession`)이면
`clearSession` 후 로그인으로 · 삭제 둘의 10초 `AbortSignal.timeout` ·
`bucketForFailure` · `isAlreadyGone`. 튜플 조립 셋(`createRequest` ·
`updateRequest` · `deleteRequest`)은 `write.ts` 에 두고 `resource` 를 첫
인자로 받는다 - `'use server'` 파일에 동기 함수를 두면 빌드가 죽는다(루트
`AGENTS.md` 규칙 6).

화면은 `action.bind(null, resource.slug)`(생성) · `.bind(null, resource.slug,
id)`(수정·삭제) 로 넘긴다. bind 된 인자는 문자열이라 직렬화에 문제가 없다
(오늘 `updateExampleAction.bind(null, id)` 가 같은 길을 쓴다).

## 8. 오류 처리 - 오늘 정책을 글자 그대로 옮긴다

| 자리                                   | 정책                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 읽기, transport                        | 던진다 → `error.tsx`. 그 파일의 "연결할 수 없다" 문구가 참인 유일한 경우                              |
| 읽기, 백엔드가 실제로 낸 오류          | 그 자리에 `FormBanner`(`messageForReadFailure`)                                                       |
| 상세, 없는 id                          | `notFound()`                                                                                          |
| 선언에 없는 slug                       | `notFound()`. 위와 같은 루트 `not-found.tsx` 로 간다                                                  |
| `writable` 아닌 자원의 `/new`          | `notFound()`                                                                                          |
| `writable` 아닌 자원으로 쓰기 Action   | 던진다(화면이 제공하지 않는 경로)                                                                     |
| 목록의 관계 보기 목록 조회 실패        | 접는다 - 그 필터는 텍스트 입력이 된다                                                                 |
| 생성·상세의 관계 보기 목록 조회 실패   | 화면 전체를 배너로(폼을 반쪽으로 그리지 않는다)                                                       |
| 쓰기 실패                              | `ResourceFormState` 로 필드 아래·배너에. transport 면 `unusable`                                     |
| 세션 사망                              | `clearSession` 후 `/login`                                                                            |

새로 생기는 갈래는 넷째·다섯째·여섯째뿐이다.

## 9. 지시어 경계 - 루트 `AGENTS.md` 규칙 6 을 그대로 따른다

| 파일                                          | 지시어                    | 이유                                                                                              |
| --------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `lib/form/form-state.ts`                      | 없음, 런타임 import 0개   | 클라이언트 폼이 값으로 가져간다. `lib/auth/form-state.ts` 와 같은 경계                            |
| `lib/form/write.ts` · `values.ts` · `flow.ts` | 없음                      | 서버가 값으로 호출한다. `lib/jsonapi/client` 를 쓰지 않아 `settings.ts` 에 닿지 않는다              |
| `components/resource/field-control.ts`        | 없음                      | `components/grid/filter-control.ts` 와 같은 꼴. 단위 테스트가 직접 부른다                          |
| `components/resource/resource-form.tsx`       | `'use client'`            | `useActionState`. 서버 화면은 JSX 로만 그린다                                                     |
| `components/resource/resource-detail.tsx`     | 없음                      | 서버 화면이 그린다. `Badge` 가 서버에서 안전하다는 실측(`[id]/page.tsx` 머리말)을 그대로 쓴다      |
| `components/grid/format.ts`                   | 없음                      | 시그니처가 바뀌어도 서버가 값으로 호출하는 사실은 같다                                            |
| `app/(admin)/[slug]/loading.tsx` 셋           | `'use client'`            | `useParams`                                                                                       |
| `app/(admin)/[slug]/actions.ts`               | `'use server'`            | 동기 함수는 두지 않는다. 튜플 조립은 `write.ts`                                                    |

`test/unit/components/boundary-policy.test.ts` 두 방향(비-클라이언트가
클라이언트 값을 호출하지 않는다 · `'use client'` 파일이 `settings.ts` 에
닿지 않는다)은 저장소 전체를 훑으므로 손대지 않아도 새 파일을 본다.
`components/AGENTS.md` 의 지시어 표에 `components/resource/` 셋을 더한다.

## 10. 테스트

### 10.1 단위

| 자리                                              | 무엇을 재나                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `test/unit/resources/define.test.ts`              | 4.2 의 유도 규칙 전부, 동결(오늘 테스트 유지)                                                                 |
| `test/unit/resources/index.test.ts`               | 4.3 의 불변식 아홉을 모든 자원에, `resourceBySlug`, 필터 거울(오늘 테스트 유지)                              |
| `test/unit/form/write.test.ts`                    | 7.2 표의 칸 전부. POST 는 `id` 없음, PATCH 는 있음. `readOnly` 가 절대 실리지 않는다                          |
| `test/unit/form/values.test.ts`                   | `included` 가 있는 상세 문서 픽스처에서 초기값. `null` · 숫자 · 관계 없음                                     |
| `test/unit/form/flow.test.ts`                     | 오늘 `examplesFormState` 의 테스트를 그대로                                                                  |
| `test/unit/components/field-control.test.ts`      | 7.1 표                                                                                                       |
| `test/unit/slug/` (오늘 `test/unit/examples/` 를 옮긴다) | `write.test`(튜플 셋) · `detail.test` · `bulk-outcome.test` · `resource.test`(slug → 선언, 없으면 undefined) |
| `test/unit/components/site-header-title.test.ts`  | slug 기반 문구 규칙. 없는 slug 는 빈 문자열                                                                  |
| `test/unit/components/sidebar.test.ts`            | 항목이 `RESOURCES` 순서·개수와 같다                                                                          |

### 10.2 E2E - 오늘 시나리오가 회귀망이다

URL 이 오늘과 같으므로(`/examples` · `/examples/new` · `/examples/<id>`)
`auth.spec.ts` · `bulk.spec.ts` · `examples.spec.ts` 의 열두 시나리오 중
바꾸는 것은 `examples.spec.ts` 의 group locator 이름 하나(`분류와 라벨` →
`관계`)다. 제네릭 화면이 오늘 화면과 같은 일을 하는지는 이 열두 개가 잰다.

새 파일 `test/e2e/reference.spec.ts` 에 시나리오 둘을 더한다. `test/AGENTS.md`
의 규칙 셋(고유 이메일 · 자기 접두사 · 실전값과 구별)을 따르되 행을 만들지
않으므로 접두사는 씨앗 분류 이름의 접두사(`프로브`)로 목록을 좁힌다.

1. `/categories?name=프로브` 가 씨앗 분류 이름들을 보이고, 체크박스와 "새로
   만들기"가 없으며, 행을 누르면 `/categories/<id>` 가 열려 h1 에 그 이름이
   있고 폼이 없다.
2. 선언에 없는 슬러그(`/nope`)는 404 다.

세 백엔드 매트릭스(`.github/workflows/ci.yml`)는 그대로 돈다.

## 11. 구현 중에 실측해 사실 문장으로 남길 것

스펙은 아래 다섯을 참으로 **전제하지 않는다.** 구현이 재고, 결과를 그 자리의
주석과 `AGENTS.md` 에 적는다.

1. **정적 폴더가 `[slug]` 를 실제 런타임에서도 이긴다.** 정렬기 소스는 읽었다
   (2.3). 던져 버릴 `app/(admin)/examples/page.tsx` 하나로 `next dev` 와
   `next build` 양쪽에서 확인하고 지운다. 결과를 `app/AGENTS.md` 에 적는다.
2. **`'use client'` 인 `loading.tsx` 안의 `useParams` 가 Suspense 대체 UI 로
   동작한다** - 목록으로 이동할 때 열 수가 맞는 스켈레톤이 뜨는지.
3. **필수 `int` 속성을 뺀 POST 에 세 백엔드가 `/data/attributes/<키>`
   포인터로 422 를 낸다**(7.2 의 "키를 뺀다"가 기대는 사실). 하나라도 다르면
   그 백엔드는 `matrix.ts` 의 `KNOWN_DIVERGENCES` 에 적는다.
4. **slug 를 bind 한 Server Action 이 `useActionState` 를 거쳐 직렬화된다.**
5. **라우트를 옮긴 뒤 `TS2307` 이 나면 `rm -rf .next`** - 루트 `AGENTS.md`
   규칙 4 가 이번에 실제로 걸리는 자리다.

## 12. 문서 수정

| 문서                            | 무엇을                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 원 스펙 5.1 · 10절              | 이 문서를 가리키는 정정 註(이 문서와 같은 커밋에서 이미 달았다)                                                     |
| 루트 `AGENTS.md`                | 소유권 표 두 줄 추가 · `app/(admin)/[slug]/` 행 · 위반의 정의 한 줄(5.1) · "화면에는 보이지 않는 계약"에 최근 표의 examples 고정 |
| `lib/AGENTS.md`                 | 의존 방향 표에 `lib/form/` 행(5.2)                                                                                 |
| `lib/resources/AGENTS.md`       | "새 자원을 더하는 절차"를 두 단계로, 필드 표에 넷 추가, 불변식 아홉                                                  |
| `app/AGENTS.md`                 | 조립 함수 표의 경로, `[slug]` 절, 덮어쓰기 절(11장 1번의 실측)                                                       |
| `components/AGENTS.md`          | 하위 구성 표에 `components/resource/`, 지시어 표에 셋                                                              |
| `test/AGENTS.md`                | `reference.spec.ts` 행                                                                                             |
| `docs/AGENTS.md`                | 주요 파일 표에 이 문서(이미 달았다)                                                                                 |
| `README.md`                     | 화면 표를 slug 기준으로, "들어 있는 것"에 `lib/form/` · `components/resource/`, 새 절 "새 자원 더하기"(1.1 의 두 단계) |

## 13. 넣지 않는 것

| 제외                          | 이유                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| react-admin 식 JSX 선언       | 3장 첫째. 선언은 데이터다                                                                      |
| OpenAPI 에서 선언 생성        | 형제 스펙 1.1 과 같은 판단. 선언은 손으로 베낀 거울이고 거울 테스트가 지킨다                    |
| enum 표시 라벨 · `defaultSort` · 자원별 아이콘 · `listed` | 4.5                                                                       |
| 정적 폴더 외의 덮어쓰기 장치  | 필드 단위 커스텀 컴포넌트 등. 정적 폴더 하나로 화면 전체를 대신할 수 있고 그 이상은 필요해질 때 |
| 최근 표의 제네릭화            | 6.5. 블록의 드래그 부품과 함께 온 표본이다                                                      |
| `generateStaticParams`        | 6.1. 코드 한 줄이 같은 404 를 내고 프리렌더와 얽히지 않는다                                     |
| 덮어쓰기 예시 커밋            | 6.6. 남기면 제네릭이 examples 에서 검증되지 않는다                                              |

## 14. 구현 계획이 정할 것

계획은 둘이다. 각각 게이트 아홉 단계가 초록인 상태로 끝난다.

**첫째 계획 - 선언과 부품.** 4장의 선언 확장, `lib/form/`, `components/
resource/`, 그리고 **오늘의 `app/(admin)/examples/` 라우트가 그것들을 쓰는
상태**까지. `edit-form.tsx` · `write.ts` · `form-state.ts` · `flow.ts` 가 사라지고
그 자리를 제네릭 부품이 대신한다. URL 도 E2E 도 그대로다(group 이름 하나만).

**둘째 계획 - 라우트와 셸.** `app/(admin)/[slug]/` 로의 교체와 examples 폴더
삭제, 그리드의 선택 열 조건화와 "새로 만들기", 사이드바·헤더·대시보드 카드,
`reference.spec.ts`, 11장의 실측, 12장의 문서.

계획이 정할 구체값:

1. `ResourceForm` 의 `options` 를 채우는 서버 쪽 헬퍼의 이름과 자리
   (`[slug]/options.ts` 에 두는 것이 자연스럽다).
2. 각 단위 테스트가 쓸 픽스처 문서(`test/fixtures/` 의 기존 문서를 재사용할
   수 있는지).
3. `reference.spec.ts` 의 씨앗 분류 이름과 접두사 - `test/e2e/seed/examples.sql`
   과 `examples.rails.sql` 양쪽에서 확인한다.
4. README "새 자원 더하기" 절의 예시 자원 이름(실재하지 않는 이름을 쓰되
   그것이 예시임을 밝힌다).
