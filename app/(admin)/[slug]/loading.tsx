'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { resourceBySlug } from '@/lib/resources'

/**
 * 목록의 로딩 스켈레톤. `'use client'` 인 이유는 `useParams` 하나다 -
 * `loading.tsx` 는 인자를 받지 않지만(Next 문서 `loading.md`: "Loading UI
 * components do not accept any parameters") 클라이언트 컴포넌트가 될 수
 * 있고, 그 안에서 `useParams` 로 지금 slug 를 읽어 열 수·필터 수를 선언에서
 * 센다. `lib/resources` 는 내부 모듈을 하나도 import 하지 않아 클라이언트
 * 번들에 들어가도 서버 전용 코드에 닿지 않는다
 * (`test/unit/components/boundary-policy.test.ts` 둘째 방향이 잰다).
 * `useParams` 가 Suspense 를 요구하는 것은 `cacheComponents` 가 켜졌을
 * 때뿐이다 - 이 저장소는 켜지 않는다(`next.config.ts`).
 *
 * 선언에 없는 slug 면 열·필터 0개짜리 스켈레톤이다 - 곧 `notFound()` 가
 * 온다. 선택 열은 쓰기 가능 자원에만 있다(`ResourceGrid` 가 `bulkDeleteAction`
 * 을 받을 때만 그린다) - 스켈레톤도 같은 칸 수를 그린다. 툴바 오른쪽도
 * 같다 - 쓰기 가능이면 "새로 만들기"와 "열" 둘, 아니면 "열" 하나. 텍스트는
 * 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const writable = resource?.writable ?? false
  const filterCount = resource?.filters.length ?? 0
  const columnCount = resource === undefined ? 0 : resource.columns.length + (writable ? 1 : 0)
  const rowCount = 8

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-2">
          {writable ? <Skeleton className="h-8 w-28" /> : null}
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: filterCount }, (_, index) => (
          <div key={index} className="flex w-44 flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        {filterCount > 0 ? <Skeleton className="h-8 w-16" /> : null}
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
