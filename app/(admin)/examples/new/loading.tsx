import { Skeleton } from '@/components/ui/skeleton'

/**
 * 생성 화면의 로딩 스켈레톤 - 텍스트를 쓰지 않는다(전역 규칙, ../loading.tsx
 * 와 같은 원칙). 상세 화면과 달리 오른쪽 열("지금 저장된 값"·위험 구역)이
 * 없다 - 아직 만들지 않은 자원이라 보여줄 현재 값도, 지울 것도 없다. 그래서
 * 이 화면은 한 열로 남고 폼 자신의 `max-w-lg` 가 그대로 폭이 된다.
 *
 * 가운데로 모으는 래퍼 폭(`max-w-[35rem]`)은 `new/page.tsx` 와 같은 값이어야
 * 한다 - 한쪽만 가운데면 로딩에서 본문으로 넘어갈 때 화면이 좌우로 튄다.
 */
export default function Loading() {
  const fieldCount = 6

  return (
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-7 w-32" />

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
