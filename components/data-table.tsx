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
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type PaginationState,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'
import { toast } from 'sonner'
import { z } from 'zod'

import { useIsMobile } from '@/hooks/use-mobile'
import { serverDrivenTableOptions } from '@/lib/grid/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  GripVerticalIcon,
  CircleCheckIcon,
  LoaderIcon,
  EllipsisVerticalIcon,
  Columns3Icon,
  ChevronDownIcon,
  PlusIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  TrendingUpIcon,
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

const columnHelper = createColumnHelper<typeof features, z.infer<typeof schema>>()

export const schema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
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
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
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
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor('header', {
    header: 'Header',
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  }),
  columnHelper.accessor('type', {
    header: 'Section Type',
    cell: ({ row }) => (
      <div className="w-32">
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.type}
        </Badge>
      </div>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.status === 'Done' ? (
          <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
        ) : (
          <LoaderIcon />
        )}
        {row.original.status}
      </Badge>
    ),
  }),
  columnHelper.accessor('target', {
    header: () => <div className="w-full text-right">Target</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Saving ${row.original.header}`,
            success: 'Done',
            error: 'Error',
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Target
        </Label>
        <Input
          className="h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />
      </form>
    ),
  }),
  columnHelper.accessor('limit', {
    header: () => <div className="w-full text-right">Limit</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Saving ${row.original.header}`,
            success: 'Done',
            error: 'Error',
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Limit
        </Label>
        <Input
          className="h-8 w-16 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />
      </form>
    ),
  }),
  columnHelper.accessor('reviewer', {
    header: 'Reviewer',
    cell: ({ row }) => {
      const isAssigned = row.original.reviewer !== 'Assign reviewer'
      if (isAssigned) {
        return row.original.reviewer
      }
      return (
        <>
          <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">
            Reviewer
          </Label>
          <Select
            items={[
              { label: 'Eddie Lake', value: 'Eddie Lake' },
              { label: 'Jamik Tashpulatov', value: 'Jamik Tashpulatov' },
            ]}
          >
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              id={`${row.original.id}-reviewer`}
            >
              <SelectValue placeholder="Assign reviewer" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                <SelectItem value="Jamik Tashpulatov">Jamik Tashpulatov</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </>
      )
    },
  }),
  columnHelper.display({
    id: 'actions',
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-open:bg-muted"
              size="icon"
            />
          }
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
])
function DraggableRow({ row }: { row: Row<typeof features, z.infer<typeof schema>> }) {
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

// 이 표는 특정 자원(ResourceDef)을 모르는 블록 자체의 데모 컴포넌트라
// lib/grid 의 URL 어휘를 그대로 쓰지 않는다 - 이 파일만의 작은 왕복 규칙을
// 둔다. sort 토큰 표기(`-field`)만 lib/grid 와 맞춘다(서로 다른 관례를 만들
// 이유가 없다).
const SORT_PARAM = 'sort'
const FILTER_PARAM_PREFIX = 'filter_'
const PAGE_PARAM = 'page'
const PAGE_SIZE_PARAM = 'pageSize'
const DEFAULT_PAGE_SIZE = 10

function sortingFromParams(params: URLSearchParams): SortingState {
  const raw = params.get(SORT_PARAM)
  if (raw === null || raw === '') return []
  return raw.split(',').map((token) => ({
    id: token.startsWith('-') ? token.slice(1) : token,
    desc: token.startsWith('-'),
  }))
}

function sortingToToken(sorting: SortingState): string | null {
  if (sorting.length === 0) return null
  return sorting.map((entry) => (entry.desc ? `-${entry.id}` : entry.id)).join(',')
}

function columnFiltersFromParams(params: URLSearchParams): ColumnFiltersState {
  const filters: ColumnFiltersState = []
  for (const [key, value] of params.entries()) {
    if (key.startsWith(FILTER_PARAM_PREFIX))
      filters.push({ id: key.slice(FILTER_PARAM_PREFIX.length), value })
  }
  return filters
}

/** 없거나 정수가 아니거나 1 미만인 `page`/`pageSize` 는 첫 쪽·기본 쪽 크기로 접는다. */
function paginationFromParams(params: URLSearchParams): PaginationState {
  const rawPageSize = Number(params.get(PAGE_SIZE_PARAM))
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0 ? rawPageSize : DEFAULT_PAGE_SIZE
  const rawPage = Number(params.get(PAGE_PARAM))
  const pageIndex = Number.isInteger(rawPage) && rawPage > 0 ? rawPage - 1 : 0
  return { pageIndex, pageSize }
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
export function DataTable(props: { data: z.infer<typeof schema>[]; rowCount: number }) {
  return (
    <React.Suspense fallback={null}>
      <DataTableInner {...props} />
    </React.Suspense>
  )
}

function DataTableInner({
  data: initialData,
  rowCount,
}: {
  data: z.infer<typeof schema>[]
  rowCount: number
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // sorting · columnFilters · pagination 은 이제 URL 이 정본이다 - 로컬
  // useState 로 거울 상태를 만들지 않는다(두 원본이 어긋날 자리가 생긴다).
  // 매 렌더마다 현재 URL 에서 다시 읽는다.
  const sorting = sortingFromParams(searchParams)
  const columnFilters = columnFiltersFromParams(searchParams)
  const pagination = paginationFromParams(searchParams)
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  )
  const dataIds = React.useMemo<UniqueIdentifier[]>(() => data?.map(({ id }) => id) || [], [data])

  /** 현재 URL 파라미터를 복제해 고치고 그 결과로 옮겨간다(스크롤 위치는 유지). */
  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams)
    mutate(params)
    const query = params.toString()
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
  }

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    ...serverDrivenTableOptions(rowCount),
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      navigate((params) => {
        const token = sortingToToken(next)
        if (token === null) params.delete(SORT_PARAM)
        else params.set(SORT_PARAM, token)
      })
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      navigate((params) => {
        for (const key of new Set(params.keys())) {
          if (key.startsWith(FILTER_PARAM_PREFIX)) params.delete(key)
        }
        for (const filter of next) {
          if (typeof filter.value === 'string' && filter.value !== '') {
            params.set(`${FILTER_PARAM_PREFIX}${filter.id}`, filter.value)
          }
        }
      })
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      navigate((params) => {
        if (next.pageIndex === 0) params.delete(PAGE_PARAM)
        else params.set(PAGE_PARAM, String(next.pageIndex + 1))
        if (next.pageSize === DEFAULT_PAGE_SIZE) params.delete(PAGE_SIZE_PARAM)
        else params.set(PAGE_SIZE_PARAM, String(next.pageSize))
      })
    },
  })
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }
  return (
    <Tabs defaultValue="outline" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          defaultValue="outline"
          items={[
            { label: 'Outline', value: 'outline' },
            { label: 'Past Performance', value: 'past-performance' },
            { label: 'Key Personnel', value: 'key-personnel' },
            { label: 'Focus Documents', value: 'focus-documents' },
          ]}
        >
          <SelectTrigger className="flex w-fit @4xl/main:hidden" size="sm" id="view-selector">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="past-performance">Past Performance</SelectItem>
              <SelectItem value="key-personnel">Key Personnel</SelectItem>
              <SelectItem value="focus-documents">Focus Documents</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />
              Columns
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
          <Button variant="outline" size="sm">
            <PlusIcon />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
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
                      No results.
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
              정직한 값이다). 그 값을 "row(s) selected" 라고만 적으면 전체
              결과처럼 읽히므로 "on this page" 로 분모의 정체를 밝히고, 총
              건수(rowCount)를 별도로 덧붙인다.
            */}
            {table.getFilteredSelectedRowModel().rows.length} of {table.getRowModel().rows.length}{' '}
            row(s) on this page selected ({rowCount} total).
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
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
              Page {table.state.pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="past-performance" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="focus-documents" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  )
}
const chartData = [
  {
    month: 'January',
    desktop: 186,
    mobile: 80,
  },
  {
    month: 'February',
    desktop: 305,
    mobile: 200,
  },
  {
    month: 'March',
    desktop: 237,
    mobile: 120,
  },
  {
    month: 'April',
    desktop: 73,
    mobile: 190,
  },
  {
    month: 'May',
    desktop: 209,
    mobile: 130,
  },
  {
    month: 'June',
    desktop: 214,
    mobile: 140,
  },
]
const chartConfig = {
  desktop: {
    label: 'Desktop',
    color: 'var(--primary)',
  },
  mobile: {
    label: 'Mobile',
    color: 'var(--primary)',
  },
} satisfies ChartConfig
function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile()
  return (
    <Drawer swipeDirection={isMobile ? 'down' : 'right'}>
      <DrawerTrigger
        render={<Button variant="link" className="w-fit px-0 text-left text-foreground" />}
      >
        {item.header}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.header}</DrawerTitle>
          <DrawerDescription>Showing total visitors for the last 6 months</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: string) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <div className="flex gap-2 leading-none font-medium">
                  Trending up by 5.2% this month <TrendingUpIcon className="size-4" />
                </div>
                <div className="text-muted-foreground">
                  Showing total visitors for the last 6 months. This is just some random text to
                  test the layout. It spans multiple lines and should wrap around.
                </div>
              </div>
              <Separator />
            </>
          )}
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor="header">Header</Label>
              <Input id="header" defaultValue={item.header} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="type">Type</Label>
                <Select
                  defaultValue={item.type}
                  items={[
                    { label: 'Table of Contents', value: 'Table of Contents' },
                    { label: 'Executive Summary', value: 'Executive Summary' },
                    {
                      label: 'Technical Approach',
                      value: 'Technical Approach',
                    },
                    { label: 'Design', value: 'Design' },
                    { label: 'Capabilities', value: 'Capabilities' },
                    { label: 'Focus Documents', value: 'Focus Documents' },
                    { label: 'Narrative', value: 'Narrative' },
                    { label: 'Cover Page', value: 'Cover Page' },
                  ]}
                >
                  <SelectTrigger id="type" className="w-full">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Table of Contents">Table of Contents</SelectItem>
                      <SelectItem value="Executive Summary">Executive Summary</SelectItem>
                      <SelectItem value="Technical Approach">Technical Approach</SelectItem>
                      <SelectItem value="Design">Design</SelectItem>
                      <SelectItem value="Capabilities">Capabilities</SelectItem>
                      <SelectItem value="Focus Documents">Focus Documents</SelectItem>
                      <SelectItem value="Narrative">Narrative</SelectItem>
                      <SelectItem value="Cover Page">Cover Page</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="status">Status</Label>
                <Select
                  defaultValue={item.status}
                  items={[
                    { label: 'Done', value: 'Done' },
                    { label: 'In Progress', value: 'In Progress' },
                    { label: 'Not Started', value: 'Not Started' },
                  ]}
                >
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Done">Done</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Not Started">Not Started</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="target">Target</Label>
                <Input id="target" defaultValue={item.target} />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="limit">Limit</Label>
                <Input id="limit" defaultValue={item.limit} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Select
                defaultValue={item.reviewer}
                items={[
                  { label: 'Eddie Lake', value: 'Eddie Lake' },
                  { label: 'Jamik Tashpulatov', value: 'Jamik Tashpulatov' },
                  { label: 'Emily Whalen', value: 'Emily Whalen' },
                ]}
              >
                <SelectTrigger id="reviewer" className="w-full">
                  <SelectValue placeholder="Select a reviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                    <SelectItem value="Jamik Tashpulatov">Jamik Tashpulatov</SelectItem>
                    <SelectItem value="Emily Whalen">Emily Whalen</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
