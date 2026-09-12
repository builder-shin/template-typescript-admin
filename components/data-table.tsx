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
  type RecentRow,
} from '@/components/data-table-query'
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
import {
  GripVerticalIcon,
  Columns3Icon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from 'lucide-react'

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

  /** 현재 URL 파라미터를 복제해 고치고 그 결과로 옮겨간다(스크롤 위치는 유지). */
  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams)
    mutate(params)
    const query = params.toString()
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
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
        if (next.pageIndex === 0) params.delete('page')
        else params.set('page', String(next.pageIndex + 1))
        if (next.pageSize === DEFAULT_PAGE_SIZE) params.delete('pageSize')
        else params.set('pageSize', String(next.pageSize))
      })
    },
  })
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
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {table.state.pagination.pageIndex + 1} / {table.getPageCount()} 쪽
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">첫 쪽으로</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">이전 쪽으로</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">다음 쪽으로</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">마지막 쪽으로</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
