import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { gridQuery } from '@/lib/grid/query'
import type { GridState } from '@/lib/grid/state'
import type { ResourceDef } from '@/lib/resources'
import {
  columnFiltersFromParams,
  paginationFromParams,
  resolveSort,
} from '@/components/data-table-query'

/**
 * 대시보드 표(`components/data-table.tsx`)의 요청 조립 - `countRequest`
 * (`app/(admin)/count.ts`)·`healthRequest`(`app/(admin)/health.ts`)와 같은
 * 이유로 그것을 쓰는 화면(`app/(admin)/page.tsx`) 옆에 둔다. `data-table.tsx`
 * 는 이 파일을 몰라도 된다 - 그 표는 URL 을 읽고 쓸 뿐 백엔드에 직접
 * 요청하지 않는다(요청은 서버 컴포넌트인 `page.tsx` 가 렌더 시점에 보낸다).
 *
 * **이 파일이 `components/data-table-query.ts` 에서 갈라져 나온 이유.**
 * 그 파일은 `'use client'` 인 `data-table.tsx` 가 값으로 import 하므로
 * `lib/jsonapi` 를 값으로 끌어오면 안 된다(그 파일 머리말) - 그런데
 * `recentExamplesRequest` 는 `withAcceptLanguage`(`lib/jsonapi/client`)를
 * 값으로 쓴다. 원래는 한 파일에 같이 있었고, `data-table.tsx` 가 그중
 * URL 어휘만 가져다 썼다(요청 조립 자체는 전혀 참조하지 않았다) - 그래도
 * **파일 전체**가 그 표의 값-import 그래프에 들어 있었으므로, 트리 셰이킹이
 * 실제로 쓰이지 않는 코드를 쳐내는 것에만 기대어 `lib/config/settings.ts`
 * 가 클라이언트 번들에 안 실렸을 뿐이다. 요청 조립을 아예 다른 파일로
 * 빼서, `data-table.tsx` 의 값-import 그래프 자체에 `lib/jsonapi` 로 가는
 * 길이 없게 만든다.
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
