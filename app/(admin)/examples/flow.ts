import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors } from '@/lib/jsonapi/errors'
import type { ExamplesFormState } from './form-state'

/**
 * `examples` 생성·수정 폼의 **판단** - 오류 배열을 화면 상태로 바꾼다.
 *
 * `lib/auth/flow.ts` 의 `authFormStateFromErrors` 와 같은 분리다 - 그 파일이
 * `lib/auth/form-state.ts` 를 클라이언트 번들 경계(런타임 import 0개)로 두고
 * 오류 판단을 여기로 뺀 것과 같은 이유로, 이 파일이 `lib/jsonapi/errors` 를
 * 값으로 import 하는 자리를 떠맡고 `../form-state.ts` 는 상수·타입·초기값만
 * 남는다. `examplesFormState` 를 부르는 것은 `actions.ts`(Server Action, 서버
 * 전용) 하나뿐이다 - `edit-form.tsx`(`'use client'`) 는 이 파일을 몰라도 된다.
 *
 * 판단 순서는 `authFormStateFromErrors` 를 그대로 옮긴 것이다 -
 * `actionForErrors(errors) === 'transport'` 를 먼저 걸러내고, `groupErrors` 로
 * 묶고, 문구가 하나도 없으면(세 버킷이 전부 비면) "쓸 수 없는 응답"으로
 * 떨어뜨린다. 산문으로 다시 적지 않는 이유는 그 사본이 드리프트하기
 * 때문이다(flow.ts 의 같은 주석 참고).
 *
 * auth 와 다른 점은 딱 하나다 - **이 폼에는 관계 입력(분류·라벨)이 있다.**
 * 인증 폼은 관계 입력이 없어 관계 오류를 배너로 접었지만(auth flow.ts:
 * "그릴 자리가 없으면 배너가 옳다"), 이 폼은 그릴 자리가 있으므로
 * `relationshipErrors` 를 attributeErrors 와 분리해 관계 입력 아래 붙인다.
 */

const UNUSABLE_EXAMPLES_FORM_STATE: ExamplesFormState = {
  attributeErrors: {},
  relationshipErrors: {},
  documentErrors: [],
  unusable: true,
}

function isEmpty(
  attributes: Record<string, string[]>,
  relationships: Record<string, string[]>,
  document: string[],
): boolean {
  return (
    document.length === 0 &&
    Object.keys(attributes).length === 0 &&
    Object.keys(relationships).length === 0
  )
}

export function examplesFormState(errors: readonly ErrorObject[]): ExamplesFormState {
  if (actionForErrors(errors) === 'transport') return UNUSABLE_EXAMPLES_FORM_STATE

  const grouped = groupErrors(errors)
  if (isEmpty(grouped.attributes, grouped.relationships, grouped.document)) {
    return UNUSABLE_EXAMPLES_FORM_STATE
  }

  return {
    attributeErrors: grouped.attributes,
    relationshipErrors: grouped.relationships,
    documentErrors: grouped.document,
    unusable: false,
  }
}
