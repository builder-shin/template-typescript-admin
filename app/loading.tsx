import { Skeleton } from '@/components/ui/skeleton'

/**
 * 로딩 상태에는 텍스트를 쓰지 않는다 - 스켈레톤 또는 스피너만 그린다.
 *
 * 이 파일은 app/ 루트의 Suspense 폴백이라 특정 자원의 목록/상세 모양을 모른다.
 * 자원별 목록/상세 스켈레톤은 각 라우트 세그먼트가 갖는 loading.tsx 의 몫이다 -
 * 여기서는 모양을 특정하지 않는 일반 스켈레톤만 그린다.
 */
export default function Loading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-8">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-4 w-56" />
    </main>
  )
}
