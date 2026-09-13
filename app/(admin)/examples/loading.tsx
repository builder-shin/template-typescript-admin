import { Skeleton } from '@/components/ui/skeleton'
import { resourceByType } from '@/lib/resources'

/**
 * `examples` 목록의 로딩 스켈레톤 - 텍스트를 쓰지 않는다(전역 규칙, app/loading.tsx
 * 와 같은 원칙). 열 수는 `resource.columns.length` 에서 가져온다 - 여기 숫자를
 * 박으면 선언이 열을 더하거나 뺄 때마다 잊고 갈라질 수 있는 자리가 생긴다.
 *
 * 필터 바 자리도 같은 선언에서 센다(`resource.filters.length`) - 그 자리를
 * 비워 두면 로딩에서 본문으로 넘어갈 때 표가 필터 바 높이만큼 아래로
 * 밀린다.
 */
export default function Loading() {
  const resource = resourceByType('examples')!
  // 선택 열 하나가 항상 앞에 붙는다(ResourceGrid) - 스켈레톤도 같은 칸 수를 그린다.
  const columnCount = resource.columns.length + 1
  const rowCount = 8

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: resource.filters.length }, (_, index) => (
          <div key={index} className="flex w-44 flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex gap-2 border-b bg-muted p-2">
          {Array.from({ length: columnCount }, (_, index) => (
            <Skeleton key={index} className="h-5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rowCount }, (_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-2 border-b p-2 last:border-0">
            {Array.from({ length: columnCount }, (_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
