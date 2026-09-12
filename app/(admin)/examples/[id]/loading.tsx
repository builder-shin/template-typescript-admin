import { Skeleton } from '@/components/ui/skeleton'

/**
 * 상세 화면의 로딩 스켈레톤 - 텍스트를 쓰지 않는다(전역 규칙,
 * ../loading.tsx 와 같은 원칙). 뒤로 가기·제목·현재 관계·메타 카드·폼
 * 입력 6개(제목·설명·상태·점수·분류·라벨) 자리를 그대로 흉내 낸다 -
 * `[id]/edit-form.tsx` 의 입력 개수가 바뀌면 이 숫자도 함께 살펴야 한다.
 */
export default function Loading() {
  const fieldCount = 6

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-7 w-48" />

      <div className="space-y-3 rounded-xl border p-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="max-w-lg space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  )
}
