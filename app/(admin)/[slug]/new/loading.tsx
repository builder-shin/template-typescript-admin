'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, resourceBySlug } from '@/lib/resources'

/**
 * 생성 화면의 스켈레톤. 필드 수는 `useParams` 로 읽은 slug 의 선언에서 센다 -
 * 폼이 그리는 속성(`formAttributes`)과 관계의 합이다(`'use client'` 인 이유와
 * 그 안전성은 `../loading.tsx` 머리말). 선언에 없거나 읽기 전용인 slug 면
 * 필드 0개다 - 곧 `notFound()` 가 온다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const fieldCount =
    resource === undefined || !resource.writable
      ? 0
      : formAttributes(resource).length + Object.keys(resource.relationships).length

  return (
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Skeleton className="h-8 w-24" />
      <div className="max-w-lg space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  )
}
