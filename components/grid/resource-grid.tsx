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
import { runBulk, type BulkOutcome, type BulkReport } from '@/lib/bulk/executor'
import type { ColumnDef, ColumnKind, ResourceDef } from '@/lib/resources'
import type { CollectionDocument, ResourceObject } from '@/lib/jsonapi/document'
import {
  indexResources,
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
import { BulkConfirmPanel } from './bulk-confirm'
import { BulkProgress, BulkResultTable, mergeRetryReport } from './bulk-result'
import { formatDateTime, relationshipLabel } from './format'
import { SelectionBar } from './selection-bar'

/**
 * `relationshipLabel`·`formatDateTime` 을 다시 내보낸다 - 이 파일에
 * 그대로 있으면 서버 컴포넌트(`app/(admin)/examples/[id]/page.tsx`)가 여기서
 * 값으로 import 할 때 이 파일 맨 위의 `'use client'` 때문에 "클라이언트 함수를
 * 서버에서 호출했다"로 죽는다(실측 - `./format.ts` 머리말 참고) - 그래서 실제
 * 정의는 `'use client'` 가 없는 `./format.ts` 로 옮겼다. 이 재수출은 이 파일을
 * 가져다 쓰던 기존 소비자(`test/unit/grid/resource-grid.test.ts`)의 import
 * 경로를 그대로 유지하기 위해서다 - 새 소비자는 `./format` 에서 직접
 * import 해라.
 */
export { formatDateTime, relationshipLabel }

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
 *
 * `bulkDeleteAction` 을 받으면(있는 자원만) 선택 바·확인 줄·진행률·결과 표가
 * 나타난다 - 어느 것도 자원 이름으로 분기하지 않는다. `runBulk` 을 실제로
 * 돌리는 것도, `id` 마다 `JsonApiResult` 를 `BulkOutcome` 으로 바꾸는 것도 이
 * 컴포넌트가 아니라 호출부가 넘긴 Action 의 일이다 - 이 파일은 그 결과를
 * `bulk-result.tsx` 의 `summarize` 로 읽어 표시만 한다.
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
 * 일괄 삭제 진행 상태. `idle` 은 선택 바만(있다면) 보이는 평시고, `confirming` 은
 * 실행 전 확인 문구가 뜬 상태, `running` 은 `runBulk` 가 실제로 요청을 보내는
 * 중(진행률만 표시, 텍스트 없음), `done` 은 결과 표가 뜬 상태다.
 *
 * `done.requested` 는 **최초** 확인에서 선택했던 건수다 - `BulkReport` 에는
 * 없는 값이다(순수 실행기는 "몇 건이 요청됐는지"를 모른다 - lib/bulk/
 * executor.ts). 재시도해도 이 값은 갈지 않는다 - 12건 중 3건만 재시도해도
 * "요청 12건"이라는 사실은 그대로이기 때문이다. `bulk-result.tsx` 의
 * `BulkResultTable` 이 이 값과 `report.outcomes.length` 를 비교해 "한
 * 번도 시도되지 않은 건수"가 있는지를 보여준다.
 */
type BulkPhase =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'running'; done: number; total: number; controller: AbortController }
  | { kind: 'done'; report: BulkReport; requested: number }

/**
 * `useSearchParams()` 를 쓰므로 Suspense 경계 안에 있어야 빌드가 정적 셸을
 * 만들 수 있다(Next 규약) - 호출부가 잊지 않도록 여기서 감싼다.
 */
export function ResourceGrid(props: {
  resource: ResourceDef
  document: CollectionDocument
  /**
   * 있으면 선택 바·확인 줄·결과 표가 나타난다. 없으면(읽기 전용 자원) 이
   * 그리드는 지금과 같이 선택 상태만 갖고 아무것도 실행하지 않는다 - 이
   * 파일이 어떤 자원인지 분기해서 판단하지 않는다.
   */
  bulkDeleteAction?: (id: string) => Promise<BulkOutcome>
  /**
   * 세션이 끊긴 뒤 "다시 로그인"이 걸 링크. 이 컴포넌트가 직접 조립하지
   * 않는다 - 되돌아올 경로(그리드의 현재 필터·정렬·페이지 전부가 URL 에
   * 있다)를 만들려면 `proxy.ts` 의 `LOGIN_REDIRECT_PARAM` 이 필요한데, 그
   * 상수를 여기서 값으로 import 하면 `proxy.ts` 가 `lib/auth/session.ts` 를
   * 통해 값으로 끌어오는 `next/headers` 까지 클라이언트 번들에 끌려
   * 들어간다(실측: `pnpm build` 가 "Server Components 밖에서 next/headers"
   * 로 깨진다). 서버 컴포넌트인 호출부(`app/(admin)/examples/page.tsx`)는
   * 그 경로 조립을 안전하게 할 수 있으므로 완성된 문자열만 받는다.
   */
  reauthHref: string
}) {
  return (
    <React.Suspense fallback={null}>
      <ResourceGridInner {...props} />
    </React.Suspense>
  )
}

function ResourceGridInner({
  resource,
  document,
  bulkDeleteAction,
  reauthHref,
}: {
  resource: ResourceDef
  document: CollectionDocument
  bulkDeleteAction?: (id: string) => Promise<BulkOutcome>
  reauthHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const gridState = readGridState(searchParams, resource)

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [bulkPhase, setBulkPhase] = React.useState<BulkPhase>({ kind: 'idle' })

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
  const selectedIds = table.getFilteredSelectedRowModel().rows.map((row) => row.id)

  /**
   * `runBulk` 를 실제로 돌린다 - 클라이언트가 `ids` 하나마다 `bulkDeleteAction`
   * (Server Action)을 순차로 부른다. 서버 액션 하나가 한 번의 왕복이라
   * `onProgress` 가 건마다 실제로 갱신되고, `signal` 취소가 다음 요청을 막을 수
   * 있다 - 이 실행이 서버 한 번의 요청·응답으로 묶여 있었다면 둘 다 불가능했다.
   *
   * `previous` 가 있으면(재시도) 결과를 통째로 갈지 않고 `mergeRetryReport` 로
   * 합친다 - 재시도한 몇 건만 담긴 작은 보고서로 표 전체를 바꾸면 이미 확인된
   * 나머지 건의 결과가 화면에서 사라진다. `previous.requested` 를 그대로
   * 물려받는 이유도 같다 - 재시도는 최초 선택 건수를 바꾸지 않는다(12건 중
   * 3건만 재시도해도 "요청 12건"은 그대로다).
   */
  async function startBulkDelete(
    ids: readonly string[],
    previous?: { report: BulkReport; requested: number },
  ) {
    if (bulkDeleteAction === undefined || ids.length === 0) return
    const requested = previous?.requested ?? ids.length
    const controller = new AbortController()
    setBulkPhase({ kind: 'running', done: 0, total: ids.length, controller })
    const result = await runBulk(ids, bulkDeleteAction, {
      signal: controller.signal,
      onProgress: (done) => {
        setBulkPhase((prev) => (prev.kind === 'running' ? { ...prev, done } : prev))
      },
    })
    const report = previous === undefined ? result : mergeRetryReport(previous.report, result)
    setRowSelection({})
    setBulkPhase({ kind: 'done', report, requested })
  }

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

      {bulkDeleteAction !== undefined && selectedIds.length > 0 && bulkPhase.kind === 'idle' && (
        <SelectionBar
          selectedCount={selectedIds.length}
          onBulkDelete={() => setBulkPhase({ kind: 'confirming' })}
        />
      )}
      {bulkPhase.kind === 'confirming' && (
        <BulkConfirmPanel
          count={selectedIds.length}
          onCancel={() => setBulkPhase({ kind: 'idle' })}
          mode="button"
          onConfirm={() => {
            void startBulkDelete(selectedIds)
          }}
        />
      )}
      {bulkPhase.kind === 'running' && (
        <BulkProgress
          done={bulkPhase.done}
          total={bulkPhase.total}
          onCancel={() => bulkPhase.controller.abort()}
        />
      )}
      {bulkPhase.kind === 'done' && (
        <BulkResultTable
          report={bulkPhase.report}
          requested={bulkPhase.requested}
          onRetry={(ids) => {
            void startBulkDelete(ids, { report: bulkPhase.report, requested: bulkPhase.requested })
          }}
          onClose={() => setBulkPhase({ kind: 'idle' })}
          reauthHref={reauthHref}
        />
      )}

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
