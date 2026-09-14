import type { OptionItem } from '@/lib/form/options'
import type { AttributeDef, RelationshipDef } from '@/lib/resources'

/**
 * 선언 → 폼 컨트롤. `components/grid/filter-control.ts` 와 같은 꼴이다 -
 * `resource-form.tsx`(`'use client'`)에서 판단만 떼어 지시어 없는 형제
 * 모듈에 두므로 단위 테스트가 직접 부르고, 서버 컴포넌트가 값으로 불러도
 * 안전하다(루트 `AGENTS.md` 규칙 6).
 *
 * 자원 이름은 모른다 - 분기는 `kind` 와 `cardinality` 로만 한다. 속성 종류를
 * 더하면 `AttributeKind`(lib/resources/define.ts)와 함께 여기 갈래를 더한다.
 */

export type AttributeControl = 'text' | 'textarea' | 'select' | 'number' | 'datetime'

/** 갈래가 빠지면 반환 타입 검사가 컴파일을 깨뜨린다 - `default` 가 필요 없다. */
export function attributeControlFor(attribute: AttributeDef): AttributeControl {
  switch (attribute.kind) {
    case 'string':
      return 'text'
    case 'text':
      return 'textarea'
    case 'enum':
      return 'select'
    case 'int':
      return 'number'
    case 'datetime':
      return 'datetime'
  }
}

/** `<Input>` 으로 그리는 컨트롤 - textarea 와 select 를 뺀 나머지. */
export type InputControl = Exclude<AttributeControl, 'textarea' | 'select'>

/** 브라우저 `input type`. datetime 은 `datetime-local` 이다 - 오늘 readOnly 가 아닌 datetime 속성은 없다. */
export function inputTypeFor(control: InputControl): 'text' | 'number' | 'datetime-local' {
  switch (control) {
    case 'text':
      return 'text'
    case 'number':
      return 'number'
    case 'datetime':
      return 'datetime-local'
  }
}

/** 생성 폼(초기값 없음)의 속성 기본값 - enum 은 첫 값, 나머지는 빈 값. */
export function defaultAttributeValue(attribute: AttributeDef): string {
  return attribute.kind === 'enum' ? (attribute.values[0] ?? '') : ''
}

/** 생성 폼의 관계 기본값 - 비울 수 없는 to-one 은 첫 보기, 나머지는 없음. */
export function defaultRelationshipValues(
  relationship: RelationshipDef,
  options: readonly OptionItem[],
): readonly string[] {
  if (relationship.cardinality === 'one' && !relationship.nullable) {
    const first = options[0]
    return first === undefined ? [] : [first.id]
  }
  return []
}
