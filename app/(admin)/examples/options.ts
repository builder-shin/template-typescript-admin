import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import type { ResourceDef } from '@/lib/resources'

/**
 * 생성·수정 폼의 선택 목록(분류·라벨)을 조회하는 요청 - `count.ts`·`health.ts`
 * 와 같은 이유로 화면 옆에 둔다(lib/resources/ 는 어떤 내부 모듈도 import
 * 하지 않는 순수 선언 계층이다, lib/resources/AGENTS.md).
 *
 * `listRequest`(../list.ts)를 재사용하지 않는다 - 이유는 include 다. 실측
 * (2026-09-12): `exampleCategories`·`exampleTags` 는 `includes` 허용 목록이
 * **빈 집합**이라(역참조가 순환을 만들어서 의도적으로 비웠다) include 를
 * 실으면 거절된다. 오늘은 두 자원의 `resource.includes` 가 실제로 비어
 * 있어 `listRequest` 를 그대로 써도 결과가 같지만, 그건 우연이다 - 훗날 두
 * 자원에 include 가 추가되면 `listRequest` 는 그 즉시 include 를 실어 이
 * 목록 조회가 거절되기 시작한다. 이 함수는 애초에 include 를 만들 수 있는
 * 경로 자체를 두지 않아 그 회귀에서 안전하다(`countRequest` 가 카드 용도로
 * include 를 아예 안 싣는 것과 같은 판단).
 *
 * `page[size]=100` 만 고정으로 싣는다 - 선택 목록은 필터·정렬·커서 없이
 * "가능한 한 많이" 받으면 되는 용도라 `listRequest`처럼 그리드 상태 전체를
 * 조립할 이유가 없다. `page[totals]` 는 싣지 않는다 - 이 함수의 소비자는
 * 총합을 읽지 않는다(countRequest 와 반대 지점 - 그쪽은 총합만 필요하다).
 */
export function optionsRequest(
  resource: ResourceDef,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const query = new URLSearchParams({ 'page[size]': '100' })
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

export interface OptionItem {
  readonly id: string
  readonly name: string
}

/**
 * 목록 문서를 선택 목록으로 바꾼다. `name` 이 문자열이 아니면(계약 위반) id
 * 로 대신한다 - components/grid/format.ts 의 `relationshipLabel` 과 같은
 * 방어다.
 */
export function optionsFromDocument(document: CollectionDocument): OptionItem[] {
  return document.data.map((object) => {
    const name = object.attributes?.name
    return { id: object.id, name: typeof name === 'string' ? name : object.id }
  })
}

/**
 * `optionsRequest` 의 결과를 문서로 좁힌다 - 실패(!ok)·204(document: null)
 * 둘 다 이 화면이 스스로 고칠 수 없는 예외라 던진다(`examples/page.tsx` 와
 * 같은 선택). `[id]/page.tsx`·`new/page.tsx` 가 분류·라벨 각각에 이 함수를
 * 부른다 - 두 화면에 같은 세 줄짜리 unwrap 을 따로 베끼지 않기 위해서다.
 */
export function unwrapOptionsResult(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error(result.errors[0]?.detail ?? '선택 목록을 불러오지 못했습니다.')
  }
  if (result.document === null) {
    throw new Error('선택 목록 응답에 본문이 없습니다.')
  }
  return result.document
}
