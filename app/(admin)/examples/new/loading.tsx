import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, resourceByType } from '@/lib/resources'

/**
 * 생성 화면의 스켈레톤. 필드 수는 선언에서 센다 - 폼이 그리는 속성
 * (`formAttributes`)과 관계의 합이다. 박아 두면 선언과 갈라져 로딩에서
 * 본문으로 넘어갈 때 폼이 밀린다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const resource = resourceByType('examples')!
  const fieldCount = formAttributes(resource).length + Object.keys(resource.relationships).length

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
