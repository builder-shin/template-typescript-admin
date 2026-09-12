'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { BulkOutcome } from '@/lib/bulk/executor'
import { requireSession } from '@/lib/auth/guard'
import { request } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import { examplesFormState } from './flow'
import type { ExamplesFormState } from './form-state'
import { createExampleRequest, deleteExampleRequest, updateExampleRequest } from './write'

/**
 * `examples` 의 생성·수정·삭제 Server Action.
 *
 * 판단은 이미 다른 파일에 있다 - 필드 배치는 `lib/jsonapi/errors.ts`(Task 2),
 * 실패/성공 분류는 `examplesFormState`(./flow.ts), 요청 조립은
 * `createExampleRequest`·`updateExampleRequest`·`deleteExampleRequest`(./write.ts).
 * 이 파일은 그것들을 기계적으로 잇기만 한다 - `app/(auth)/actions.ts` 가
 * `lib/auth/flow.ts` 를 잇기만 하는 것과 같은 이유다(이 파일도 headers()·
 * `requireSession()` 안의 `cookies()`·redirect() 가 요청 스코프를 요구해
 * 단위 테스트 계층에서 부를 수 없다 - 그 저장소의 관례를 그대로 따른다).
 *
 * **이 파일에는 `'use server'` 가 있다 - 그래서 순수 함수를 여기 두지
 * 않는다.** Next 는 그 지시어가 있는 파일의 모든 export 를 Server Action
 * 참조로 다루고, Server Action 은 반드시 async 함수여야 한다(실측: 동기
 * 함수를 여기 export 하면 `next build` 가 "Server Actions must be async
 * functions" 로 죽는다) - 요청 조립을 `./write.ts`(지시어 없음)로 뺀 이유가
 * 그것이다. `components/grid/format.ts` 가 반대 방향(`'use client'`)에서
 * 겪은 것과 같은 종류의 RSC 경계다.
 *
 * **PATCH 로 수정한다, PUT 이 아니다.** 실측(route_registrar.py,
 * 2026-09-12): `PUT /api/v1/examples/{id}` 는 `enable_upsert = True` 인
 * 업서트라 존재하지 않는 id 에 201 로 새 자원을 만들 수 있다 - 편집 폼이
 * 부를 요청이 아니다.
 *
 * **네 Action 모두 `requireSession()`(lib/auth/guard.ts)을 먼저 부르고
 * `accessToken` 을 `./write.ts` 의 조립 함수에 넘긴다.** 실측(Task 13, 실제
 * 백엔드 상대 E2E): 이 호출이 없으면 네 Action 전부가 Authorization 헤더
 * 없이 나가 백엔드가 401 `AUTHENTICATION_REQUIRED` 로 거절한다 - mock 을
 * 상대로는 이 누락이 전혀 드러나지 않았다. `guard.ts` 의 `requireSession()`
 * 은 정확히 이 용도로 설계돼 있었다("호출자(쓰기 Action)가
 * session.accessToken 을 request({accessToken})에 실어야 한다" - 그 파일
 * 주석) - 그 배선이 이 파일에 빠져 있었을 뿐이다.
 *
 * **읽기 경로(목록·상세·선택 목록)에는 이 토큰을 넣지 않는다 - 그것도
 * 계약이다.** 세 백엔드 전부 읽기는 공개, 쓰기만 인증을 요구한다(실측:
 * fastapi 의 `route_registrar.py` 가 `read_dependencies`/`write_dependencies`
 * 를 나누고 `ExamplesController` 는 후자만 채운다, nestjs 의
 * `examples.controller.ts` 가 `writeGuards` 를 index/show/관계 GET 에는
 * 적용하지 않는다고 스스로 주석에 남긴다, rails 의 `examples_controller.rb`
 * 가 `before_action :authenticate_active_user!, only: PROTECTED_WRITE_ACTIONS`
 * 로 좁힌다) - 그래서 읽기 화면에 토큰을 더하는 것은 고치는 것이 아니라
 * 이 계약을 깨는 것이다.
 *
 * "이 Action 이 실제로 토큰을 싣는가"라는, mock 으로는 결코 드러나지 않았던
 * 자리는 `./write.ts` 의 조립 함수를 통해 이제 단위
 * (`test/unit/examples/actions.test.ts`)가 직접 잰다.
 */

/** 성공하면 만들어진 자원의 상세로 보낸다(스펙 표) - 실측: `POST /api/v1/examples` -> 201. */
export async function createExampleAction(
  _previous: ExamplesFormState,
  formData: FormData,
): Promise<ExamplesFormState> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...createExampleRequest(formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) return examplesFormState(result.errors)
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된
  // 함정 - JsonApiResult<T> 는 판별자가 섞여 있어 status 비교로는 멤버를
  // 배제하지 못한다).
  if (result.document === null) {
    throw new Error('생성 응답에 본문이 없습니다.')
  }
  if (result.document.data === null) {
    throw new Error('생성 응답에 자원이 없습니다.')
  }
  redirect(`/examples/${result.document.data.id}`)
}

/** 성공하면 상세를 갱신한다(스펙 표) - 실측: `PATCH /api/v1/examples/{id}` -> 200. */
export async function updateExampleAction(
  id: string,
  _previous: ExamplesFormState,
  formData: FormData,
): Promise<ExamplesFormState> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...updateExampleRequest(id, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) return examplesFormState(result.errors)
  redirect(`/examples/${id}`)
}

/**
 * 성공하면 목록으로 보낸다(스펙 표) - 실측: `DELETE /api/v1/examples/{id}`
 * -> 204, 본문 없음. 실패는 폼 필드가 없는 동작이라 examplesFormState 로
 * 받지 않고 던진다 - `app/error.tsx`가 받는다(읽기 경로와 같은 선택,
 * lib/jsonapi/client.ts 의 request() 문서화된 선택지).
 */
export async function deleteExampleAction(id: string): Promise<void> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteExampleRequest(id, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    throw new Error(result.errors[0]?.detail ?? '삭제하지 못했습니다.')
  }
  redirect('/examples')
}

/**
 * 일괄 삭제의 건별 실행 - `components/grid/resource-grid.tsx` 가 이 함수 자체를
 * `runBulk`(lib/bulk/executor.ts)의 `run` 콜백으로 넘긴다. 그리드는 화면이고
 * 클라이언트 컴포넌트라, 이 함수는 이 파일의 다른 Action 과 달리 `<form
 * action>` 이 아니라 클라이언트 쪽 반복문에서 `id` 하나마다 직접 호출된다 -
 * Next 는 Server Action 을 그렇게 호출하는 것을 그대로 지원한다. 건마다 왕복
 * 하나씩이라 `runBulk` 의 `onProgress` 가 실제로 갱신되고, 취소 신호가 다음
 * 요청을 실제로 막을 수 있다.
 *
 * `deleteExampleAction` 과 달리 실패해도 던지지 않는다 - 부분 실패가 이
 * 실행의 정상 경로라(lib/bulk/AGENTS.md), 한 건의 실패로 나머지 실행을
 * 막으면 안 된다. 성공·실패 모두 `BulkOutcome` 하나로 돌려주고, 판단(재시도
 * 가능 여부)은 화면(`components/grid/bulk-result.tsx`)이 한다.
 *
 * 두 함정을 여기서 피한다(둘 다 실측됨) -
 * 1. 성공한 삭제는 204·본문 없음이다. `result.status === 204` 로는
 *    `JsonApiResult` 의 판별자가 섞여 있어 좁혀지지 않는다(client.ts 의
 *    문서화된 함정) - `ok` 로만 좁힌다. 문서를 읽을 일이 없으니 그걸로 충분하다.
 * 2. `errors` 배열은 그대로 넘긴다 - `status`·`detail` 만 뽑아 새 객체로
 *    옮기면 `code` 가 사라지고, `exactOptionalPropertyTypes` 아래서는
 *    `{ status: error.status }` 조차 컴파일되지 않는다(`string | undefined`
 *    를 `status?: string` 에 넣으려 해서다).
 */
export async function bulkDeleteExampleAction(id: string): Promise<BulkOutcome> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteExampleRequest(id, session.accessToken, acceptLanguage),
  )

  if (result.ok) return { id, ok: true }
  return { id, ok: false, errors: result.errors }
}
