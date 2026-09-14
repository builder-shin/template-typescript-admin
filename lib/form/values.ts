import type { ResourceIdentifier, ResourceObject } from '@/lib/jsonapi/document'
import {
  isResourceObject,
  resolveToMany,
  resolveToOne,
  type ResourceIndex,
} from '@/lib/jsonapi/normalize'
import { formAttributes, type ResourceDef } from '@/lib/resources'

/**
 * 응답 문서 → 폼이 드는 값. `lib/form/write.ts` 의 반대 방향이다.
 *
 * ## 값이 전부 문자열인 것은 선택이 아니라 사실이다
 *
 * `FormData` 가 주는 값은 전부 문자열이다. 폼 초기값도 같은 세계에 두어야
 * `<Input defaultValue>`·`<Select defaultValue>` 에 그대로 넣고, 되돌아온
 * `FormData` 와 같은 모양으로 비교할 수 있다. 숫자는 `String()`, `null` 과
 * 누락은 빈 문자열이다.
 *
 * ## 관계는 id 배열이다
 *
 * to-one 은 0 또는 1개, to-many 는 0개 이상이라 두 모양을 한 타입으로
 * 표현하면 폼이 cardinality 하나로만 갈라 쓸 수 있다. `included` 는 풀지
 * 않는다 - 초기값에 필요한 것은 id 뿐이고 식별자가 이미 그것을 갖는다.
 */

export interface ResourceFormValues {
  readonly attributes: Readonly<Record<string, string>>
  readonly relationships: Readonly<Record<string, readonly string[]>>
}

/**
 * 관계 대상의 표시 이름 - `included` 로 풀렸고 `headingKey` 속성이 문자열이면
 * 그 값, 아니면 id. `headingKey` 가 `undefined` 면(대상 자원을 모른다) 곧장
 * id 다.
 *
 * 그리드의 관계 배지(`components/grid/format.ts` 의 `relationshipLabel`)와
 * 폼의 선택 목록(`./options.ts` 의 `optionsFromDocument`)이 이 하나를 쓴다 -
 * "이름이 없으면 id 로 대신한다"는 판단이 두 벌로 갈리지 않게 여기 둔다.
 * `components/` 가 아니라 여기 있는 이유는 방향이다 - `lib/` 는
 * `components/` 를 import 하지 않는다.
 */
export function headingLabel(
  target: ResourceObject | ResourceIdentifier,
  headingKey: string | undefined,
): string {
  if (headingKey !== undefined && isResourceObject(target)) {
    const value = target.attributes?.[headingKey]
    if (typeof value === 'string') return value
  }
  return target.id
}

/**
 * 문자열·숫자만 폼 값이 된다. `null`·누락·그 밖의 타입(불리언·객체)은 전부
 * `''` 다 - 선언의 다섯 종류가 문자열 아니면 정수뿐이라 그 밖의 값은
 * 계약 위반이고, 그때 폼에 무엇을 채워 넣어도 거짓이다. 빈 값이면 저장할
 * 때 `writeDocument` 의 빈 값 규칙이 적용된다.
 */
function attributeText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/** 식별자에서 id 만 읽으므로 풀 것이 없다 - 빈 인덱스로 `resolve*` 를 부른다. */
const EMPTY_INDEX: ResourceIndex = new Map()

export function initialFormValues(
  resource: ResourceDef,
  object: ResourceObject,
): ResourceFormValues {
  const attributes: Record<string, string> = {}
  for (const [key] of formAttributes(resource)) {
    attributes[key] = attributeText(object.attributes?.[key])
  }

  const relationships: Record<string, readonly string[]> = {}
  for (const [key, relationship] of Object.entries(resource.relationships)) {
    const link = object.relationships?.[key]
    if (relationship.cardinality === 'one') {
      const target = resolveToOne(link, EMPTY_INDEX)
      relationships[key] = target === null ? [] : [target.id]
    } else {
      relationships[key] = resolveToMany(link, EMPTY_INDEX).map((target) => target.id)
    }
  }

  return { attributes, relationships }
}
