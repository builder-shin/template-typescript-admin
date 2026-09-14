import { writeDocument } from '@/lib/form/write'
import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { ResourceDef } from '@/lib/resources'

/**
 * 쓰기 요청의 조립 - `actions.ts` 의 Server Action 이 아니라 여기 두는 이유는
 * `'use server'` 자체다.
 *
 * `actions.ts` 는 파일 맨 위에 `'use server'` 를 선언하고, Next 는 그 지시어가
 * 있는 파일의 **모든 export** 를 Server Action 참조로 다룬다 - 그리고 Server
 * Action 은 반드시 async 함수여야 한다("Server Actions must be async
 * functions", 실측: 이 함수들을 `actions.ts` 안에 동기 함수로 그대로 두면
 * `next build` 가 그 자리에서 죽는다). 이 파일의 함수들은 순수 계산(경로·
 * 메서드·토큰·언어를 튜플로 묶는 일)이라 애초에 async 일 이유가 없다 -
 * 그래서 `'use server'` 가 없는 별도 모듈로 뺐다. `../list.ts` 의
 * `listRequest` · `./[id]/detail.ts` 의 `detailRequest` 와 같은 이유다.
 *
 * **본문은 여기서 조립하지 않는다.** `FormData` → JSON:API 문서는 자원을
 * 모르는 순수 변환이라 `lib/form/write.ts` 의 `writeDocument` 가 갖는다 -
 * 이 파일은 그 문서를 요청 옵션에 싣고 경로·메서드·토큰·언어를 붙일 뿐이다.
 * 자원을 인자로 받으므로 어느 자원에도 같은 코드가 동작한다 - `actions.ts`
 * 가 `slug` 로 찾은 선언을 그대로 넘긴다.
 *
 * `accessToken`·`acceptLanguage` 를 이미 구해진 값으로 인자로 받는다 -
 * `headers()`·`cookies()` 를 이 파일이 알면 다시 요청 스코프에 묶여 단위
 * 테스트가 못 부른다. 그 값을 구하는 것은 `actions.ts` 의 Action 들이다.
 */

/**
 * 생성 요청 - 경로·본문·토큰·언어를 한 곳에서 만든다. `accessToken`이 실제로
 * `options.accessToken`에 실리는지가 이 함수 하나로 고정된다(단위 테스트) -
 * `RequestOptions.accessToken`이 선택 필드라 그냥 빠뜨려도 타입 검사를
 * 통과한다는 것이 애초에 이 자리가 무가드였던 이유다.
 */
export function createRequest(
  resource: ResourceDef,
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    resource.path,
    withAcceptLanguage(
      { method: 'POST', body: writeDocument(resource, formData), accessToken },
      acceptLanguage,
    ),
  ]
}

/** 수정 요청 - `createRequest` 와 같은 이유로 뺐다. PATCH 다, PUT 이 아니다(actions.ts 머리말). */
export function updateRequest(
  resource: ResourceDef,
  id: string,
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    `${resource.path}/${id}`,
    withAcceptLanguage(
      { method: 'PATCH', body: writeDocument(resource, formData, id), accessToken },
      acceptLanguage,
    ),
  ]
}

/**
 * 삭제 요청 - 단건 Action 과 일괄 Action 이 공유한다. 둘 다 `DELETE
 * <path>/{id}` 하나뿐이고 갈리는 것은 **결과를 다루는 방식**(단건은 던지고
 * 리다이렉트, 일괄은 `BulkOutcome` 으로 접는다)이지 요청 모양이 아니다.
 *
 * `signal` 은 선택이고, 있으면 그대로 `RequestOptions.signal` 에 실어
 * `request()` 에 넘긴다(`exactOptionalPropertyTypes` 때문에 없으면 키
 * 자체를 뺀다 - `withAcceptLanguage` 와 같은 관례). 호출부(`actions.ts`)가
 * 이 신호를 무엇으로 채우는지는 이 함수가 모른다 - 그 판단과 근거는
 * `actions.ts` 에 있다(요약: 브라우저의 취소 버튼이 쥔 `AbortController`
 * 는 Server Action 인자로 건널 수 없어, 서버 쪽에서 새로 만든 타임아웃을
 * 쓴다).
 */
export function deleteRequest(
  resource: ResourceDef,
  id: string,
  accessToken: string,
  acceptLanguage: string | null,
  signal?: AbortSignal,
): [path: string, options: RequestOptions] {
  return [
    `${resource.path}/${id}`,
    withAcceptLanguage(
      { method: 'DELETE', accessToken, ...(signal !== undefined ? { signal } : {}) },
      acceptLanguage,
    ),
  ]
}
