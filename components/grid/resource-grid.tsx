'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  Columns3Icon,
} from 'lucide-react'

import { serverDrivenTableOptions } from '@/lib/grid/table'
import { readGridState, writeGridState, type GridState } from '@/lib/grid/state'
import type { ColumnDef, ColumnKind, ResourceDef } from '@/lib/resources'
import type { CollectionDocument, ResourceIdentifier, ResourceObject } from '@/lib/jsonapi/document'
import {
  indexResources,
  isResourceObject,
  resolveToMany,
  resolveToOne,
  type ResourceIndex,
} from '@/lib/jsonapi/normalize'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * `examples`·`exampleCategories`·`exampleTags` 어느 자원이든 그리는 서버 구동
 * 목록 표 - `data-table.tsx`(블록이 남긴 대시보드 데모 표)와 달리 특정 스키마를
 * 몰라야 한다(components/grid/ 의 경계, lib/grid/AGENTS.md 와 같은 규칙).
 * 열·필터·정렬 선언은 전부 `ResourceDef` 에서 읽는다.
 *
 * 정렬·필터·페이지는 URL 이 정본이다 - 이 컴포넌트는 그 셋을 로컬 state 로
 * 거울삼지 않는다(readGridState 가 매 렌더 다시 읽는다). columnVisibility 는
 * `hide` 로 URL 에 남아 lib/grid/state.ts 가 이미 왕복시키는 값을 그대로
 * 쓴다(질의에는 영향이 없다 - lib/grid/AGENTS.md). rowSelection 만 로컬이다 -
 * 화면 선택은 URL 에도 백엔드 질의에도 나타나지 않는다.
 *
 * `extractCell`·`buildRows`·`readRowCount`·`pageHref`·`sortingStateFromToken`·
 * `sortTokenFromState`(와 관련 타입)를 내보내는 것은 이 컴포넌트가 아니라
 * `test/unit/grid/resource-grid.test.ts`를 위해서다 - 이 저장소에는 DOM 렌더
 * 테스트 장비(`@testing-library/react` 등)가 없어 React 부분은 검증할 수
 * 없지만, 이 함수들은 순수 로직이라 직접 단위 테스트할 수 있고 그래야 한다
 * (lib/grid/의 순수 변환과 같은 이유).
 */

export type GridCellValue = string | number | null | readonly string[]

export interface GridRow {
  readonly id: string
  readonly cells: Readonly<Record<string, GridCellValue>>
}

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

const columnHelper = createColumnHelper<typeof features, GridRow>()

/** 관계 대상의 표시 이름 - included 로 풀렸으면 이름, 식별자뿐이면 id. */
function relationshipLabel(target: ResourceObject | ResourceIdentifier): string {
  if (isResourceObject(target) && typeof target.attributes?.name === 'string') {
    return target.attributes.name
  }
  return target.id
}

/**
 * 열 하나의 값을 한 자원 객체에서 뽑는다. `column.key` 가 관계 이름과
 * 같으면(`category`·`tags`) relationships 를 먼저 본다 - attributes 에는
 * 관계 이름의 키가 애초에 없으므로 순서가 아니라 존재 여부로 갈린다.
 */
export function extractCell(
  column: ColumnDef,
  object: ResourceObject,
  index: ResourceIndex,
): GridCellValue {
  const relationship = object.relationships?.[column.key]
  if (relationship !== undefined) {
    if (column.kind === 'badges') return resolveToMany(relationship, index).map(relationshipLabel)
    const resolved = resolveToOne(relationship, index)
    return resolved === null ? null : relationshipLabel(resolved)
  }
  const value = object.attributes?.[column.key]
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}

export function buildRows(resource: ResourceDef, document: CollectionDocument): GridRow[] {
  const index = indexResources(document.included)
  return document.data.map((object) => ({
    id: object.id,
    cells: Object.fromEntries(
      resource.columns.map((column) => [column.key, extractCell(column, object, index)]),
    ),
  }))
}

/**
 * 총합은 opt-in 이다(`gridQuery` 가 `page[totals]=true` 를 항상 싣는다 -
 * lib/grid/query.ts). 없으면 조용히 0 을 그리지 않고 던진다 - 표가 전체
 * 쪽 수를 모르는 채로 "0건"을 그리면 있는 데이터를 없다고 말하는 것이다.
 */
export function readRowCount(document: CollectionDocument): number {
  const total = document.meta?.totalCount
  if (typeof total !== 'number') {
    throw new Error(
      'document.meta.totalCount 가 없다 - listRequest 는 page[totals]=true 를 항상 보낸다.',
    )
  }
  return total
}

/** ISO 문자열을 타임존 변환 없이 "YYYY-MM-DD HH:mm" 로 다듬는다 - 서버·클라이언트
 * 로케일이 다르면 Intl 포맷은 하이드레이션 불일치를 낼 수 있다. */
function formatDateTime(value: string): string {
  const [date, time] = value.split('T')
  return date !== undefined && time !== undefined ? `${date} ${time.slice(0, 5)}` : value
}

function renderCell(kind: ColumnKind, value: GridCellValue): React.ReactNode {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {(value as readonly string[]).map((label) => (
          <Badge key={label} variant="outline">
            {label}
          </Badge>
        ))}
      </div>
    )
  }
  if (kind === 'badge') return <Badge variant="outline">{String(value)}</Badge>
  if (kind === 'datetime') return formatDateTime(String(value))
  return String(value)
}

function buildColumns(resource: ResourceDef) {
  return [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="전체 선택"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="행 선택"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    ...resource.columns.map((column) =>
      // 반환 타입을 unknown 으로 못박는다 - display 열(TValue=unknown)과 같은
      // 배열에 담이므로, 여기서 GridCellValue 로 추론되게 두면 콜백 인자
      // 위치의 반변성 때문에 배열 전체의 타입이 통합되지 않는다(실측: 이
      // 캐스팅 없이 tsc 가 footer/header 템플릿 불일치로 거절했다). 실제
      // 값이 GridCellValue 라는 사실은 extractCell 이 보장하므로 cell 에서
      // 되돌려 잰다.
      columnHelper.accessor((row): unknown => row.cells[column.key] ?? null, {
        id: column.key,
        header: ({ column: tableColumn }) =>
          column.sortable ? (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground"
              onClick={tableColumn.getToggleSortingHandler()}
            >
              {column.label}
              {tableColumn.getIsSorted() === 'asc' && <ChevronUpIcon className="size-3.5" />}
              {tableColumn.getIsSorted() === 'desc' && <ChevronDownIcon className="size-3.5" />}
              {tableColumn.getIsSorted() === false && (
                <ChevronsUpDownIcon className="size-3.5 opacity-40" />
              )}
            </button>
          ) : (
            column.label
          ),
        cell: ({ getValue }) => renderCell(column.kind, getValue() as GridCellValue),
        enableSorting: column.sortable,
        enableHiding: true,
      }),
    ),
  ]
}

const PAGE_POSITION_PATTERN = /^page\[(number|after|before)\]$/

/**
 * 백엔드가 `links.next`/`links.prev` 에 실어 준 커서를 우리 URL 로 옮긴다.
 * 커서 자체는 해석하지 않는다(lib/grid/AGENTS.md 와 같은 원칙) - page 위치
 * 키만 갈아 끼우고 필터·정렬·pageSize 는 지금 URL 그대로 둔다.
 */
export function pageHref(
  pathname: string,
  current: URLSearchParams,
  link: string | null | undefined,
): string | null {
  if (link === null || link === undefined) return null
  const linkParams = new URL(link, 'http://backend.invalid').searchParams
  const next = new URLSearchParams(current)
  for (const key of new Set(next.keys())) {
    if (PAGE_POSITION_PATTERN.test(key)) next.delete(key)
  }
  for (const [key, value] of linkParams.entries()) {
    if (PAGE_POSITION_PATTERN.test(key)) next.append(key, value)
  }
  const query = next.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}

export function sortingStateFromToken(sort: string | null): SortingState {
  if (sort === null) return []
  return [{ id: sort.startsWith('-') ? sort.slice(1) : sort, desc: sort.startsWith('-') }]
}

export function sortTokenFromState(sorting: SortingState): string | null {
  const [first] = sorting
  if (first === undefined) return null
  return first.desc ? `-${first.id}` : first.id
}

/**
 * `useSearchParams()` 를 쓰므로 Suspense 경계 안에 있어야 빌드가 정적 셸을
 * 만들 수 있다(Next 규약) - 호출부가 잊지 않도록 여기서 감싼다.
 */
export function ResourceGrid(props: { resource: ResourceDef; document: CollectionDocument }) {
  return (
    <React.Suspense fallback={null}>
      <ResourceGridInner {...props} />
    </React.Suspense>
  )
}

function ResourceGridInner({
  resource,
  document,
}: {
  resource: ResourceDef
  document: CollectionDocument
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const gridState = readGridState(searchParams, resource)

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const rowCount = readRowCount(document)
  const rows = React.useMemo(() => buildRows(resource, document), [resource, document])
  const columns = React.useMemo(() => buildColumns(resource), [resource])

  const sorting = sortingStateFromToken(gridState.sort)
  const columnFilters: ColumnFiltersState = Object.entries(gridState.filters).map(
    ([id, value]) => ({
      id,
      value,
    }),
  )
  const columnVisibility: ColumnVisibilityState = Object.fromEntries(
    gridState.hiddenColumns.map((key) => [key, false]),
  )
  const pagination: PaginationState = { pageIndex: 0, pageSize: gridState.pageSize }

  /** 현재 gridState 를 고쳐 URL 로 옮긴다 - writeGridState 가 왕복 표현을 만든다. */
  function navigate(next: GridState) {
    const query = writeGridState(next).toString()
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
  }

  const table = useTable({
    features,
    data: rows,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection, pagination },
    ...serverDrivenTableOptions(rowCount),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    enableMultiSort: false,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater
      const hiddenColumns = resource.columns.map((c) => c.key).filter((key) => next[key] === false)
      // 열 표시는 gridQuery 의 어떤 출력에도 나타나지 않으므로(lib/grid/AGENTS.md)
      // pageQuery(커서)를 건드릴 이유가 없다 - 백엔드 질의가 바뀌지 않는다.
      navigate({ ...gridState, hiddenColumns })
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      // 정렬이 바뀌면 커서가 더 이상 같은 순서를 가리키지 않을 수 있다 -
      // pageQuery 를 비워 첫 쪽부터 다시 받는다.
      navigate({ ...gridState, sort: sortTokenFromState(next), pageQuery: {} })
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      const filters: Record<string, string> = {}
      for (const filter of next) {
        if (typeof filter.value === 'string' && filter.value !== '')
          filters[filter.id] = filter.value
      }
      navigate({ ...gridState, filters, pageQuery: {} })
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      // pageIndex 는 여기서 다루지 않는다 - 커서 페이지는 절대 위치가 없어
      // 앞/뒤 이동은 아래 Prev/Next 가 document.links 를 그대로 옮긴다.
      // pageSize 변경만 이 핸들러의 일이다(바뀌면 커서도 함께 리셋한다).
      if (next.pageSize === gridState.pageSize) return
      navigate({ ...gridState, pageSize: next.pageSize, pageQuery: {} })
    },
  })

  const prevHref = pageHref(pathname, searchParams, document.links?.prev)
  const nextHref = pageHref(pathname, searchParams, document.links?.next)

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">총 {rowCount}건</p>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3Icon data-icon="inline-start" />열
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {resource.columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={table.getColumn(column.key)?.getIsVisible() ?? true}
                onCheckedChange={(value) => table.getColumn(column.key)?.toggleVisibility(!!value)}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          선택 {table.getFilteredSelectedRowModel().rows.length}개 · 이 페이지{' '}
          {table.getRowModel().rows.length}개 (전체 {rowCount}건)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={prevHref === null}
            onClick={() => {
              if (prevHref !== null) router.push(prevHref, { scroll: false })
            }}
          >
            <ChevronLeftIcon />
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={nextHref === null}
            onClick={() => {
              if (nextHref !== null) router.push(nextHref, { scroll: false })
            }}
          >
            다음
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
