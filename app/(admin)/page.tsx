import { headers } from 'next/headers'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'
import { describeSort, resolveSort } from '@/components/data-table-query'
import { FormBanner } from '@/components/form/form-banner'
import { SectionCards, type ResourceCount } from '@/components/section-cards'
import { request, type JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { RESOURCES, resourceByType } from '@/lib/resources'
import { countRequest, readTotal } from './count'
import { classifyHealth, healthRequest } from './health'
import { toSearchParams } from './[slug]/list'
import { messageForReadFailure } from './read-result'
import { buildRecentRows, recentExamplesRequest } from './recent'

/**
 * 카운트 요청들과 최근 목록 공통의 "성공했고 본문이 있다" 를 한 곳에서
 * 확인한다 - `app/(admin)/[slug]/page.tsx` 의 두 단계 던지기(ok 확인 →
 * document 확인)와 같은 판단을 자원 수만큼 반복하지 않는다. 헬스 확인은
 * 이 함수를 거치지 않는다 - 그 확인은 실패 자체가 카드가 보여줄 유효한
 * 상태이지, `error.tsx` 로 이 화면 전체를 끌고 내려갈 예외가 아니다
 * (`classifyHealth` 가 그 실패를 더 갈라 "다운"과 "우리가 잘못 물었다"를
 * 구별한다 - ./health.ts).
 *
 * `!result.ok` 는 여기서 무조건 던지지 않는다 - 호출부(`Page`)가
 * `messageForReadFailure` 로 먼저 걸러(transport 는 던져 error.tsx 로, 그 외
 * 백엔드가 실제로 낸 오류는 배너로) 이 함수에 닿는 시점에는 `result.ok`
 * 라고 가정할 수 있다. 그래도 타입 단언(`!`)은 쓰지 않는다.
 */
function unwrap(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error('내부 오류: 실패한 결과가 unwrap 에 도달했습니다(호출부가 먼저 걸렀어야 한다).')
  }
  if (result.document === null) {
    throw new Error('응답에 본문이 없습니다.')
  }
  return result.document
}

/**
 * 대시보드 - 자원마다 카운트 하나 + 헬스 확인 + 최근 목록을 한 화면에서
 * 모은다. `headers()` 를 부르는 자리를 하나로 유지한다. 서로 의존하지
 * 않으므로 `Promise.all` 로 함께 보낸다.
 *
 * 카운트 카드는 `RESOURCES` 를 돈다 - 새 자원은 선언 하나로 카드를 얻는다.
 * **최근 표는 `examples` 에 묶여 있다** - `RecentRow`(./recent.ts)가
 * `title`·`status`·`score`·`updatedAt` 을 알고 그 표는 블록의 드래그 부품과
 * 함께 온 것이다. 차트와 같은 층위의 표본으로 남긴다(루트 `AGENTS.md` 의
 * "화면에는 보이지 않는 계약" 절) - `examples` 선언을 지우면 이 화면은 그
 * 자리에서 깨진다. 이 파일이 자원 이름을 코드로 아는 유일한 이유다.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const examples = resourceByType('examples')!
  const lang = (await headers()).get('accept-language')
  const params = toSearchParams(await searchParams)

  const [countResults, healthResult, recentResult] = await Promise.all([
    Promise.all(
      RESOURCES.map((resource) => request<CollectionDocument>(...countRequest(resource, lang))),
    ),
    request<Record<string, unknown>>(...healthRequest(lang)),
    request<CollectionDocument>(...recentExamplesRequest(examples, params, lang)),
  ])

  // 헬스는 뺀다(classifyHealth 가 실패 자체를 유효한 카드 상태로 다룬다 -
  // 위 unwrap 주석 참고). 나머지 중 하나라도 transport 면 messageForReadFailure
  // 가 여기서 던진다(error.tsx 로 간다). 그 외의 실패(백엔드가 실제로 낸
  // 오류)는 던지지 않고 문구를 돌려주므로, 화면 전체를 그 배너 하나로
  // 대체한다 - 카드별로 쪼개 그리지 않는 이유는 전부가 한 화면의 서로 다른
  // 조각일 뿐 사용자가 일부만 보고 판단할 수 있는 화면이 아니기 때문이다.
  for (const result of [...countResults, recentResult]) {
    if (result.ok) continue
    const message = messageForReadFailure(result.errors, '요청을 처리하지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  const counts: ResourceCount[] = RESOURCES.map((resource, position) => {
    const result = countResults[position]
    if (result === undefined) throw new Error('내부 오류: 자원 수와 카운트 결과 수가 다릅니다.')
    return {
      label: resource.label,
      href: `/${resource.slug}`,
      count: readTotal(unwrap(result)),
      writable: resource.writable,
    }
  })

  const recentDocument = unwrap(recentResult)
  const rows = buildRecentRows(recentDocument)
  const rowCount = readTotal(recentDocument)
  const sortLabel = describeSort(examples, resolveSort(params))

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards counts={counts} health={classifyHealth(healthResult)} />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive />
          </div>
          <DataTable data={rows} rowCount={rowCount} />
          {/* 스펙: 변경한 사람 열은 두지 않는다(감사로그 계약이 없다) - 대신
              실제로 적용된 정렬을 한 줄로 밝힌다. resolveSort/describeSort 를
              recentExamplesRequest 와 같이 써서 - 기본값이 여기와 질의 조립에
              따로 있으면 한쪽만 바뀌었을 때 이 문장이 거짓말을 하게 된다. */}
          <p className="px-4 text-sm text-muted-foreground lg:px-6">
            {sortLabel}으로 정렬되어 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
