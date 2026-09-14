import Link from 'next/link'
import { healthLabel, type HealthStatus } from '@/app/(admin)/health'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 대시보드 카드 - 선언된 자원마다 총합 하나, 그리고 백엔드 상태 하나
 * (`/health/ready` 도 계약에 있는 표면이고 운영자가 가장 먼저 묻는 것이다).
 *
 * 순수 렌더링이다 - 카운트 목록과 헬스 상태를 모두 props 로 받는다. 이
 * 컴포넌트 자신은 아무 것도 fetch 하지 않는다 - `app/(admin)/page.tsx` 가
 * `RESOURCES` 마다 `countRequest` 를 병행하고 `headers()` 를 부르는 자리를
 * 화면 하나로 유지한다. 예전에는 `exampleCount`·`categoryCount`·`tagCount`
 * 세 prop 을 받았다 - 자원이 늘면 이 파일을 고쳐야 했고, 그것이 스펙 2.1
 * 이 "손으로 쓴다"에 세어 둔 자리다.
 *
 * `health` 는 불리언이 아니라 `HealthStatus`(healthy/down/unexpected) 다 -
 * `app/(admin)/health.ts` 의 `classifyHealth` 가 "다운"과 "우리가 잘못
 * 물었다(예: 잘못된 경로)"를 구별해서 건네준다.
 *
 * 블록 원본의 추세 배지와 추세 문장은 지웠다 - 우리 계약에 과거 데이터도
 * 지표 엔드포인트도 없어 그 숫자를 계산할 방법이 없다. 카드의 레이아웃과
 * 타이포그래피는 블록이 쓰던 것 그대로다.
 *
 * 읽기 전용 자원 카드에는 `CardFooter` 에 "읽기 전용"을 적는다 - 그 자원은
 * 목록·상세는 있지만 만들기·수정·삭제가 없다(선언의 `writable`). 쓰기
 * 가능 자원·헬스 카드에는 적을 말이 없어 `CardFooter` 자체를 두지 않는다.
 * 카드의 자원 이름이 그 자원의 목록으로 가는 링크다 - 사이드바와 같은 목적지다.
 */
export interface ResourceCount {
  readonly label: string
  readonly href: string
  readonly count: number
  readonly writable: boolean
}

export interface SectionCardsProps {
  readonly counts: readonly ResourceCount[]
  readonly health: HealthStatus
}

export function SectionCards({ counts, health }: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {counts.map((item) => (
        <Card key={item.href} className="@container/card">
          <CardHeader>
            <CardDescription>
              <Link href={item.href} className="hover:underline">
                {item.label} 총합
              </Link>
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.count}
            </CardTitle>
          </CardHeader>
          {item.writable ? null : (
            <CardFooter className="text-sm text-muted-foreground">읽기 전용</CardFooter>
          )}
        </Card>
      ))}
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
