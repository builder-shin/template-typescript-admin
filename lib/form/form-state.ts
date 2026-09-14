/**
 * 자원 생성·수정 폼의 화면 상태.
 *
 * ## 이 파일이 따로 있는 이유는 클라이언트 번들 경계다
 *
 * 이 모듈은 **런타임 import 가 하나도 없다.** 아래 상태 모양·초기값·문구는
 * `components/resource/resource-form.tsx`(`'use client'`)가 값으로 가져가야
 * 하는데, 오류 판단(`resourceFormState`)을 이 파일에 두면 그 함수가 값으로
 * import 하는 `lib/jsonapi/errors` 가 클라이언트 번들 그래프에 들어온다.
 * 판단은 `./flow.ts` 가 갖고 이 파일은 데이터만 갖는다 -
 * `lib/auth/form-state.ts` 와 같은 경계, 같은 이유다.
 *
 * **이 파일에 import 를 추가하지 마라.** 추가하는 순간 위 경계가 무너지고,
 * 그 사실은 빌드가 통과하기 때문에 조용히 일어난다.
 *
 * ## 입력 이름의 계약은 자원 선언이 갖는다
 *
 * 입력의 `name`, `FormData` 에서 읽는 키, JSON:API `attributes`/`relationships`
 * 의 키, 오류를 되돌릴 때 `groupErrors()` 에서 찾는 키가 전부 **선언의 속성·
 * 관계 키**다(`lib/resources/*.ts`). 예전 `app/(admin)/examples/form-state.ts`
 * 가 필드 이름 상수 여섯으로 지키던 것을 선언이 대신한다 -
 * 넷 중 하나만 어긋나면 오류가 엉뚱한 입력 아래 그려지거나 사라지는데, 이제
 * 어긋날 자리 자체가 없다.
 */

/** `useActionState` 가 Server Action 의 반환값으로 이 모양을 그대로 받는다. */
export interface ResourceFormState {
  /** 속성 키 -> 그 입력 아래 그릴 문구들. */
  attributeErrors: Record<string, string[]>
  /** 관계 키 -> 그 입력 아래 그릴 문구들. */
  relationshipErrors: Record<string, string[]>
  /** 상단 배너에 그릴 문구들. */
  documentErrors: string[]
  /**
   * 백엔드가 쓸 수 있는 답을 주지 못했다 - transport(client.ts 가 합성한
   * 오류)이거나, 오류 문서인데 문구가 하나도 없다(groupErrors 의 세 버킷이
   * 전부 비었다). 이때 documentErrors 는 비워 둔다 - 화면이 `unusable` 을
   * 보고 `UNUSABLE_RESOURCE_MESSAGE` 를 직접 그린다. 이 경우가 프론트가
   * 자기 문구를 갖는 유일한 자리다(백엔드가 애초에 보여줄 문구를 주지 못했다).
   */
  unusable: boolean
}

/** 아직 제출하지 않은 폼의 상태. `useActionState` 의 초기값이다. */
export const IDLE_RESOURCE_FORM_STATE: ResourceFormState = {
  attributeErrors: {},
  relationshipErrors: {},
  documentErrors: [],
  unusable: false,
}

/** `useActionState` 에 넘길 수 있게 대상(slug·id)을 이미 bind 한 Server Action. */
export type ResourceFormAction = (
  state: ResourceFormState,
  formData: FormData,
) => Promise<ResourceFormState>

/** `unusable` 일 때 화면이 그릴 고정 문구 - 백엔드가 애초에 문구를 주지 못한 경우라 프론트가 직접 고른다. */
export const UNUSABLE_RESOURCE_MESSAGE =
  '지금은 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
