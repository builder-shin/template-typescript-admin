'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { request, withAcceptLanguage } from '@/lib/jsonapi/client'
import type { SingleDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  SCORE_FIELD,
  STATUS_FIELD,
  TAGS_FIELD,
  TITLE_FIELD,
  examplesFormState,
  type ExamplesFormState,
} from './form-state'

/**
 * `examples` 의 생성·수정·삭제 Server Action.
 *
 * 판단은 두 파일에 이미 있다 - 필드 배치는 `lib/jsonapi/errors.ts`(Task 2),
 * 실패/성공 분류는 `examplesFormState`(./form-state.ts). 이 파일은 그 둘을
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
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    EXAMPLES.path,
    withAcceptLanguage({ method: 'POST', body: writeBody(formData) }, acceptLanguage),
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
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage({ method: 'PATCH', body: writeBody(formData, id) }, acceptLanguage),
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
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage({ method: 'DELETE' }, acceptLanguage),
  )

  if (!result.ok) {
    throw new Error(result.errors[0]?.detail ?? '삭제하지 못했습니다.')
  }
  redirect('/examples')
}
