/**
 * 자원 선언의 형태와 동결.
 *
 * 이 파일은 어떤 자원 이름도 모른다 - "자원을 어떤 모양으로 선언할 수
 * 있는가"만 정의한다. 실제 자원(`example.ts`·`category.ts`·`tag.ts`)이 각자
 * 이 모양을 채운다. 자원 이름을 아는 것, JSX 를 그리는 것, `fetch`를 부르는
 * 것은 모두 다른 계층의 일이다 - 이 디렉터리에는 셋 다 두지 않는다.
 */

/**
 * 백엔드가 정한 필터 연산자 어휘. 화면이 바라는 이름이 아니라 백엔드의
 * `FilterField` 정책이 실제로 읽는 이름이다.
 */
export type FilterOperator = 'exact' | 'contains' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'isNull'

export type ColumnKind = 'text' | 'number' | 'badge' | 'badges' | 'datetime'

export interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly kind: ColumnKind
  readonly sortable: boolean
}

export interface FilterDef {
  /** 백엔드의 필터 키. 관계는 `category.id` 처럼 점을 포함한다. */
  readonly key: string
  readonly label: string
  /** 백엔드가 그 필드에 허용한 연산자 전부. 손으로 베낀 거울이다. */
  readonly operators: readonly FilterOperator[]
  /** 화면이 기본으로 쓰는 연산자. `operators` 안에 있어야 한다. */
  readonly uiOperator: FilterOperator
  readonly options?: readonly string[]
}

export interface ResourceDef {
  readonly type: string
  readonly path: string
  readonly label: string
  readonly writable: boolean
  readonly columns: readonly ColumnDef[]
  readonly filters: readonly FilterDef[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
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
 * 자원 선언 하나를 깊게 동결해 돌려준다.
 *
 * 선언은 앱이 실행되는 동안 다시 쓰이지 않는다 - 어딘가에서 실수로 대입을
 * 시도하면 조용히 무시되는 대신 여기서 즉시 던지게 한다. 얕은 동결로는
 * 부족하다 - `columns`·`filters` 안의 배열과 객체까지 동결하지 않으면
 * `resource.filters[0].operators.push(...)` 같은 변형이 여전히 통과한다.
 */
export function defineResource(def: ResourceDef): ResourceDef {
  return deepFreeze(def)
}
