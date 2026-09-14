/**
 * 자원 선언의 형태와 동결, 그리고 쓰는 형태 → 읽는 형태의 유도.
 *
 * 이 파일은 어떤 자원 이름도 모른다 - "자원을 어떤 모양으로 선언할 수
 * 있는가"와 "그 선언에서 무엇이 유도되는가"만 정의한다. 실제 자원
 * (`example.ts`·`category.ts`·`tag.ts`)이 각자 이 모양을 채운다. 자원 이름을
 * 아는 것, JSX 를 그리는 것, `fetch`를 부르는 것은 모두 다른 계층의 일이다 -
 * 이 디렉터리에는 셋 다 두지 않는다.
 *
 * ## 쓰는 형태(`ResourceInput`)와 읽는 형태(`ResourceDef`)를 나눈다
 *
 * 작성자는 속성(`attributes`)·관계(`relationships`)·화면 슬러그(`slug`)·대표
 * 속성(`heading`)을 적고, 열은 `{ key, sortable }`, 필터는 `{ key, operators,
 * uiOperator }` 만 적는다. `defineResource` 가 그것을 소비자가 읽는
 * `ResourceDef` 로 펼친다 - 열의 `label`·`kind` 와 필터의 `label`·`options`
 * 는 속성·관계 선언에서 유도된다(`deriveColumn`·`deriveFilter`). 그래서 같은
 * 라벨을 두 번 적을 자리가 없고, `ResourceDef.columns`·`.filters` 는 이
 * 분리 이전의 모양 그대로라 `lib/grid/`·`components/grid/` 는 읽는 코드를
 * 바꾸지 않는다.
 *
 * ## 유도는 던지지 않는다
 *
 * 선언에 없는 키를 가리키는 열·필터는 여기서 던지지 않고 `text` 와 키
 * 이름으로 떨어진다. 선언은 전부 정적이라 잘못된 선언은 코드가 도는 순간이
 * 아니라 게이트에서 잡혀야 한다 - import 시점에 던지면 단위 테스트도 화면도
 * 같이 죽어서 무엇이 틀렸는지 오히려 안 보인다. 구조적 불변식(열·필터 키가
 * 선언 안에 있다, slug 가 유일하다 등)은 `test/unit/resources/index.test.ts`
 * 가 모든 자원에 대해 잰다.
 */

/**
 * 백엔드가 정한 필터 연산자 어휘. 화면이 바라는 이름이 아니라 백엔드의
 * `FilterField` 정책이 실제로 읽는 이름이다.
 */
export type FilterOperator = 'exact' | 'contains' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'isNull'

/** 목록 셀의 표현. 속성·관계의 종류에서 유도된다(`columnKindOf`). */
export type ColumnKind = 'text' | 'number' | 'badge' | 'badges' | 'datetime'

/**
 * 속성의 종류. 세 백엔드가 오늘 노출하는 속성 전부를 덮는 최소 집합이다.
 * `string` 과 `text` 는 JSON 타입이 같고 화면 표현(한 줄·여러 줄)만 다르다.
 * 종류를 더하면 이 유니온과, `kind` 로 분기하는 두 곳
 * (`components/resource/field-control.ts`·`lib/form/write.ts`)에 갈래를
 * 하나씩 더한다.
 */
export type AttributeKind = 'string' | 'text' | 'enum' | 'int' | 'datetime'

/** 종류와 무관하게 모든 속성이 갖는 것. 셋 다 필수다 - 기본값에 숨지 않는다. */
interface AttributeBase {
  /** 화면에 보이는 이름. 백엔드에서 오지 않는다. */
  readonly label: string
  /** `null` 이 실제로 올 수 있는가. 비어 있으면 폼이 `null` 을 보낸다. */
  readonly nullable: boolean
  /** 서버가 만드는 값이라 폼이 보내서는 안 되는가. */
  readonly readOnly: boolean
}

/**
 * 속성 하나의 선언. `kind` 로 갈라지는 판별 유니온이라 `kind: 'enum'` 인데
 * `values` 가 없으면 컴파일되지 않는다. `values` 는 **와이어 값**이다 - 표시
 * 라벨을 따로 두지 않는다(목록·필터·폼·URL 이 같은 이름을 쓴다).
 */
export type AttributeDef =
  | (AttributeBase & { readonly kind: 'string' })
  | (AttributeBase & { readonly kind: 'text' })
  | (AttributeBase & { readonly kind: 'enum'; readonly values: readonly string[] })
  | (AttributeBase & { readonly kind: 'int' })
  | (AttributeBase & { readonly kind: 'datetime' })

/** 관계 하나의 선언. `type` 은 대상 자원의 JSON:API type 이다(경로가 아니다). */
export type RelationshipDef =
  | {
      readonly cardinality: 'one'
      readonly type: string
      readonly label: string
      /** 비울 수 있는가. 비울 수 있으면 폼이 "없음" 항목을 그린다. */
      readonly nullable: boolean
    }
  | { readonly cardinality: 'many'; readonly type: string; readonly label: string }

/** 작성자가 적는 열 - 어느 열을 어떤 순서로 보일지는 사람의 판단이라 그대로 적는다. */
export interface ColumnInput {
  readonly key: string
  readonly sortable: boolean
}

/** 작성자가 적는 필터. `label`·`options` 는 유도되므로 적지 않는다. */
export interface FilterInput {
  /** 백엔드의 필터 키. 관계는 `category.id` 처럼 `.id` 가 붙는다. */
  readonly key: string
  /** 백엔드가 그 필드에 허용한 연산자 전부. 손으로 베낀 거울이다. */
  readonly operators: readonly FilterOperator[]
  /** 화면이 기본으로 쓰는 연산자. `operators` 안에 있어야 한다. */
  readonly uiOperator: FilterOperator
}

/** 작성자가 적는 선언 전체. */
export interface ResourceInput {
  /** JSON:API 자원 타입. 응답 문서의 `data.type` 과 같아야 한다. */
  readonly type: string
  /** 화면 URL 의 첫 세그먼트. 백엔드 `path` 와 독립이라 둘 다 적는다. */
  readonly slug: string
  /** 백엔드 경로. `type` 에서 유도하지 않는다 - `exampleCategories` 의 경로는 `/api/v1/categories` 다. */
  readonly path: string
  readonly label: string
  /** 한 건을 대표하는 속성 키. 상세 제목과 관계 배지의 이름이 여기서 나온다. */
  readonly heading: string
  /** 이 자원에 쓰기 라우트가 있는가. 속성 단위 `readOnly` 와 층위가 다르다. */
  readonly writable: boolean
  readonly attributes: Readonly<Record<string, AttributeDef>>
  readonly relationships: Readonly<Record<string, RelationshipDef>>
  readonly columns: readonly ColumnInput[]
  readonly filters: readonly FilterInput[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
}

/** 소비자가 읽는 열. `label`·`kind` 는 유도된 값이다. */
export interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly kind: ColumnKind
  readonly sortable: boolean
}

/** 소비자가 읽는 필터. `label`·`options` 는 유도된 값이다. */
export interface FilterDef {
  readonly key: string
  readonly label: string
  readonly operators: readonly FilterOperator[]
  readonly uiOperator: FilterOperator
  readonly options?: readonly string[]
}

/** 소비자(`lib/grid/`·`components/`·`app/`)가 읽는 선언. */
export interface ResourceDef {
  readonly type: string
  readonly slug: string
  readonly path: string
  readonly label: string
  readonly heading: string
  readonly writable: boolean
  readonly attributes: Readonly<Record<string, AttributeDef>>
  readonly relationships: Readonly<Record<string, RelationshipDef>>
  readonly columns: readonly ColumnDef[]
  readonly filters: readonly FilterDef[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
}

/**
 * `관계.id` 꼴 필터 키에서 관계 키를 얻는다. 그 꼴이 아니면 `null`.
 * `deriveFilter` 가 라벨을 유도할 때, 그리고 목록 화면이 관계 필터의 보기
 * 목록을 어느 자원에서 조회할지 정할 때(`app/(admin)/[slug]/options.ts`)
 * 같은 판정을 쓴다 - 접미사 `.id` 를 두 곳이 각자 자르면 한쪽만 바뀌는 날
 * 필터 라벨과 보기 목록이 서로 다른 관계를 가리킨다.
 */
export function filterRelationshipKey(filterKey: string): string | null {
  const suffix = '.id'
  return filterKey.endsWith(suffix) ? filterKey.slice(0, -suffix.length) : null
}

/**
 * 열의 표현 - string·text → text, int → number, enum → badge, datetime →
 * datetime, to-one → badge, to-many → badges. 속성이 관계보다 먼저다. 둘 다
 * 아니면 text 로 떨어진다(불변식 테스트가 잡는다).
 */
function columnKindOf(
  attribute: AttributeDef | undefined,
  relationship: RelationshipDef | undefined,
): ColumnKind {
  if (attribute !== undefined) {
    switch (attribute.kind) {
      case 'string':
      case 'text':
        return 'text'
      case 'int':
        return 'number'
      case 'enum':
        return 'badge'
      case 'datetime':
        return 'datetime'
    }
  }
  if (relationship !== undefined) return relationship.cardinality === 'one' ? 'badge' : 'badges'
  return 'text'
}

function deriveColumn(input: ResourceInput, column: ColumnInput): ColumnDef {
  const attribute = input.attributes[column.key]
  const relationship = input.relationships[column.key]
  return {
    key: column.key,
    label: attribute?.label ?? relationship?.label ?? column.key,
    kind: columnKindOf(attribute, relationship),
    sortable: column.sortable,
  }
}

function deriveFilter(input: ResourceInput, filter: FilterInput): FilterDef {
  const relationshipKey = filterRelationshipKey(filter.key)
  const relationship = relationshipKey === null ? undefined : input.relationships[relationshipKey]
  const attribute = input.attributes[filter.key]
  const base: FilterDef = {
    key: filter.key,
    label: attribute?.label ?? relationship?.label ?? filter.key,
    operators: filter.operators,
    uiOperator: filter.uiOperator,
  }
  // enum 속성의 필터만 보기 목록을 갖는다. 그 외는 `options` 키 자체를 두지
  // 않는다(`exactOptionalPropertyTypes` - `undefined` 로 채우지 않는다).
  return attribute?.kind === 'enum' ? { ...base, options: attribute.values } : base
}

/**
 * 배열·일반 객체를 재귀적으로 동결한다. 원시값은 그대로 돌려준다 - 이미
 * 불변이라 동결이 의미가 없다. 함수·클래스 인스턴스는 이 계층에 나타나지
 * 않는다(선언은 데이터다).
 *
 * `unknown`을 거쳐 캐스팅하는 이유는 이 함수가 `ResourceDef`처럼 인덱스
 * 시그니처가 없는 타입과 `readonly T[]` 양쪽에서 호출되기 때문이다 - 구조가
 * 다른 두 타입에 같은 순회 코드를 쓰려면 한 번 `unknown`으로 넓혀야 한다.
 * 넓히는 것은 타입뿐이고, 동결은 같은 런타임 객체에 그대로 적용된다.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    const record = value as unknown as Record<string, unknown>
    for (const key of Object.keys(record)) {
      deepFreeze(record[key])
    }
    Object.freeze(record)
  }
  return value
}

/**
 * 선언 하나를 펼치고 깊게 동결해 돌려준다.
 *
 * 선언은 앱이 실행되는 동안 다시 쓰이지 않는다 - 어딘가에서 실수로 대입을
 * 시도하면 조용히 무시되는 대신 여기서 즉시 던지게 한다. 얕은 동결로는
 * 부족하다 - `columns`·`filters`·`attributes` 안의 배열과 객체까지 동결하지
 * 않으면 `resource.filters[0].operators.push(...)` 같은 변형이 여전히
 * 통과한다. 넘긴 `input` 의 중첩 객체는 같은 참조라 함께 동결된다.
 */
export function defineResource(input: ResourceInput): ResourceDef {
  return deepFreeze({
    type: input.type,
    slug: input.slug,
    path: input.path,
    label: input.label,
    heading: input.heading,
    writable: input.writable,
    attributes: input.attributes,
    relationships: input.relationships,
    columns: input.columns.map((column) => deriveColumn(input, column)),
    filters: input.filters.map((filter) => deriveFilter(input, filter)),
    sorts: input.sorts,
    includes: input.includes,
  })
}

/**
 * 폼이 그리는 속성 - `readOnly` 가 아닌 것, 선언 순서대로. `readOnly` 속성은
 * 폼이 보내서도 안 된다 - 쓰기 문서는 이 목록으로만 조립한다
 * (`lib/form/write.ts`).
 */
export function formAttributes(
  resource: ResourceDef,
): readonly (readonly [string, AttributeDef])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => !attribute.readOnly)
}

/** 상세가 "지금 저장된 값"으로 보이는 속성 - `readOnly` 인 것, 선언 순서대로. */
export function readOnlyAttributes(
  resource: ResourceDef,
): readonly (readonly [string, AttributeDef])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => attribute.readOnly)
}

/**
 * 이 속성이 필수인가 - `readOnly` 도 `nullable` 도 아닌 것. "필수 ⟺ 응답에서
 * null 불가"라는 전제 위에 서 있다. 전제가 깨지는 속성이 생기면 선언에
 * 플래그를 더한다 - 그 전까지 세 번째 플래그는 두 플래그와 조용히 모순될
 * 자리만 만든다. 깨져도 조용히 틀리지 않는다 - 백엔드가 422 를 내고 그
 * 오류가 화면에 뜬다.
 */
export function isRequiredAttribute(attribute: AttributeDef): boolean {
  return !attribute.readOnly && !attribute.nullable
}
