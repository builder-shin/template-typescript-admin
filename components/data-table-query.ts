import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { gridQuery } from '@/lib/grid/query'
import type { GridState } from '@/lib/grid/state'
import type { ResourceDef } from '@/lib/resources'

/**
 * `components/data-table.tsx`(블록이 남긴 대시보드 표)가 쓰는 URL 어휘와 그
 * 어휘를 백엔드 질의로 옮기는 조립 - 표 자신의 파일이 아니라 여기 있는
 * 이유는 `app/(admin)/page.tsx`(서버 컴포넌트)도 같은 어휘를 읽어야
 * 요청을 조립할 수 있기 때문이다(`'use client'` 파일은 서버 컴포넌트가
 * import 할 수 없다).
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

/** 없거나 정수가 아니거나 1 미만인 `page`/`pageSize` 는 첫 쪽·기본 쪽 크기로 접는다. */
export function paginationFromParams(params: URLSearchParams): PaginationState {
  const rawPageSize = Number(params.get(PAGE_SIZE_PARAM))
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0 ? rawPageSize : DEFAULT_PAGE_SIZE
  const rawPage = Number(params.get(PAGE_PARAM))
  const pageIndex = Number.isInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0
  return { pageIndex, pageSize }
}

/**
 * URL 에 실제로 적용될 정렬 토큰 - 없으면 `DEFAULT_SORT`.
 *
 * `recentExamplesRequest` 와 표 아래 "수정일 내림차순" 안내 문구
 * (`app/(admin)/page.tsx`)가 이 함수 하나를 같이 쓴다 - 기본값이 두 곳에
 * 따로 있으면 한쪽만 바뀌었을 때 안내 문구가 실제 정렬과 다른 말을 하게
 * 된다(그 자체가 이 작업 전체가 경계하는 "화면이 사실이 아닌 것을
 * 말한다"에 해당한다).
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

/**
 * 대시보드 표의 요청 조립 - `listRequest`(app/(admin)/examples/list.ts)와 같은
 * 튜플 모양이다. 정렬·필터·쪽 상태를 이 표의 URL 어휘로 읽고, `GridState` 로
 * 옮겨 `gridQuery` 에 넘긴다 - 필터 연산자 선택(`uiOperator`)·`page[totals]`·
 * `include` 조립은 이미 `gridQuery` 가 갖고 있으므로 다시 만들지 않는다.
 *
 * `hiddenColumns` 는 항상 빈 배열이다 - 이 표는 `hide` 파라미터를 왕복시키지
 * 않는다(열 표시/숨김 UI 자체가 없다). 빈 배열이라도 `gridQuery` 의 질의에는
 * 아무 영향이 없다(열 숨김은 질의가 아니라 렌더링만 바꾼다 - lib/grid/AGENTS.md).
 */
export function recentExamplesRequest(
  resource: ResourceDef,
  params: URLSearchParams,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const filters: Record<string, string> = {}
  for (const filter of columnFiltersFromParams(params)) {
    if (typeof filter.value === 'string' && filter.value !== '') {
      filters[String(filter.id)] = filter.value
    }
  }
  const pagination = paginationFromParams(params)
  const state: GridState = {
    filters,
    sort: resolveSort(params),
    pageQuery: { 'page[number]': String(pagination.pageIndex + 1) },
    pageSize: pagination.pageSize,
    hiddenColumns: [],
  }
  const query = new URLSearchParams(gridQuery(resource, state))
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/** 대시보드 표 한 행 - `examples` 의 스칼라 필드 중 이 표가 실제로 그리는 것만 담는다. */
export interface RecentRow {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly score: number
  readonly updatedAt: string
}

/**
 * `CollectionDocument` 를 표 행으로 옮긴다. 관계(`category`·`tags`)는 담지
 * 않는다 - 이 표는 훑어보기용 요약이라 `/examples` 전체 그리드
 * (`components/grid/resource-grid.tsx`)와 달리 관계 해석이 필요 없다.
 *
 * 속성이 선언과 다른 타입으로 오거나 아예 없어도 던지지 않고 빈 값으로
 * 접는다 - 카드·표 어느 쪽도 렌더링 실패로 화면 전체를 끌고 내려가면 안
 * 된다(단, 총합이 없는 경우는 다르다 - `app/(admin)/count.ts` 의 `readTotal`
 * 이 그 경우를 던지게 한다).
 */
export function buildRecentRows(document: CollectionDocument): RecentRow[] {
  return document.data.map((object) => {
    const attributes = object.attributes ?? {}
    return {
      id: object.id,
      title: typeof attributes.title === 'string' ? attributes.title : '',
      status: typeof attributes.status === 'string' ? attributes.status : '',
      score: typeof attributes.score === 'number' ? attributes.score : 0,
      updatedAt: typeof attributes.updatedAt === 'string' ? attributes.updatedAt : '',
    }
  })
}
