import type { ResourceDef } from '@/lib/resources'
import type { GridState } from './state'

/**
 * 세 백엔드 모두 `page[size]` 를 이 값에서 자른다(실측) - 클라이언트가 먼저
 * 지켜 두면 화면이 받는 값과 백엔드가 실제로 적용하는 값이 갈리지 않는다.
 *
 * **여기(와이어로 나가는 지점)에 두는 이유.** `gridQuery` 의 소비자가
 * 둘이다 - `lib/grid/state.ts` 의 `readGridState` 가 만든(이미 걸러진)
 * `GridState` 하나, 그리고 `app/(admin)/recent.ts` 의 `recentExamplesRequest`
 * 가 `components/data-table-query.ts` 의 `paginationFromParams` 로 직접
 * 만드는 또 하나다. 이 상수가 `state.ts` 안에 모듈 전용으로만 있던 시절에는
 * 후자가 그 클램프를 아예 거치지 않아 `?pageSize=500` 이 그대로
 * `page[size]=500` 으로 나갔다 - 백엔드는 이 값을 100 으로 자르지만, 그
 * 사실을 모르는 화면(`components/data-table.tsx`)은 `getPageCount()` 를
 * 500 으로 계산해 "전체 250건이면 1쪽"이라고 그린다. 실제로는 100건만 오고
 * 150건은 그 어떤 오류도 없이 도달 불가능해진다. 여기서 자르면 **`gridQuery`
 * 를 거치는 모든 호출자**가 자동으로 안전해진다 - 새 소비자가 추가돼도
 * 이 자리 하나만 지키면 된다.
 *
 * `state.ts` 의 `clampPageSize` 도 이 상수를 그대로 가져다 여전히 자른다 -
 * 여기서 자르는 것과 별개로, `resource-grid.tsx` 가 `GridState.pageSize` 를
 * (와이어로 나가기 전에) 그대로 `pagination.pageSize`(자기 표의 쪽 수 계산)
 * 에도 쓰기 때문이다 - 그 자리는 `gridQuery` 를 거치지 않으므로 여기 클램프
 * 만으로는 닿지 않는다. `components/data-table-query.ts` 의
 * `paginationFromParams` 도 같은 이유로 이 상수를 가져다 쓴다(그 표 자신의
 * `pagination.pageSize` 도 `gridQuery` 밖에서 읽힌다). 즉 **값은 여기
 * 하나뿐이고, 클램프 자리는 값을 실제로 쓰는 곳마다 있다** - 두 번 세
 * 번 자르는 것은 멱등이라 해롭지 않지만, 100 이라는 숫자 자체가 두 벌로
 * 갈라져 있으면(예전 상태) 하나만 고쳤을 때 나머지가 조용히 드리프트한다.
 */
export const MAX_PAGE_SIZE = 100

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

  query['page[size]'] = String(Math.min(state.pageSize, MAX_PAGE_SIZE))
  query['page[totals]'] = 'true'
  for (const [key, value] of Object.entries(state.pageQuery)) {
    query[key] = value
  }

  if (resource.includes.length > 0) query.include = resource.includes.join(',')

  return query
}
