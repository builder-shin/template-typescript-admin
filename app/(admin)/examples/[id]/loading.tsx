import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * 상세 화면의 로딩 스켈레톤 - 텍스트를 쓰지 않는다(전역 규칙,
 * ../loading.tsx 와 같은 원칙).
 *
 * 카드 껍데기를 손으로 그리지 않고 `Card`·`CardHeader`·`CardContent` 를
 * 그대로 쓴다 - 여백·모서리·테두리를 흉내 낸 클래스를 따로 적으면 그 사본이
 * 카드 primitive 와 조용히 어긋나고, 어긋난 쪽이 로딩에서 본문으로 넘어갈 때
 * 화면이 튀는 것으로만 드러난다. 같은 이유로 두 열의 트랙 폭과 경계(`xl`)는
 * `page.tsx` 와 같은 값을 쓴다(그 화면 머리말이 왜 34rem·17rem·`xl` 인지를
 * 적어 둔다).
 *
 * 폼 입력 6개(제목·설명·상태·점수·분류·라벨) 자리를 센다 -
 * `[id]/edit-form.tsx` 의 입력 개수가 바뀌면 이 숫자도 함께 살펴야 한다.
 */
export default function Loading() {
  const fieldCount = 6

  return (
    <div className="flex flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-4 border-b pb-5">
        <Skeleton className="h-7 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>

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
            <div className="flex gap-2 pt-2">
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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-7 w-14" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
