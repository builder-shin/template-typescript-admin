import type { ResourceDef } from '@/lib/resources'
import type { GridState } from './state'

/**
 * 그리드 상태를 JSON:API 쿼리 파라미터로 조립한다.
 *
 * 이 파일도 자원 이름을 모른다 - 어떤 필터를 어떤 연산자로 보낼지는 전부
 * `ResourceDef.filters` 의 `uiOperator` 가 정한다. `readGridState` 가 이미
 * 선언에 없는 키를 걸러 둔 `GridState` 를 건네주므로, 여기서는 그 상태를
 * JSON:API 가 읽는 이름으로 옮기기만 한다.
 *
 * 선언에 없는 필터 키를 버리는 것(state.ts)은 스타일이 아니라 정확성이다.
 * 백엔드는 `filter`·`sort`·`include`·`page` 네 접두사로 시작하는 파라미터만
 * 인식하고 나머지는 400 INVALID_QUERY_PARAMETER 로 거절한다(실측
 * app/jsonapi/query.py:152,167) - 낯선 파라미터가 하나만 섞여도 목록이 비는
 * 게 아니라 실패한다.
 *
 * `include` 는 항상 싣는다. `ResourceDef.includes` 는 "무엇을 include 할 수
 * 있는가"이지 "무엇을 요청하는가"가 아니라서, 빼먹으면 백엔드마다 다르게
 * 실패한다 - 어떤 백엔드는 linkage 만 주고 이름은 `included` 에만 있어 배지가
 * UUID 로 그려지고, 어떤 백엔드는 linkage 자체를 주지 않아 관계가 조용히
 * "없음"으로 읽힌다.
 *
 * `page[totals]` 도 항상 싣는다. 총합은 opt-in 이라 이 플래그 없이는
 * `meta.totalCount` 가 오지 않고 `links.last` 도 null 이다(실측
 * app/controllers/concerns/crud_actions.py:162,179-213) - 표가 전체 쪽 수를
 * 계산하려면 매 쪽 요청에 이 플래그가 있어야 한다. 대가는 매 쪽마다 백엔드가
 * COUNT 쿼리를 한 번 더 도는 것이다 - 그 비용이 문제가 되는 배포는 이
 * 플래그를 꺼도 되고, 그때 잃는 것은 전체 쪽 수와 "전체 N건" 표시뿐이다(다음
 * 페이지 이동은 프로브 행 하나로 결정되므로 총합 없이도 그대로 된다).
 *
 * `state.pageQuery` 의 커서 값은 해석하지 않고 원래 파라미터 이름 그대로
 * 옮긴다 - 백엔드가 발급한 불투명한 값이라 이 계층이 내용을 알 필요도, 알
 * 권리도 없다.
 */
export function gridQuery(resource: ResourceDef, state: GridState): Record<string, string> {
  const query: Record<string, string> = {}

  for (const filter of resource.filters) {
    const value = state.filters[filter.key]
    if (value === undefined) continue
    query[`filter[${filter.key}][${filter.uiOperator}]`] = value
  }

  if (state.sort !== null) query.sort = state.sort

  query['page[size]'] = String(state.pageSize)
  query['page[totals]'] = 'true'
  for (const [key, value] of Object.entries(state.pageQuery)) {
    query[key] = value
  }

  if (resource.includes.length > 0) query.include = resource.includes.join(',')

  return query
}
