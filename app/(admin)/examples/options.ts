import { optionsFromDocument, type OptionItem } from '@/lib/form/options'
import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { resourceByType, type ResourceDef } from '@/lib/resources'

/**
 * 생성·수정 폼의 관계 선택 목록을 조회하는 요청 - `count.ts`·`health.ts`
 * 와 같은 이유로 화면 옆에 둔다(lib/resources/ 는 어떤 내부 모듈도 import
 * 하지 않는 순수 선언 계층이다, lib/resources/AGENTS.md). 문서 → 항목 변환
 * (`optionsFromDocument`)은 `lib/form/options.ts` 에 있다 - 그것은 순수
 * 변환이라 요청 조립과 층이 다르다.
 *
 * `listRequest`(../list.ts)를 재사용하지 않는다 - 이유는 include 다. 실측
 * (2026-09-12): `exampleCategories`·`exampleTags` 는 `includes` 허용 목록이
 * **빈 집합**이라(역참조가 순환을 만들어서 의도적으로 비웠다) include 를
 * 실으면 거절된다. 오늘은 두 자원의 `resource.includes` 가 실제로 비어
 * 있어 `listRequest` 를 그대로 써도 결과가 같지만, 그건 우연이다 - 훗날 두
 * 자원에 include 가 추가되면 `listRequest` 는 그 즉시 include 를 실어 이
 * 목록 조회가 거절되기 시작한다. 이 함수는 애초에 include 를 만들 수 있는
 * 경로 자체를 두지 않아 그 회귀에서 안전하다(`countRequest` 가 카드 용도로
 * include 를 아예 안 싣는 것과 같은 판단).
 *
 * `page[size]=100` 만 고정으로 싣는다 - 선택 목록은 필터·정렬·커서 없이
 * "가능한 한 많이" 받으면 되는 용도라 `listRequest`처럼 그리드 상태 전체를
 * 조립할 이유가 없다. `page[totals]` 는 싣지 않는다 - 이 함수의 소비자는
 * 총합을 읽지 않는다(countRequest 와 반대 지점 - 그쪽은 총합만 필요하다).
 */
export function optionsRequest(
  resource: ResourceDef,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const query = new URLSearchParams({ 'page[size]': '100' })
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/**
 * `optionsRequest` 의 결과를 문서로 좁힌다.
 *
 * **호출부가 `!result.ok` 를 먼저 걸렀다고 가정한다.** 예전에는 이 함수
 * 자신이 `result.errors[0]?.detail` 을 메시지에 실어 던졌다 - 그러면
 * `app/error.tsx` 가 그 detail(백엔드가 실제로 준 설명)을 버리고 고정 문구
 * "백엔드에 연결할 수 없습니다"를 보여준다(검증 오류·500 같은, 백엔드가
 * 실제로 응답한 경우에도 "연결할 수 없다"는 거짓 진단이 된다). 지금은
 * 호출부가 `messageForReadFailure`(../read-result.ts)로 먼저 갈라 transport 만
 * 던지고(그 경우에만 저 고정 문구가 참이다) 그 외는 배너로 그 자리에서
 * 보여준다 - 이 함수에 `!result.ok` 인 값이 넘어오는 것은 그 자체로 호출부의
 * 버그다.
 */
export function unwrapOptionsResult(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error(
      '내부 오류: 실패한 결과가 unwrapOptionsResult 에 도달했습니다(호출부가 먼저 걸렀어야 한다).',
    )
  }
  if (result.document === null) {
    throw new Error('선택 목록 응답에 본문이 없습니다.')
  }
  return result.document
}

/** 관계 하나의 보기 목록 요청 계획 - 관계 키, 대상 자원, 그 자원의 `optionsRequest` 튜플. */
export interface OptionRequestPlan {
  readonly key: string
  readonly target: ResourceDef
  readonly request: [path: string, options: RequestOptions]
}

/**
 * 자원의 관계마다 대상 자원의 보기 목록 요청을 만든다 - 선언 순서대로.
 * 화면은 이 계획들을 `Promise.all` 로 함께 보내고 `optionsByRelationship`
 * 으로 접는다. 대상 자원이 `RESOURCES` 에 없으면 던진다 - 불변식 테스트가
 * 그 선언을 막지만, 이 자리가 조용히 빈 목록을 그리는 것보다 던지는 것이
 * 낫다(관계 선택기가 비어 있으면 운영자는 그 관계를 걸 수 없다).
 */
export function relationshipOptionRequests(
  resource: ResourceDef,
  acceptLanguage: string | null,
): readonly OptionRequestPlan[] {
  return Object.entries(resource.relationships).map(([key, relationship]) => {
    const target = resourceByType(relationship.type)
    if (target === undefined) {
      throw new Error(`관계 ${key} 의 대상 자원 ${relationship.type} 이 선언에 없습니다.`)
    }
    return { key, target, request: optionsRequest(target, acceptLanguage) }
  })
}

export type OptionsOutcome =
  | { readonly ok: true; readonly options: Readonly<Record<string, readonly OptionItem[]>> }
  | { readonly ok: false; readonly errors: readonly ErrorObject[] }

/**
 * 계획들과 그 결과를 관계 키별 보기 목록으로 접는다. 하나라도 실패하면 그
 * 오류를 돌려주고 화면이 배너로 바꾼다 - 폼을 반쪽으로 그리지 않는다
 * (보기 없이 만들면 관계가 조용히 빠진다). 204 는 `unwrapOptionsResult` 가
 * 던진다.
 */
export function optionsByRelationship(
  plans: readonly OptionRequestPlan[],
  results: readonly JsonApiResult<CollectionDocument>[],
): OptionsOutcome {
  if (plans.length !== results.length) {
    throw new Error('내부 오류: 요청 계획과 결과의 수가 다릅니다.')
  }
  const options: Record<string, readonly OptionItem[]> = {}
  for (const [position, plan] of plans.entries()) {
    const result = results[position]
    if (result === undefined) throw new Error('내부 오류: 요청 계획과 결과의 수가 다릅니다.')
    if (!result.ok) return { ok: false, errors: result.errors }
    options[plan.key] = optionsFromDocument(plan.target, unwrapOptionsResult(result))
  }
  return { ok: true, options }
}
