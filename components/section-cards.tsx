import { healthLabel, type HealthStatus } from '@/app/(admin)/health'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 대시보드 카드 넷 - 셋은 자원 총합(examples·분류·라벨), 넷째는 백엔드 상태다
 * (`/health/ready`도 계약에 있는 표면이고 운영자가 가장 먼저 묻는 것이다).
 *
 * 순수 렌더링이다 - 카운트 셋과 헬스 상태 하나를 모두 props 로 받는다. 이
 * 컴포넌트 자신은 아무 것도 fetch 하지 않는다 - `app/(admin)/page.tsx` 가 세
 * 카운트 요청과 헬스 확인을 모아 `headers()` 를 부르는 자리를 화면 하나로
 * 유지한다(`app/(admin)/examples/list.ts` 의 listRequest 와 같은 이유).
 * `health` 는 불리언이 아니라 `HealthStatus`(healthy/down/unexpected) 다 -
 * `app/(admin)/health.ts` 의 `classifyHealth` 가 "다운"과 "우리가 잘못
 * 물었다(예: 잘못된 경로)"를 구별해서 건네준다.
 *
 * 블록 원본의 추세 배지(`CardAction` 안의 `+12.5%` 류)와 `CardFooter` 의 추세
 * 문장은 지웠다 - 우리 계약에 과거 데이터도 지표 엔드포인트도 없어 그 숫자를
 * 계산할 방법이 없다. 지어내는 대신 없앴다. `CardAction` 이 통째로 비므로
 * 그 자리 자체를 지웠다 - 빈 배지를 남기지 않는다. 카드의 레이아웃과
 * 타이포그래피(`text-2xl`·`tabular-nums`·`@[250px]/card:text-3xl`·
 * `@container/card`)는 블록이 쓰던 것 그대로다.
 *
 * 참조 자원(분류·라벨) 카드에는 `CardFooter` 에 "읽기 전용"을 적는다 - 이
 * 둘은 `examples` 의 배지·필터가 참조할 이름을 조회하는 용도일 뿐 쓰기
 * 자원이 아니다(lib/resources/category.ts·tag.ts 의 `writable: false`).
 * examples·헬스 카드에는 적을 말이 없어 `CardFooter` 자체를 두지 않는다 -
 * `CardAction` 과 같은 원칙이다.
 */
export interface SectionCardsProps {
  readonly exampleCount: number
  readonly categoryCount: number
  readonly tagCount: number
  readonly health: HealthStatus
}

export function SectionCards({ exampleCount, categoryCount, tagCount, health }: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>예제 총합</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {exampleCount}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>분류 총합</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {categoryCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">읽기 전용</CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>라벨 총합</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {tagCount}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">읽기 전용</CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>백엔드 상태</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {healthLabel(health)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
