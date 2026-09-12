import type { ResourceDef } from '@/lib/resources'
import { MAX_PAGE_SIZE } from './query'

/**
 * URL 검색 파라미터와 그리드 표시 상태 사이의 변환.
 *
 * 이 파일은 어떤 자원 이름도 모른다 - `ResourceDef` 가 필터·정렬·열 선언을
 * 건네주고, 이 파일은 그 선언을 거울삼아 URL 을 읽고 쓸 뿐이다. 자원 이름이나
 * 자원별 필드 이름에 의존하는 분기는 이 파일에 두지 않는다.
 *
 * 선언에 없는 필터 키·정렬·열은 버린다. 필터·정렬을 버리는 것이 왜 스타일이
 * 아니라 정확성인지는 `query.ts` 머리말에 있다 - 이 파일은 그 정확성이 기대는
 * 재료(걸러진 `GridState`)를 만드는 자리다.
 *
 * 커서(`page[after]`·`page[before]`·`page[number]`)는 백엔드 링크에서 그대로
 * 옮겨진 불투명한 값이다. 이 파일은 그 값의 내용을 해석하지 않고 원래
 * 파라미터 이름 그대로 `pageQuery` 에 담아 되돌려 준다 - 앞뒤 이동은 그 값을
 * 다음 URL 에 그대로 옮기기만 하면 된다.
 */

export interface GridState {
  readonly filters: Readonly<Record<string, string>>
  readonly sort: string | null
  readonly pageQuery: Readonly<Record<string, string>>
  readonly pageSize: number
  readonly hiddenColumns: readonly string[]
}

/** 화면이 URL 에 쪽당 건수를 명시하지 않았을 때 쓰는 기본값. */
export const DEFAULT_PAGE_SIZE = 50

const SORT_KEY = 'sort'
const PAGE_SIZE_KEY = 'pageSize'
const HIDE_KEY = 'hide'

/**
 * 결과 집합 안의 위치를 가리키는 page 키만 잡는다. `page[size]`·`page[totals]`
 * 는 위치가 아니라 표현 방식이라 여기 없다 - 앞은 `pageSize` 필드가 이미
 * 맡고, 뒤는 `gridQuery` 가 항상 켠다(query.ts 머리말).
 */
const PAGE_POSITION_PATTERN = /^page\[(number|after|before)\]$/

/**
 * 상한(`MAX_PAGE_SIZE`)은 `query.ts` 가 정의한다 - 그 파일 머리말이 이유를
 * 적고 있다: 값을 실제로 와이어에 싣는 `gridQuery` 도 같은 상수로 다시
 * 자르므로 이 클램프가 없어도 와이어는 안전하지만, `resource-grid.tsx` 는
 * `gridQuery` 를 거치지 않고 `GridState.pageSize` 를 자기 표의
 * `pagination.pageSize`(쪽 수 계산)에 그대로 쓴다 - 그 자리를 지키는 것은
 * 이 함수뿐이다.
 */
function clampPageSize(raw: string | null): number {
  if (raw === null) return DEFAULT_PAGE_SIZE
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE
  return Math.min(parsed, MAX_PAGE_SIZE)
}

/** 선언된 필터 키만 골라 URL 에서 값을 옮긴다 - 나머지는 화면이 만들지 않은 조건이므로 버린다. */
function readFilters(params: URLSearchParams, resource: ResourceDef): Record<string, string> {
  const filters: Record<string, string> = {}
  for (const filter of resource.filters) {
    const value = params.get(filter.key)
    if (value !== null) filters[filter.key] = value
  }
  return filters
}

/** 정렬 토큰 앞의 `-` 는 내림차순 표시일 뿐 필드 이름의 일부가 아니다. */
function sortFieldName(token: string): string {
  return token.startsWith('-') ? token.slice(1) : token
}

function readSort(params: URLSearchParams, resource: ResourceDef): string | null {
  const raw = params.get(SORT_KEY)
  if (raw === null) return null
  return resource.sorts.includes(sortFieldName(raw)) ? raw : null
}

function readPageQuery(params: URLSearchParams): Record<string, string> {
  const pageQuery: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (PAGE_POSITION_PATTERN.test(key)) pageQuery[key] = value
  }
  return pageQuery
}

/** hide 도 필터·정렬과 같은 규칙을 따른다 - 선언에 없는 열 이름은 버린다. */
function readHiddenColumns(params: URLSearchParams, resource: ResourceDef): string[] {
  const raw = params.get(HIDE_KEY)
  if (raw === null || raw === '') return []
  const known = new Set(resource.columns.map((column) => column.key))
  return raw.split(',').filter((key) => known.has(key))
}

/** URL 검색 파라미터를 읽어 그리드 표시 상태를 만든다. */
export function readGridState(params: URLSearchParams, resource: ResourceDef): GridState {
  return {
    filters: readFilters(params, resource),
    sort: readSort(params, resource),
    pageQuery: readPageQuery(params),
    pageSize: clampPageSize(params.get(PAGE_SIZE_KEY)),
    hiddenColumns: readHiddenColumns(params, resource),
  }
}

/**
 * `readGridState` 의 역방향. 기본값과 같은 필드는 URL 에 쓰지 않는다 - 되읽을
 * 때 같은 기본값으로 돌아오므로 정보 손실 없이 URL 만 짧아진다.
 */
export function writeGridState(state: GridState): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(state.filters)) params.set(key, value)
  if (state.sort !== null) params.set(SORT_KEY, state.sort)
  for (const [key, value] of Object.entries(state.pageQuery)) params.set(key, value)
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set(PAGE_SIZE_KEY, String(state.pageSize))
  if (state.hiddenColumns.length > 0) params.set(HIDE_KEY, state.hiddenColumns.join(','))
  return params
}
