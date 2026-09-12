import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import { resourceByType } from '@/lib/resources'
import {
  CATEGORY_FIELD,
  DESCRIPTION_FIELD,
  SCORE_FIELD,
  STATUS_FIELD,
  TAGS_FIELD,
  TITLE_FIELD,
} from './form-state'

/**
 * `examples` 쓰기 요청의 조립 - `actions.ts` 의 Server Action 이 아니라 여기
 * 두는 이유는 `'use server'` 자체다.
 *
 * `actions.ts` 는 파일 맨 위에 `'use server'` 를 선언하고, Next 는 그 지시어가
 * 있는 파일의 **모든 export** 를 Server Action 참조로 다룬다 - 그리고 Server
 * Action 은 반드시 async 함수여야 한다("Server Actions must be async
 * functions", 실측: 이 함수들을 `actions.ts` 안에 동기 함수로 그대로 두면
 * `next build` 가 그 자리에서 죽는다). 이 파일의 함수들은 순수 계산(문자열
 * 정리·JSON:API 문서 조립)이라 애초에 async 일 이유가 없다 - 그래서
 * `'use server'` 가 없는 별도 모듈로 뺐다. `../list.ts` 의 `listRequest` ·
 * `./detail.ts` 의 `detailRequest` 와 같은 이유이자, `components/grid/format.ts`
 * 가 반대 방향(`'use client'`)에서 겪은 것과 같은 종류의 RSC 경계다.
 *
 * `accessToken`·`acceptLanguage` 를 이미 구해진 값으로 인자로 받는다 -
 * `headers()`·`cookies()` 를 이 파일이 알면 다시 요청 스코프에 묶여 단위
 * 테스트가 못 부른다. 그 값을 구하는 것은 `actions.ts` 의 Action 들이다.
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

/**
 * `createExampleAction` 의 조립 - 경로·본문·토큰·언어를 한 곳에서 만든다.
 * `accessToken`이 실제로 `options.accessToken`에 실리는지가 이 함수 하나로
 * 고정된다(단위 테스트) - `RequestOptions.accessToken`이 선택 필드라 그냥
 * 빠뜨려도 타입 검사를 통과한다는 것이 애초에 이 자리가 무가드였던 이유다.
 */
export function createExampleRequest(
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    EXAMPLES.path,
    withAcceptLanguage({ method: 'POST', body: writeBody(formData), accessToken }, acceptLanguage),
  ]
}

/** `updateExampleAction` 의 조립 - `createExampleRequest` 와 같은 이유로 뺐다. */
export function updateExampleRequest(
  id: string,
  formData: FormData,
  accessToken: string,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  return [
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage(
      { method: 'PATCH', body: writeBody(formData, id), accessToken },
      acceptLanguage,
    ),
  ]
}

/**
 * `deleteExampleAction`·`bulkDeleteExampleAction` 이 공유하는 조립 - 둘 다
 * `DELETE /api/v1/examples/{id}` 하나뿐이고 갈리는 것은 **결과를 다루는
 * 방식**(단건은 던지고 리다이렉트, 일괄은 `BulkOutcome` 으로 접는다)이지
 * 요청 모양이 아니다.
 *
 * `signal` 은 선택이고, 있으면 그대로 `RequestOptions.signal` 에 실어
 * `request()` 에 넘긴다(`exactOptionalPropertyTypes` 때문에 없으면 키
 * 자체를 뺀다 - `withAcceptLanguage` 와 같은 관례). 호출부(`actions.ts`)가
 * 이 신호를 무엇으로 채우는지는 이 함수가 모른다 - 그 판단과 근거는
 * `actions.ts` 에 있다(요약: 브라우저의 취소 버튼이 쥔 `AbortController`
 * 는 Server Action 인자로 건널 수 없어, 서버 쪽에서 새로 만든 타임아웃을
 * 쓴다).
 */
export function deleteExampleRequest(
  id: string,
  accessToken: string,
  acceptLanguage: string | null,
  signal?: AbortSignal,
): [path: string, options: RequestOptions] {
  return [
    `${EXAMPLES.path}/${id}`,
    withAcceptLanguage(
      { method: 'DELETE', accessToken, ...(signal !== undefined ? { signal } : {}) },
      acceptLanguage,
    ),
  ]
}
