'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { BulkOutcome } from '@/lib/bulk/executor'
import { requireSession } from '@/lib/auth/guard'
import { request, withAcceptLanguage } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { examplesFormState } from './flow'
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  SCORE_FIELD,
  STATUS_FIELD,
  TAGS_FIELD,
  TITLE_FIELD,
  type ExamplesFormState,
} from './form-state'

/**
 * `examples` 의 생성·수정·삭제 Server Action.
 *
 * 판단은 두 파일에 이미 있다 - 필드 배치는 `lib/jsonapi/errors.ts`(Task 2),
 * 실패/성공 분류는 `examplesFormState`(./flow.ts). 이 파일은 그 둘을
 * 기계적으로 잇기만 한다 - `app/(auth)/actions.ts` 가 `lib/auth/flow.ts` 를
 * 잇기만 하는 것과 같은 이유다(이 파일도 headers()·redirect() 가 요청
 * 스코프를 요구해 단위 테스트 계층에서 부를 수 없다 - 그 저장소의 관례를
 * 그대로 따른다).
 *
 * **PATCH 로 수정한다, PUT 이 아니다.** 실측(route_registrar.py,
 * 2026-09-12): `PUT /api/v1/examples/{id}` 는 `enable_upsert = True` 인
 * 업서트라 존재하지 않는 id 에 201 로 새 자원을 만들 수 있다 - 편집 폼이
 * 부를 요청이 아니다.
 *
 * 쓰기 문서의 `id` 는 스프레드로 있고 없고를 가른다(`writeBody` 참고) -
 * `RequestOptions.body` 는 `unknown` 이라 이 파일 안에서는
 * exactOptionalPropertyTypes 함정이 실제로 발동하지 않지만, JSON:API 의
 * 계약 자체가 생성 요청에는 `id` 를 아예 싣지 말라는 것이라(이 저장소는
 * 클라이언트가 id 를 고르지 않는다) 스프레드로 키를 통째로 뺀다.
 *
 * **네 Action 모두 `requireSession()`(lib/auth/guard.ts)을 먼저 부르고
 * `accessToken` 을 `request()` 에 싣는다.** 실측(Task 13, 실제 백엔드
 * 상대 E2E): 이 호출이 없으면 네 Action 전부가 Authorization 헤더 없이
 * 나가 백엔드가 401 `AUTHENTICATION_REQUIRED` 로 거절한다 - mock 을 상대로
 * 는 이 누락이 전혀 드러나지 않았다. `guard.ts` 의 `requireSession()` 은
 * 정확히 이 용도로 설계돼 있었다("호출자(쓰기 Action)가
 * session.accessToken 을 request({accessToken})에 실어야 한다" - 그 파일
 * 주석) - 그 배선이 이 파일에 빠져 있었을 뿐이다.
 */

const EXAMPLES = resourceByType('examples')!
const CATEGORIES = resourceByType('exampleCategories')!
const TAGS = resourceByType('exampleTags')!

/** FormData 는 텍스트 입력을 항상 문자열로 준다 - 없으면 빈 문자열이다. */
function textOf(formData: FormData, name: string): string {
  const raw = formData.get(name)
  return typeof raw === 'string' ? raw : ''
}

/** 빈 입력은 "값 없음"이다 - `description` 은 nullable 속성이라 null 로 보낸다. */
function nullableTextOf(formData: FormData, name: string): string | null {
  const value = textOf(formData, name).trim()
  return value === '' ? null : value
}

interface WriteRelationshipData {
  type: string
  id: string
}

/** `''`(edit-form.tsx 의 "분류 없음" 항목)는 관계를 비운다는 뜻이다. */
function categoryRelationship(formData: FormData): { data: WriteRelationshipData | null } {
  const id = textOf(formData, CATEGORY_FIELD)
  return { data: id === '' ? null : { type: CATEGORIES.type, id } }
}

/** 같은 name 의 체크박스가 여럿 체크되면 FormData.getAll 이 값을 전부 돌려준다. */
function tagsRelationship(formData: FormData): { data: WriteRelationshipData[] } {
  return {
    data: formData
      .getAll(TAGS_FIELD)
      .filter((value): value is string => typeof value === 'string')
      .map((id) => ({ type: TAGS.type, id })),
  }
}

function writeBody(formData: FormData, id?: string) {
  return {
    data: {
      type: EXAMPLES.type,
      ...(id !== undefined ? { id } : {}),
      attributes: {
        title: textOf(formData, TITLE_FIELD),
        description: nullableTextOf(formData, DESCRIPTION_FIELD),
        status: textOf(formData, STATUS_FIELD),
        score: Number(textOf(formData, SCORE_FIELD)),
      },
      relationships: {
        category: categoryRelationship(formData),
        tags: tagsRelationship(formData),
      },
    },
  }
}

/** 성공하면 만들어진 자원의 상세로 보낸다(스펙 표) - 실측: `POST /api/v1/examples` -> 201. */
export async function createExampleAction(
  _previous: ExamplesFormState,
  formData: FormData,
): Promise<ExamplesFormState> {
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    EXAMPLES.path,
    withAcceptLanguage(
      { method: 'POST', body: writeBody(formData), accessToken: session.accessToken },
      acceptLanguage,
    ),
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
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage(
      { method: 'PATCH', body: writeBody(formData, id), accessToken: session.accessToken },
      acceptLanguage,
    ),
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
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage({ method: 'DELETE', accessToken: session.accessToken }, acceptLanguage),
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
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage({ method: 'DELETE', accessToken: session.accessToken }, acceptLanguage),
  )

  if (result.ok) return { id, ok: true }
  return { id, ok: false, errors: result.errors }
}
