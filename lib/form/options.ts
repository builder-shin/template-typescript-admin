import type { CollectionDocument } from '@/lib/jsonapi/document'
import type { ResourceDef } from '@/lib/resources'
import { headingLabel } from './values'

/**
 * 관계 선택 목록의 항목 하나 - 폼의 Select·Checkbox 와 그리드의 필터 Select 가
 * 같은 모양을 쓴다.
 */
export interface OptionItem {
  readonly id: string
  readonly name: string
}

/**
 * 대상 자원의 목록 문서를 선택 목록으로 바꾼다. 이름은 그 자원 선언의
 * `heading` 속성에서 읽는다 - `name` 을 박아 읽으면 대표 속성이 다른 자원의
 * 목록이 전부 id 로 그려진다. 문자열이 아니면(계약 위반) id 로 대신한다
 * (`headingLabel`).
 */
export function optionsFromDocument(
  resource: ResourceDef,
  document: CollectionDocument,
): OptionItem[] {
  return document.data.map((object) => ({
    id: object.id,
    name: headingLabel(object, resource.heading),
  }))
}
