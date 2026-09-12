import { headers } from 'next/headers'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'
import {
  buildRecentRows,
  describeSort,
  recentExamplesRequest,
  resolveSort,
} from '@/components/data-table-query'
import { SectionCards } from '@/components/section-cards'
import { request, type JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { countRequest, readTotal } from './count'
import { classifyHealth, healthRequest } from './health'
import { toSearchParams } from './examples/list'

/**
 * 네 요청(카운트 셋 · 목록 하나) 공통의 "성공했고 본문이 있다" 를 한 곳에서
 * 확인한다 - `app/(admin)/examples/page.tsx` 의 두 단계 던지기(ok 확인 →
 * document 확인)와 같은 판단을 네 번 반복하지 않는다. 헬스 확인은 이 함수를
 * 거치지 않는다 - 그 확인은 실패 자체가 카드가 보여줄 유효한 상태이지,
 * `error.tsx` 로 이 화면 전체를 끌고 내려갈 예외가 아니다(`classifyHealth`가
 * 그 실패를 더 갈라 "다운"과 "우리가 잘못 물었다"를 구별한다 - ./health.ts).
 */
function unwrap(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error(result.errors[0]?.detail ?? '요청을 처리하지 못했습니다.')
  }
  if (result.document === null) {
    throw new Error('응답에 본문이 없습니다.')
  }
  return result.document
}

/**
 * 대시보드 - 블록의 데모 콘텐츠(카드 넷의 지어낸 지표·표에 먹이던 정적 JSON·
 * 하드코딩된 헤더)를 실제 계약으로 갈아끼운다.
 *
 * 카운트 셋 + 헬스 확인 + 최근 목록, 다섯 요청을 한 화면에서 모은다 -
 * `headers()` 를 부르는 자리를 하나로 유지한다(examples 화면과 같은 이유,
 * ./examples/list.ts 머리말). 서로 의존하지 않으므로 `Promise.all` 로 함께
 * 보낸다.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const examples = resourceByType('examples')!
  const categories = resourceByType('exampleCategories')!
  const tags = resourceByType('exampleTags')!
  const lang = (await headers()).get('accept-language')
  const params = toSearchParams(await searchParams)

  const [exampleCountResult, categoryCountResult, tagCountResult, healthResult, recentResult] =
    await Promise.all([
      request<CollectionDocument>(...countRequest(examples, lang)),
      request<CollectionDocument>(...countRequest(categories, lang)),
      request<CollectionDocument>(...countRequest(tags, lang)),
      request<Record<string, unknown>>(...healthRequest(lang)),
      request<CollectionDocument>(...recentExamplesRequest(examples, params, lang)),
    ])

  const exampleCount = readTotal(unwrap(exampleCountResult))
  const categoryCount = readTotal(unwrap(categoryCountResult))
  const tagCount = readTotal(unwrap(tagCountResult))

  const recentDocument = unwrap(recentResult)
  const rows = buildRecentRows(recentDocument)
  const rowCount = readTotal(recentDocument)
  const sortLabel = describeSort(examples, resolveSort(params))

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards
            exampleCount={exampleCount}
            categoryCount={categoryCount}
            tagCount={tagCount}
            health={classifyHealth(healthResult)}
          />
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
