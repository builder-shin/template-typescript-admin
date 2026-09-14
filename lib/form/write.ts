import {
  formAttributes,
  type AttributeDef,
  type RelationshipDef,
  type ResourceDef,
} from '@/lib/resources'

/**
 * `FormData` → JSON:API 쓰기 문서. 선언을 읽어 조립하고 자원 이름은 모른다.
 *
 * `lib/grid/query.ts` 의 `gridQuery` 가 "URL 이 말하는 것을 백엔드 질의로"
 * 바꾸듯, 이 함수는 "폼이 말하는 것을 쓰기 문서로" 바꾼다. 실제 전송은
 * `app/` 의 Server Action 이 한다 - 이 파일은 `fetch` 도 `request()` 도
 * 부르지 않는다.
 *
 * ## 규칙 - 빈 값과 종류
 *
 * "빈 값"은 앞뒤 공백을 지운 결과가 빈 문자열인 것이다. 보내는 값은 원문
 * 그대로다 - 정규화(trim 등)는 백엔드의 일이고, 프론트가 한 번 더 하면
 * 두 정규화가 어긋나는 자리가 생긴다.
 *
 * - `readOnly` 속성은 보내지 않는다. 정본은 `createdAt` 을 받으면 무시하지
 *   않고 422 를 낸다 - 응답 문서를 그대로 되돌려 보내는 편집 폼이 깨지는
 *   이유가 그것이라, 쓰기 문서는 `formAttributes` 로 화이트리스트 조립한다.
 * - 빈 값은 `nullable` 이면 `null` 이다. `nullable` 이 아닌 문자열 속성은
 *   `''` 그대로 보내 백엔드가 필수 오류를 그 필드 아래 내게 한다.
 * - 빈 `int` 는 `nullable` 이 아니면 **키를 뺀다.** `Number('')` 은 `0` 이라
 *   운영자가 비워 둔 것이 조용히 `0` 으로 저장된다 - 예전 `examples` 폼이
 *   정확히 그렇게 보냈다. 키를 빼면 백엔드가 "필수 속성이 없다"를 그 필드
 *   아래 오류로 돌려준다.
 * - 정수가 아닌 `int` 는 원문 문자열 그대로 보낸다. `Number('abc')` 은 `NaN`
 *   이고 `JSON.stringify` 는 `NaN` 을 `null` 로 쓴다 - 잘못 적은 값이
 *   "없음"으로 둔갑한다. 원문을 보내면 백엔드가 타입 오류를 그 필드 아래
 *   낸다.
 * - to-one 은 `''`(폼의 "없음" 항목)이면 `{ data: null }`, 아니면 대상 자원의
 *   `type` 과 id. to-many 는 같은 name 의 값마다 식별자이고 없으면 `[]` 다.
 *
 * 선언에 없는 폼 필드는 읽지 않는다 - `readGridState` 가 선언에 없는 URL
 * 파라미터를 버리는 것과 같은 규칙이다.
 */

export interface WriteRelationshipData {
  readonly type: string
  readonly id: string
}

export interface WriteDocument {
  readonly data: {
    readonly type: string
    readonly id?: string
    readonly attributes: Readonly<Record<string, string | number | null>>
    readonly relationships: Readonly<
      Record<
        string,
        { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null }
      >
    >
  }
}

/** 앞뒤 공백을 허용한 정수 문자열. `4.5`·`abc` 는 맞지 않는다. */
const INTEGER = /^-?\d+$/

/** FormData 는 텍스트 입력을 항상 문자열로 준다 - 없으면 빈 문자열이다. */
function rawOf(formData: FormData, name: string): string {
  const raw = formData.get(name)
  return typeof raw === 'string' ? raw : ''
}

type AttributeOutcome =
  { readonly present: false } | { readonly present: true; readonly value: string | number | null }

function attributeOutcome(attribute: AttributeDef, raw: string): AttributeOutcome {
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (attribute.nullable) return { present: true, value: null }
    return attribute.kind === 'int' ? { present: false } : { present: true, value: '' }
  }
  if (attribute.kind === 'int') {
    return { present: true, value: INTEGER.test(trimmed) ? Number(trimmed) : raw }
  }
  return { present: true, value: raw }
}

function relationshipData(
  key: string,
  relationship: RelationshipDef,
  formData: FormData,
): { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null } {
  if (relationship.cardinality === 'one') {
    const id = rawOf(formData, key)
    return { data: id === '' ? null : { type: relationship.type, id } }
  }
  return {
    data: formData
      .getAll(key)
      .filter((value): value is string => typeof value === 'string' && value !== '')
      .map((id) => ({ type: relationship.type, id })),
  }
}

export function writeDocument(
  resource: ResourceDef,
  formData: FormData,
  id?: string,
): WriteDocument {
  const attributes: Record<string, string | number | null> = {}
  for (const [key, attribute] of formAttributes(resource)) {
    const outcome = attributeOutcome(attribute, rawOf(formData, key))
    if (outcome.present) attributes[key] = outcome.value
  }

  const relationships: Record<
    string,
    { readonly data: WriteRelationshipData | readonly WriteRelationshipData[] | null }
  > = {}
  for (const [key, relationship] of Object.entries(resource.relationships)) {
    relationships[key] = relationshipData(key, relationship, formData)
  }

  return {
    data: {
      type: resource.type,
      ...(id !== undefined ? { id } : {}),
      attributes,
      relationships,
    },
  }
}
