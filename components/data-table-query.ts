import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import { MAX_PAGE_SIZE } from '@/lib/grid/query'
import type { ResourceDef } from '@/lib/resources'

/**
 * `components/data-table.tsx`(블록이 남긴 대시보드 표)가 쓰는 URL 어휘 -
 * 표 자신의 파일이 아니라 여기 있는 이유는 `app/(admin)/recent.ts`(서버
 * 전용 요청 조립)도 같은 어휘를 읽어야 요청을 조립할 수 있기 때문이다
 * (`'use client'` 파일은 서버 컴포넌트가 import 할 수 없다).
 *
 * **이 파일은 `lib/jsonapi` 를 값으로 import 하지 않는다 - 그래야 한다.**
 * `data-table.tsx` 가 `'use client'` 파일이라, 이 파일이 `lib/jsonapi/client.ts`
 * (그리고 그 너머 `lib/config/settings.ts`)를 값으로 끌어오면 그 값 import
 * 자체가 클라이언트 번들이 도달하는 그래프의 간선이 된다 - 오늘은 트리
 * 셰이킹이 실제로 안 쓰는 코드를 쳐내 우연히 새지 않을 뿐, 강제하는 규칙이
 * 없다(`test/unit/components/boundary-policy.test.ts` 의 역방향 단정이
 * 이것을 기계적으로 지킨다). 실제로 백엔드에 요청을 보내는 조립
 * (`recentExamplesRequest`·`buildRecentRows`, `withAcceptLanguage` 를
 * 값으로 쓴다)은 그래서 이 파일에 두지 않고 `app/(admin)/recent.ts`(그것을
 * 쓰는 유일한 화면 옆)로 뺐다 - `data-table.tsx` 는 그 파일을 아예 모른다.
 *
 * 이 어휘는 `lib/grid` 의 것과 다르다(의도적 - `data-table.tsx` 머리말 참고).
 * `page`/`pageSize` 는 사람이 읽는 1-based 쪽 번호다 - 이 표는 처음/마지막
 * 쪽으로 바로 뛰는 버튼을 갖고 있어(First/Last), `lib/grid` 의 커서 전용
 * 이동(prev/next 만 가능)으로는 만들 수 없다. 백엔드가 `page[number]` 를
 * 위치 키로 받아들이므로(실측, `components/grid/resource-grid.tsx` 의
 * `PAGE_POSITION_PATTERN`) 임의 쪽으로 점프할 수 있다. sort 토큰 표기
 * (`-field`)만 `lib/grid` 와 맞춘다 - 다른 관례를 새로 만들 이유가 없다.
 */

const SORT_PARAM = 'sort'
const FILTER_PARAM_PREFIX = 'filter_'
const PAGE_PARAM = 'page'
const PAGE_SIZE_PARAM = 'pageSize'
export const DEFAULT_PAGE_SIZE = 10

/** URL 에 정렬이 없을 때 이 표가 쓰는 기본 정렬 - "최근 수정" 목록의 정의다. */
const DEFAULT_SORT = '-updatedAt'

export function sortingFromParams(params: URLSearchParams): SortingState {
  const raw = params.get(SORT_PARAM)
  if (raw === null || raw === '') return []
  return raw.split(',').map((token) => ({
    id: token.startsWith('-') ? token.slice(1) : token,
    desc: token.startsWith('-'),
  }))
}

export function sortingToToken(sorting: SortingState): string | null {
  if (sorting.length === 0) return null
  return sorting.map((entry) => (entry.desc ? `-${entry.id}` : entry.id)).join(',')
}

export function columnFiltersFromParams(params: URLSearchParams): ColumnFiltersState {
  const filters: ColumnFiltersState = []
  for (const [key, value] of params.entries()) {
    if (key.startsWith(FILTER_PARAM_PREFIX))
      filters.push({ id: key.slice(FILTER_PARAM_PREFIX.length), value })
  }
  return filters
}

/**
 * 없거나 정수가 아니거나 1 미만인 `page`/`pageSize` 는 첫 쪽·기본 쪽 크기로
 * 접는다. 상한도 `MAX_PAGE_SIZE`(`lib/grid/query.ts`)로 자른다 - 이 표는
 * `recentExamplesRequest`(`app/(admin)/recent.ts`)의 와이어 조립과 이
 * 함수를 그대로 공유하지만, 이 함수가 만드는 `PaginationState` 는 **표
 * 자신의 `useTable` 상태(`pagination.pageSize`)로도 그대로 쓰인다** -
 * `getPageCount()` 가 그 값으로 전체 쪽 수를 계산한다. `gridQuery` 가
 * 와이어에 나가는 값만 자르고 이 함수가 자르지 않으면, `?pageSize=500` 같은
 * URL 에서 화면은 "500 개씩 250 건이니 1 쪽"이라고 그리는데 실제로는
 * 100 개만 와서 150 개가 오류 없이 사라진다 - 이 함수를 거치지 않는 자리가
 * 있는 한 `gridQuery` 의 클램프만으로는 이 화면을 지키지 못한다.
 */
export function paginationFromParams(params: URLSearchParams): PaginationState {
  const rawPageSize = Number(params.get(PAGE_SIZE_PARAM))
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE
  const rawPage = Number(params.get(PAGE_PARAM))
  const pageIndex = Number.isInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0
  return { pageIndex, pageSize }
}

/**
 * URL 에 실제로 적용될 정렬 토큰 - 없으면 `DEFAULT_SORT`.
 *
 * `app/(admin)/recent.ts` 의 `recentExamplesRequest` 와 표 아래 "수정일
 * 내림차순" 안내 문구(`app/(admin)/page.tsx`)가 이 함수 하나를 같이 쓴다 -
 * 기본값이 두 곳에 따로 있으면 한쪽만 바뀌었을 때 안내 문구가 실제 정렬과
 * 다른 말을 하게 된다(그 자체가 이 작업 전체가 경계하는 "화면이 사실이
 * 아닌 것을 말한다"에 해당한다).
 */
export function resolveSort(params: URLSearchParams): string {
  return sortingToToken(sortingFromParams(params)) ?? DEFAULT_SORT
}

/** `sort` 토큰을 "수정일 내림차순" 같은 한국어 한 줄로 옮긴다 - 열 라벨은 `resource.columns` 에서 찾는다. */
export function describeSort(resource: ResourceDef, sort: string): string {
  const desc = sort.startsWith('-')
  const key = desc ? sort.slice(1) : sort
  const label = resource.columns.find((column) => column.key === key)?.label ?? key
  return `${label} ${desc ? '내림차순' : '오름차순'}`
}
