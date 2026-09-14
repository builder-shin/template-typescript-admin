'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { BulkOutcome } from '@/lib/bulk/executor'
import { LOGIN_PATH, requireSession } from '@/lib/auth/guard'
import { clearSession } from '@/lib/auth/session'
import { resourceFormState } from '@/lib/form/flow'
import type { ResourceFormState } from '@/lib/form/form-state'
import { request } from '@/lib/jsonapi/client'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { bucketForFailure, isAlreadyGone } from './bulk-outcome'
import { writableResource } from './resource'
import { createRequest, deleteRequest, updateRequest } from './write'

/**
 * 선언된 어느 자원에든 쓰는 생성·수정·삭제 Server Action 넷. 어느 자원인지는
 * 첫 인자 `slug` 가 정한다 - 화면이 `action.bind(null, resource.slug)`(생성) ·
 * `.bind(null, resource.slug, id)`(수정·삭제)로 넘기고, bind 된 인자는
 * 문자열이라 직렬화에 문제가 없다(스펙 7.4) - 실측(2026-09-14):
 * `test/e2e/examples.spec.ts` 의 생성 시나리오가
 * `createResourceAction.bind(null, 'examples')` 를 `useActionState` 로 제출해
 * 생성이 성공하고 상세로 넘어갔다. 그 시나리오는 상태 코드를 보지 않는다 -
 * 성공과 실패를 가르는 것은 이 파일의 `result.ok` 검사이고,
 * `resourceFormState`(lib/form/flow.ts)는 실패의 `errors` 만 폼 상태로 바꿀
 * 뿐이다. 상태 코드는 따로 쟀다: 같은 모양의 문서를 백엔드에 직접 POST
 * 했을 때 응답이 201 이었다(2026-09-14, 정본 FastAPI 상대 curl). 넷 다 첫 줄이
 * `writableResource(slug)` 다(./resource.ts) - 선언에 없거나 읽기 전용이면
 * 던진다. 화면이 그 경로를 제공하지 않으므로 사용자 문구는 두지 않는다.
 *
 * 판단은 이미 다른 파일에 있다 - 필드 배치는 `lib/jsonapi/errors.ts`,
 * 실패/성공 분류는 `resourceFormState`(lib/form/flow.ts), 요청 조립은
 * `createRequest`·`updateRequest`·`deleteRequest`(./write.ts), 본문은
 * `lib/form/write.ts` 의 `writeDocument`. 이 파일은 그것들을 기계적으로
 * 잇기만 한다 - `app/(auth)/actions.ts` 가 `lib/auth/flow.ts` 를 잇기만 하는
 * 것과 같은 이유다(이 파일도 headers()·`requireSession()` 안의 `cookies()`·
 * redirect() 가 요청 스코프를 요구해 단위 테스트 계층에서 부를 수 없다 -
 * 그 저장소의 관례를 그대로 따른다).
 *
 * **이 파일에는 `'use server'` 가 있다 - 그래서 순수 함수를 여기 두지
 * 않는다.** Next 는 그 지시어가 있는 파일의 모든 export 를 Server Action
 * 참조로 다루고, Server Action 은 반드시 async 함수여야 한다(실측: 동기
 * 함수를 여기 export 하면 `next build` 가 "Server Actions must be async
 * functions" 로 죽는다) - 요청 조립을 `./write.ts`, slug 판정을
 * `./resource.ts`(둘 다 지시어 없음)로 뺀 이유가 그것이다.
 *
 * **PATCH 로 수정한다, PUT 이 아니다.** 실측(route_registrar.py,
 * 2026-09-12): `PUT /api/v1/examples/{id}` 는 `enable_upsert = True` 인
 * 업서트라 존재하지 않는 id 에 201 로 새 자원을 만들 수 있다 - 편집 폼이
 * 부를 요청이 아니다.
 *
 * **네 Action 모두 `requireSession()`(lib/auth/guard.ts)을 먼저 부르고
 * `accessToken` 을 `./write.ts` 의 조립 함수에 넘긴다.** 실측(실제 백엔드
 * 상대 E2E): 이 호출이 없으면 네 Action 전부가 Authorization 헤더 없이 나가
 * 백엔드가 401 `AUTHENTICATION_REQUIRED` 로 거절한다 - mock 을 상대로는 이
 * 누락이 전혀 드러나지 않았다. **읽기 경로(목록·상세·선택 목록)에는 이
 * 토큰을 넣지 않는다 - 그것도 계약이다.** 세 백엔드 전부 읽기는 공개, 쓰기만
 * 인증을 요구한다(실측: fastapi 의 `route_registrar.py` 가 `read_dependencies`/
 * `write_dependencies` 를 나누고 `ExamplesController` 는 후자만 채운다,
 * nestjs 의 `examples.controller.ts` 가 `writeGuards` 를 index/show/관계
 * GET 에는 적용하지 않는다고 스스로 주석에 남긴다, rails 의
 * `examples_controller.rb` 가 `before_action :authenticate_active_user!, only:
 * PROTECTED_WRITE_ACTIONS` 로 좁힌다). "이 Action 이 실제로 토큰을 싣는가"는
 * `./write.ts` 의 조립 함수를 통해 단위(`test/unit/slug/write.test.ts`)가
 * 직접 잰다.
 *
 * ## 세 단건 Action 은 `destroySession` 을 여기서 직접 다룬다
 *
 * proxy.ts 의 회전은 "요청당 정확히 한 번"만 보장한다(그 파일 "알려진
 * 한계" 절) - 같은 만료 임박 쿠키를 실은 서로 다른 요청 여럿(다중 탭, 링크
 * prefetch)이 거의 동시에 오면 하나만 회전에 성공하고 나머지는 이미 소비된
 * refresh 토큰을 내밀어 세션이 죽는다(실측: 5 동시 요청 중 1 생존 · 4
 * TOKEN_REVOKED). 그 넷의 쿠키는 여전히 멀쩡해 보이고 `decideRotation` 은
 * `pass` 를 고르므로, 그 사용자는 로그인 상태 그대로 다음 쓰기를 시도하다가
 * 매번 401 `TOKEN_REVOKED` 를 받는다 - access 쿠키의 남은 수명 동안.
 * `guard.ts`·proxy.ts 의 갈래들은 "이 401 은 `errors.ts` 의 destroySession
 * 액션이 다룬다"고 적어 두고 자신은 만료를 판정하지 않는다 - 그 액션을
 * 실제로 실행하는 자리가 `redirectToLoginOnSessionDeath` 다.
 *
 * `bulkDeleteResourceAction` 에는 쓰지 않는다 - 그 Action 의 실패는
 * `components/grid/bulk-result.tsx` 가 이미 `sessionLost` 버킷(재시도 버튼
 * 숨김 + "다시 로그인" 링크)으로 온전히 다루고, 결과 표 렌더링 도중에
 * 리다이렉트를 던지면 그 표 자체가(아직 확인 못 한 나머지 건의 결과와 함께)
 * 통째로 사라진다.
 *
 * `clearSession()` 을 여기서 부르는 것은 안전하다 - 이 파일 전체가 Server
 * Action 이라 `next/headers` 의 쓰기 제약(session.ts 파일 상단 "⚠️" 절)에
 * 걸리지 않는다.
 *
 * **단위 테스트가 없다.** `cookies()`/`redirect()` 가 요청 스코프를 요구해
 * 단위 계층에서 부를 수 없다 - 실제로 리다이렉트가 일어나는지는 E2E 의
 * 몫이다.
 */

/**
 * `errors` 가 세션이 죽어서 난 것이면 쿠키를 지우고 로그인으로 보낸다 -
 * 아니면 아무것도 하지 않고 그대로 돌아간다(호출자가 이어서 자기 방식대로
 * 실패를 그린다). `redirect()` 는 반환하지 않지만(타입이 `never`), 세션이
 * 죽지 않은 흔한 경우(필드 오류·배너 등)에는 그냥 돌아와야 하므로 함수
 * 전체의 반환 타입은 `never` 가 아니라 `Promise<void>` 다.
 */
async function redirectToLoginOnSessionDeath(errors: readonly ErrorObject[]): Promise<void> {
  if (actionForErrors(errors) !== 'destroySession') return
  await clearSession()
  redirect(LOGIN_PATH)
}

/**
 * 삭제 요청(단건·일괄 공통)의 타임아웃(ms).
 *
 * **여기서 만든 신호는 브라우저의 취소 버튼이 아니다 - 만들 수가 없다.**
 * `resource-grid.tsx` 의 일괄 삭제 취소 버튼은 `AbortController` 를 쥐고
 * `runBulk`(lib/bulk/executor.ts)에 그 `signal` 을 넘기지만, `runBulk` 는 그
 * 신호를 **다음 요청을 내기 전에만** 확인한다 - 이미 나가 있는
 * `bulkDeleteResourceAction` 호출 하나는 끝까지 기다린다(의도적: 이미 보낸
 * 요청은 되돌리지 않는다). 그 신호를 이 Server Action 안까지 실어 쓰고
 * 싶어질 수 있는데, 불가능하다 - React 의 Server Function 인자 직렬화
 * (react-server-dom 의 `processReply`, 실측: `FormData`·`Map`·`Set`·`Blob`·
 * `Date` 만 특수 처리되고 그 밖의 클래스 인스턴스는 "Only plain objects, and
 * a few built-ins, can be passed to Server Functions"로 **그 자리에서
 * 던진다**)는 `AbortSignal` 을 인자로 받지 않는다.
 *
 * 그래서 이 타임아웃은 이 함수 **안에서** 매 호출마다 새로 만든다(rotation.ts
 * 의 `ROTATION_FETCH_TIMEOUT_MS` 와 같은 기법) - 백엔드가 응답을 거절하는
 * 게 아니라 그냥 멈추면(잠금 대기 등) `await run(id)`(executor.ts)가 영원히
 * 끝나지 않아 취소 버튼이 아무 일도 하지 않는 것처럼 보인다 - 이 타임아웃은
 * 그 한도를 유한하게 만든다.
 */
const DELETE_FETCH_TIMEOUT_MS = 10_000

/** 성공하면 만들어진 자원의 상세로 보낸다(스펙 7.4) - 실측: `POST /api/v1/examples` -> 201. */
export async function createResourceAction(
  slug: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...createRequest(resource, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된
  // 함정 - JsonApiResult<T> 는 판별자가 섞여 있어 status 비교로는 멤버를
  // 배제하지 못한다).
  if (result.document === null) {
    throw new Error('생성 응답에 본문이 없습니다.')
  }
  if (result.document.data === null) {
    throw new Error('생성 응답에 자원이 없습니다.')
  }
  redirect(`/${resource.slug}/${result.document.data.id}`)
}

/** 성공하면 상세를 갱신한다(스펙 7.4) - 실측: `PATCH /api/v1/examples/{id}` -> 200. */
export async function updateResourceAction(
  slug: string,
  id: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...updateRequest(resource, id, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  redirect(`/${resource.slug}/${id}`)
}

/**
 * 성공하면 목록으로 보낸다(스펙 7.4) - 실측: `DELETE /api/v1/examples/{id}`
 * -> 204, 본문 없음. 실패는 폼 필드가 없는 동작이라 resourceFormState 로
 * 받지 않고 던진다 - `app/error.tsx`가 받는다.
 *
 * **404 는 이 "실패" 에서 뺀다 - 성공으로 다룬다.** `isAlreadyGone`
 * (./bulk-outcome.ts)이 그 행은 이미 없다고 답하면 운영자가 지우려던 의도는
 * 이미 달성됐다. 다시 지워도 영원히 같은 404 뿐이고, "실패했다"고 던지면
 * 백엔드가 실제로 응답했고 행도 실제로 없는데 `error.tsx` 는 "백엔드에
 * 연결할 수 없습니다"를 보여준다.
 */
export async function deleteResourceAction(slug: string, id: string): Promise<void> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      resource,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    if (!isAlreadyGone(result.errors)) {
      throw new Error(result.errors[0]?.detail ?? '삭제하지 못했습니다.')
    }
  }
  redirect(`/${resource.slug}`)
}

/**
 * 일괄 삭제의 건별 실행 - `components/grid/resource-grid.tsx` 가 이 함수를
 * (slug 를 bind 한 채로) `runBulk`(lib/bulk/executor.ts)의 `run` 콜백으로
 * 넘긴다. 그리드는 클라이언트 컴포넌트라 이 함수는 `<form action>` 이
 * 아니라 클라이언트 쪽 반복문에서 `id` 하나마다 직접 호출된다 - Next 는
 * Server Action 을 그렇게 호출하는 것을 그대로 지원한다. 건마다 왕복
 * 하나씩이라 `runBulk` 의 `onProgress` 가 실제로 갱신되고, 취소 신호가
 * 다음 요청을 실제로 막을 수 있다.
 *
 * `deleteResourceAction` 과 달리 실패해도 던지지 않는다 - 부분 실패가 이
 * 실행의 정상 경로라(lib/bulk/AGENTS.md), 한 건의 실패로 나머지 실행을
 * 막으면 안 된다. 성공·실패 모두 `BulkOutcome` 하나로 돌려주고, 화면은
 * 그것을 그리기만 한다 - 판단(어느 통인가)은 `bucketForFailure`
 * (./bulk-outcome.ts)로 여기서 끝내 둔다. **`bucket` 을 여기서 채우는 이유**:
 * `actionForErrors` 는 `lib/jsonapi/errors` → `client.ts` →
 * `lib/config/settings.ts` 로 이어지는 값 import 다 - 이 판정이 결과 화면
 * (`'use client'`)에 있으면 그 사슬이 클라이언트 번들의 그래프에 들어온다.
 *
 * 두 함정을 여기서 피한다(둘 다 실측됨) - 성공한 삭제는 204·본문 없음이라
 * `ok` 로만 좁힌다(`status === 204` 로는 판별자가 섞여 좁혀지지 않는다).
 * `errors` 배열은 그대로 넘긴다 - `status`·`detail` 만 뽑아 새 객체로 옮기면
 * `code` 가 사라지고, `exactOptionalPropertyTypes` 아래서는 `{ status:
 * error.status }` 조차 컴파일되지 않는다.
 */
export async function bulkDeleteResourceAction(slug: string, id: string): Promise<BulkOutcome> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      resource,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (result.ok) return { id, ok: true, bucket: 'ok' }
  return { id, ok: false, errors: result.errors, bucket: bucketForFailure(result.errors) }
}
