'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, readOnlyAttributes, resourceBySlug } from '@/lib/resources'

/**
 * 상세 화면의 스켈레톤 - `page.tsx` 와 같은 레이아웃(폭 산수는 그 파일
 * 머리말). `useParams` 로 읽은 slug 의 선언에서 필드 수·관계 수·값 수를
 * 센다(`'use client'` 인 이유와 안전성은 `../loading.tsx` 머리말). `writable`
 * 이면 두 열, 아니면 카드 하나 - 본문과 같은 모양이라 로딩에서 본문으로
 * 넘어갈 때 내용이 뛰지 않는다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const relationshipCount = resource === undefined ? 0 : Object.keys(resource.relationships).length
  const fieldCount =
    resource === undefined ? 0 : formAttributes(resource).length + relationshipCount
  const readOnlyCount = resource === undefined ? 0 : readOnlyAttributes(resource).length
  const attributeCount = resource === undefined ? 0 : Object.keys(resource.attributes).length

  const header = (
    <div className="flex flex-col gap-4 border-b pb-5">
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-52" />
      </div>
    </div>
  )

  const relationshipRows = (
    <div className="flex flex-col gap-3">
      {Array.from({ length: relationshipCount }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  )

  if (resource === undefined || !resource.writable) {
    return (
      <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {header}
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {relationshipCount > 0 ? relationshipRows : null}
            <div className="flex flex-col gap-2">
              {Array.from({ length: attributeCount }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      {header}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-5">
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
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {relationshipCount > 0 ? relationshipRows : null}
              <div className="flex flex-col gap-2 border-t pt-4">
                {Array.from({ length: readOnlyCount }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
