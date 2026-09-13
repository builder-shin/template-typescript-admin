'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  type ColumnVisibilityState,
  type Row,
} from '@tanstack/react-table'

import {
  DEFAULT_PAGE_SIZE,
  columnFiltersFromParams,
  paginationFromParams,
  sortingFromParams,
  sortingToToken,
} from '@/components/data-table-query'
import type { RecentRow } from '@/app/(admin)/recent'
import { serverDrivenTableOptions } from '@/lib/grid/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GripVerticalIcon, Columns3Icon, ChevronDownIcon } from 'lucide-react'
import { pageWindow } from './grid/pagination-model'

// New in v9: declare the features this table uses — anything you don't
// register is tree-shaken out of the bundle.
//
// 서버 구동: 행 모델 세 줄(filteredRowModel · paginatedRowModel ·
// sortedRowModel)을 등록하지 않는다 - 정렬·필터·페이지는 백엔드가 계산해서
// 이미 잘린 한 쪽만 이 표로 들어온다. feature 다섯은 그대로 남긴다 - v9 에서
// feature 는 "이 표가 그 기능을 쓴다"이고 행 모델은 "클라이언트가 그 계산을
// 한다"라 서로 다른 질문이다. rowSortingFeature 를 함께 지우면 정렬 상태와
// API 자체가 사라져 헤더의 정렬 컨트롤이 죽는다.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

const columnHelper = createColumnHelper<typeof features, RecentRow>()

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  })
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">끌어서 순서 바꾸기</span>
    </Button>
  )
}

/** ISO 문자열을 타임존 변환 없이 "YYYY-MM-DD HH:mm" 로 다듬는다 - 이 표는
 * `ResourceDef` 를 모르는 독립 컴포넌트라(파일 머리말) `components/grid/
 * resource-grid.tsx` 의 같은 이름 함수를 가져다 쓰지 않고 자신만의 사본을
 * 둔다. 이유는 같다 - 서버·클라이언트 로케일이 다르면 Intl 포맷은
 * 하이드레이션 불일치를 낼 수 있다. */
function formatDateTime(value: string): string {
  const [date, time] = value.split('T')
  return date !== undefined && time !== undefined ? `${date} ${time.slice(0, 5)}` : value
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: 'drag',
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  }),
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="전체 선택"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="행 선택"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor('title', {
    header: '제목',
    enableHiding: false,
  }),
  columnHelper.accessor('status', {
    header: '상태',
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.status}
      </Badge>
    ),
  }),
  columnHelper.accessor('score', {
    header: () => <div className="w-full text-right">점수</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.score}</div>,
  }),
  columnHelper.accessor('updatedAt', {
    header: '수정일',
    cell: ({ row }) => formatDateTime(row.original.updatedAt),
  }),
])
function DraggableRow({ row }: { row: Row<typeof features, RecentRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })
  return (
    <TableRow
      data-state={row.getIsSelected() && 'selected'}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

/**
 * `useSearchParams()` 를 쓰는 컴포넌트는 Suspense 경계 안에 있어야 빌드가
 * 정적 셸을 만들 수 있다(Next 규약) - 호출부가 그 경계를 잊지 않도록 여기서
 * 감싼다. 안쪽 `DataTableInner` 가 실제 몸통이다.
 *
 * **`data` 는 이미 그 쪽 한 장만 담고 있어야 한다.** `paginatedRowModel` 을
 * 등록하지 않으므로 이 컴포넌트는 더 이상 `data` 를 잘라 보여주지 않는다 -
 * 표가 전체 쪽 수를 아는 데는 `rowCount` 하나면 충분하지만, 실제로 보여줄
 * 행을 그 쪽만큼 고르는 것은 호출자(서버)의 몫이다.
 */
export function DataTable(props: { data: RecentRow[]; rowCount: number }) {
  return (
    <React.Suspense fallback={null}>
      <DataTableInner {...props} />
    </React.Suspense>
  )
}

function DataTableInner({ data, rowCount }: { data: RecentRow[]; rowCount: number }) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // sorting · columnFilters · pagination 은 이제 URL 이 정본이다 - 로컬
  // useState 로 거울 상태를 만들지 않는다(두 원본이 어긋날 자리가 생긴다).
  // 매 렌더마다 현재 URL 에서 다시 읽는다. 읽는 함수는 `data-table-query.ts` -
  // `app/(admin)/page.tsx` 가 같은 URL 을 같은 함수로 읽어야 여기 보이는
  // 상태와 실제로 백엔드에 보낸 질의가 어긋나지 않는다.
  const sorting = sortingFromParams(searchParams)
  const columnFilters = columnFiltersFromParams(searchParams)
  const pagination = paginationFromParams(searchParams)
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  )
  // dnd-kit 드래그 순서는 서버에 남지 않는다 - 백엔드에 순서 필드도 재정렬
  // 엔드포인트도 없다. 그래도 블록의 부품은 손대지 않는다(README/AGENTS 가
  // 이 사실을 적는 것은 Task 14 의 몫). 그 대가로 이 로컬 state 는 새로고침하면
  // `data` 원래 순서로 되돌아간다.
  const [localData, setLocalData] = React.useState(data)
  React.useEffect(() => {
    setLocalData(data)
  }, [data])

  /**
   * `page` 파라미터를 이 쪽으로 맞춘다. 첫 쪽은 키를 **지운다** - 기본값이라
   * URL 에 쓰지 않는다(`data-table-query.ts` 가 없는 `page` 를 1 로 읽는다).
   *
   * 쪽 이동을 실제로 수행하는 `onPaginationChange` 와 번호 링크의 `href` 가
   * 둘 다 이 함수를 쓴다 - 규칙이 두 벌이면 링크를 복사해 붙인 주소가 실제로
   * 눌러서 가는 곳과 달라진다.
   */
  function setPageParam(params: URLSearchParams, pageIndex: number): void {
    if (pageIndex === 0) params.delete('page')
    else params.set('page', String(pageIndex + 1))
  }

  /** 현재 URL 파라미터를 복제해 고친 결과 URL. */
  function urlWith(mutate: (params: URLSearchParams) => void): string {
    const params = new URLSearchParams(searchParams)
    mutate(params)
    const query = params.toString()
    return query === '' ? pathname : `${pathname}?${query}`
  }

  /** 위 URL 로 옮겨간다(스크롤 위치는 유지). */
  function navigate(mutate: (params: URLSearchParams) => void) {
    router.replace(urlWith(mutate), { scroll: false })
  }

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => localData.map(({ id }) => id),
    [localData],
  )

  const table = useTable({
    features,
    data: localData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    ...serverDrivenTableOptions(rowCount),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      navigate((params) => {
        const token = sortingToToken(next)
        if (token === null) params.delete('sort')
        else params.set('sort', token)
      })
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      navigate((params) => {
        for (const key of new Set(params.keys())) {
          if (key.startsWith('filter_')) params.delete(key)
        }
        for (const filter of next) {
          if (typeof filter.value === 'string' && filter.value !== '') {
            params.set(`filter_${filter.id}`, filter.value)
          }
        }
      })
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      navigate((params) => {
        setPageParam(params, next.pageIndex)
        if (next.pageSize === DEFAULT_PAGE_SIZE) params.delete('pageSize')
        else params.set('pageSize', String(next.pageSize))
      })
    },
  })
  const currentPageIndex = table.state.pagination.pageIndex

  /**
   * 번호 한 칸에 실을 props. `href` 와 `onClick` 을 함께 준다 - `href` 는
   * 브라우저가 주는 것들(가운데 클릭으로 새 탭·링크 주소 복사)을 위한 것이고,
   * 클릭은 기본 동작을 막고 `table.setPageIndex` 로 보낸다. 이동을 표에
   * 맡기는 이유: 그 호출이 `onPaginationChange` 를 태워 URL 을 쓰므로
   * "쪽을 어떻게 옮기는가"가 한 곳에만 남는다.
   *
   * 보조기술에는 버튼으로 들린다 - base UI 가 `nativeButton={false}` 인
   * `<a>` 에 `role="button"` 을 얹는다(실측). `components/grid/resource-grid.tsx`
   * 의 같은 함수 머리말에 그 실측을 적어 뒀다.
   *
   * 갈 곳이 없으면 `href` 를 싣지 않고 `aria-disabled` 로 밝힌다 - `<a>` 에는
   * `disabled` 가 없다.
   */
  function pageLinkProps(targetIndex: number | null): React.ComponentProps<'a'> {
    if (targetIndex === null) {
      return { 'aria-disabled': true, tabIndex: -1, className: 'pointer-events-none opacity-50' }
    }
    return {
      href: urlWith((params) => setPageParam(params, targetIndex)),
      onClick: (event) => {
        event.preventDefault()
        table.setPageIndex(targetIndex)
      },
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setLocalData((current) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(current, oldIndex, newIndex)
      })
    }
  }
  return (
    <div className="flex w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-end px-4 lg:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <Columns3Icon data-icon="inline-start" />
            열 표시
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {table
              .getAllColumns()
              .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : <FlexRender header={header} />}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      결과가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {/*
              filteredRowModel 을 등록하지 않으므로 getFilteredRowModel() 은
              필터 이전, 즉 이 쪽에 불러온 행 전부를 돌려준다(서버 필터에서는
              정직한 값이다). 그 값을 "선택됨" 이라고만 적으면 전체 결과처럼
              읽히므로 "이 페이지" 로 분모의 정체를 밝히고, 총 건수(rowCount)를
              별도로 덧붙인다.
            */}
            선택 {table.getFilteredSelectedRowModel().rows.length}개 · 이 페이지{' '}
            {table.getRowModel().rows.length}개 (전체 {rowCount}건)
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                페이지당 행 수
              </Label>
              <Select
                value={`${table.state.pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
                items={[10, 20, 30, 40, 50].map((pageSize) => ({
                  label: `${pageSize}`,
                  value: `${pageSize}`,
                }))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {/* "N / M 쪽" 글자는 지웠다 - 번호가 그 자리에 그대로 보이고
                (지금 쪽은 눌린 상태로, 마지막 쪽은 목록 끝에), 같은 정보를
                두 벌로 두면 한쪽만 틀리는 자리가 생긴다. 첫 쪽·마지막 쪽
                전용 버튼(«·»)도 지웠다 - 번호 1 과 마지막 번호가 늘 보여
                같은 이동을 한 번의 클릭으로 한다. */}
            <Pagination className="mx-0 ml-auto w-fit lg:ml-0">
              <PaginationContent>
                <PaginationItem>
                  {/* `aria-label` 을 덮는다 - 레지스트리 부품의 기본값이
                      영어다(자세한 이유는 components/grid/resource-grid.tsx
                      의 같은 자리). 문구는 예전 이 자리의 sr-only 와 같다. */}
                  <PaginationPrevious
                    text="이전"
                    aria-label="이전 쪽으로"
                    {...pageLinkProps(table.getCanPreviousPage() ? currentPageIndex - 1 : null)}
                  />
                </PaginationItem>
                {pageWindow(currentPageIndex + 1, table.getPageCount()).map((slot, index) =>
                  slot === 'gap' ? (
                    <PaginationItem key={`gap-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={slot}>
                      <PaginationLink
                        isActive={slot === currentPageIndex + 1}
                        aria-label={`${slot}쪽으로`}
                        {...pageLinkProps(slot - 1)}
                      >
                        {slot}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    text="다음"
                    aria-label="다음 쪽으로"
                    {...pageLinkProps(table.getCanNextPage() ? currentPageIndex + 1 : null)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  )
}
