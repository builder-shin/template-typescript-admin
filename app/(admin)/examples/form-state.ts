/**
 * `examples` 생성·수정 폼의 화면 상태와 입력 이름.
 *
 * ## 이 파일이 따로 있는 이유는 클라이언트 번들 경계다
 *
 * 이 모듈은 **런타임 import 가 하나도 없다.** 아래 상수·타입·초기값은
 * `[id]/edit-form.tsx`(`'use client'`, `new/page.tsx` 도 그것을 통해 같은
 * 것을 쓴다)가 값으로 가져가야 하는데, 오류 판단(`examplesFormState`)을 이
 * 파일에 두면 그 함수가 값으로 import 하는 `lib/jsonapi/errors` ->
 * `lib/jsonapi/client` -> `lib/config/settings`(process.env 를 읽는 서버
 * 전용 코드)까지 클라이언트 컴포넌트가 끌어들이는 자리가 된다 - 실제로
 * 그렇게 되는지는 빌드마다 다시 재야 하는 사실이고, 아무 게이트도 그것을
 * 검사하지 않는다. 판단을 `./flow.ts` 로 완전히 빼면 그 질문 자체가
 * 사라진다 - 이 파일을 눈으로 읽는 것만으로 "런타임 import 가 없다"를 확인할
 * 수 있다. `lib/auth/form-state.ts` 와 같은 경계, 같은 이유다.
 *
 * **이 파일에 import 를 추가하지 마라.** 추가하는 순간 위 경계가 무너지고,
 * 그 사실은 빌드가 통과하기 때문에 조용히 일어난다(lib/auth/form-state.ts
 * 의 같은 경고).
 *
 * `examplesFormState`(오류 배열을 아래 `ExamplesFormState` 로 바꾸는 판단)는
 * `./flow.ts` 에 있다 - `actions.ts`(Server Action, 서버 전용) 하나만 그것을
 * 부른다.
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
