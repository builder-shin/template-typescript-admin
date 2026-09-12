import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors } from '@/lib/jsonapi/errors'

/**
 * `examples` 생성·수정 폼의 화면 상태와 입력 이름.
 *
 * 모양과 판단은 `lib/auth/flow.ts` 의 `authFormStateFromErrors` 를 그대로
 * 옮긴 것이다 - `actionForErrors(errors) === 'transport'` 를 먼저 걸러내고,
 * `groupErrors` 로 묶고, 문구가 하나도 없으면 "쓸 수 없는 응답"으로
 * 떨어뜨린다. 산문으로 다시 적지 않는 이유는 그 사본이 드리프트하기
 * 때문이다(flow.ts 의 같은 주석 참고).
 *
 * auth 와 다른 점은 딱 하나다 - **이 폼에는 관계 입력(분류·라벨)이 있다.**
 * 인증 폼은 관계 입력이 없어 관계 오류를 배너로 접었지만(flow.ts: "그릴
 * 자리가 없으면 배너가 옳다"), 이 폼은 그릴 자리가 있으므로
 * `relationshipErrors` 를 attributeErrors 와 분리해 관계 입력 아래 붙인다.
 *
 * auth 와 달리 `context` 인자가 없다 - auth 는 실패한 응답에도 제출된
 * 이메일과 `accountCreated` 를 되돌려줘야 했지만, 이 폼의 입력은 전부
 * `defaultValue` 로 미리 채워져 있어(수정 폼은 기존 값, 생성 폼은 빈 값)
 * 실패해도 브라우저가 다시 그린 입력이 스스로 제출된 값을 쥔다 - 되돌려줄
 * 것이 없다.
 *
 * `lib/auth/form-state.ts` 와 달리 이 파일 하나에 상태 모양과 그것을 만드는
 * 로직을 함께 둔다. auth 는 로그인·가입 두 화면이 `credentials-form.tsx`
 * 하나를 공유해야 해서 그 파일이 "런타임 import 가 없는 클라이언트 번들
 * 경계"를 맡고, 오류 판단(`authFormStateFromErrors`)은 별도로 `flow.ts` 에
 * 있다. 이 폼은 오류 판단의 소비자가 `actions.ts`(Server Action) 하나뿐이라
 * 가를 이유가 없다 - `edit-form.tsx` 는 아래 상수·타입·`IDLE_EXAMPLES_FORM_STATE`
 * 만 값으로 가져간다.
 */

/**
 * 입력의 `name`, `FormData` 에서 읽는 키, JSON:API `attributes`/`relationships`
 * 의 키, 그리고 오류를 되돌릴 때 `groupErrors()` 에서 찾는 키가 전부 이
 * 상수들이다 - lib/auth/form-state.ts 의 EMAIL_FIELD·PASSWORD_FIELD 와 같은
 * 계약이다. 넷 중 하나만 어긋나면 오류가 엉뚱한 입력 아래 그려지거나 아예
 * 사라지는데, 그 어긋남은 타입 검사로도 빌드로도 드러나지 않는다.
 */
export const TITLE_FIELD = 'title'
export const DESCRIPTION_FIELD = 'description'
export const STATUS_FIELD = 'status'
export const SCORE_FIELD = 'score'
export const CATEGORY_FIELD = 'category'
export const TAGS_FIELD = 'tags'

/** `useActionState` 가 Server Action 의 반환값으로 이 모양을 그대로 받는다. */
export interface ExamplesFormState {
  /** 속성 입력 이름 -> 그 입력 아래 그릴 문구들. */
  attributeErrors: Record<string, string[]>
  /** 관계 입력 이름 -> 그 입력 아래 그릴 문구들. */
  relationshipErrors: Record<string, string[]>
  /** 상단 배너에 그릴 문구들. */
  documentErrors: string[]
  /**
   * 백엔드가 쓸 수 있는 답을 주지 못했다 - transport(client.ts 가 합성한
   * 오류) 이거나, 오류 문서인데 문구가 하나도 없다(groupErrors 의 세 버킷이
   * 전부 비었다). 이때 documentErrors 는 비워 둔다 - 화면이 `unusable` 을
   * 보고 `UNUSABLE_EXAMPLES_MESSAGE`(아래)를 직접 그린다. lib/auth/form-state.ts
   * 의 UNUSABLE_RESPONSE_MESSAGE 와 같은 이유로, 이 경우가 프론트가 자기
   * 문구를 갖는 유일한 자리다(백엔드가 애초에 보여줄 문구를 주지 못했다).
   */
  unusable: boolean
}

/** 아직 제출하지 않은 폼의 상태. `useActionState` 의 초기값이다. */
export const IDLE_EXAMPLES_FORM_STATE: ExamplesFormState = {
  attributeErrors: {},
  relationshipErrors: {},
  documentErrors: [],
  unusable: false,
}

/** `useActionState` 에 넘길 수 있게 대상 id 를 이미 bind 한 Server Action(수정) 또는 그대로인 Action(생성). */
export type ExamplesFormAction = (
  state: ExamplesFormState,
  formData: FormData,
) => Promise<ExamplesFormState>

/** `unusable` 일 때 화면이 그릴 고정 문구 - 백엔드가 애초에 문구를 주지 못한 경우라 프론트가 직접 고른다. */
export const UNUSABLE_EXAMPLES_MESSAGE =
  '지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'

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
