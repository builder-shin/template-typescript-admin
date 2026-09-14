import { headers } from 'next/headers'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceGrid } from '@/components/grid/resource-grid'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { LOGIN_REDIRECT_PARAM } from '@/proxy'
import { messageForReadFailure } from '../read-result'
import { bulkDeleteResourceAction } from './actions'
import { listRequest, toSearchParams } from './list'
import { filterOptionsFromResults, relationshipFilterRequests } from './options'
import { resourceFromSlug } from './resource'

/**
 * 선언된 어느 자원이든 그리는 목록 화면 - 첫 줄이 `resourceFromSlug` 다
 * (./resource.ts, 선언에 없으면 404). 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 조립(경로·질의·Accept-Language)은 `listRequest` 하나로 모여 있다(./list.ts) -
 * 여기서 다시 쪼개면 그중 하나를 지우는 뮤턴트가 이 화면에서는 잡히지
 * 않는다(화면 자신은 단위 테스트 대상이 아니다 - `headers()` 가 요청
 * 스코프를 요구해 vitest(node)에서 던지고, 이 저장소는 그것을 스텁하지 않는
 * 관례를 갖는다). 실제로 넘어가는지는 로케일이 다른 두 컨텍스트로 서는
 * E2E 의 몫이다.
 *
 * 관계 필터(키가 `관계.id`)의 보기 목록은 관계마다 대상 자원을 병행 조회하고
 * **실패하면 접는다**(`filterOptionsFromResults`) - 이 화면의 일은 행을
 * 보여 주는 것이고, 필터 드롭다운을 못 채운 것 때문에 목록을 가리면 더
 * 나쁘다. 접히면 그 필터는 텍스트 입력으로 떨어져 운영자가 id 를 직접
 * 넣을 수 있다.
 *
 * `writable` 일 때만 `bulkDeleteAction`(slug 를 bind 한 Server Action)과
 * `newHref` 를 넘긴다 - 그리드는 그 둘의 유무로 선택 열과 "새로 만들기"를
 * 그린다(`components/grid/resource-grid.tsx`). 읽기 전용 자원은 둘 다
 * 넘기지 않는다. 어느 자원인지 판단하는 것은 이 화면(선언의 `writable`)이지
 * 그리드가 아니다.
 *
 * `reauthHref` 도 여기서 완성해 건넨다 - `ResourceGrid` 는 클라이언트
 * 컴포넌트라 `proxy.ts`(그 안의 `LOGIN_REDIRECT_PARAM`)를 값으로 import 하면
 * `lib/auth/session.ts` 를 거쳐 `next/headers` 가 클라이언트 번들에 끌려
 * 들어간다(실측: `pnpm build` 가 그 자리에서 깨진다).
 */
export default async function ResourceListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const resource = resourceFromSlug(slug)
  const currentParams = toSearchParams(await searchParams)
  const lang = (await headers()).get('accept-language')
  const plans = relationshipFilterRequests(resource, lang)

  // 목록과 보기 목록들은 서로 의존하지 않는다 - 함께 보낸다
  // (app/(admin)/page.tsx 가 여러 요청을 묶는 것과 같은 이유).
  const [result, optionResults] = await Promise.all([
    request<CollectionDocument>(...listRequest(resource, currentParams, lang)),
    Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  ])

  // transport(실제로 백엔드에 못 닿음)만 던져서 error.tsx 를 띄운다 - 그 외
  // 백엔드가 실제로 낸 오류(예: 잘못된 정렬 파라미터의 검증 오류)는 던지지
  // 않고 배너로 그 자리에서 보여준다(messageForReadFailure).
  if (!result.ok) {
    const message = messageForReadFailure(result.errors, '목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙) -
  // 목록 GET 은 204 를 주지 않지만 타입은 그 분기를 여전히 포함한다.
  if (result.document === null) {
    throw new Error('목록 응답에 본문이 없습니다.')
  }

  const filterOptions = filterOptionsFromResults(plans, optionResults)
  const base = `/${resource.slug}`
  const currentQuery = currentParams.toString()
  const currentUrl = currentQuery === '' ? base : `${base}?${currentQuery}`
  const reauthHref = `/login?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(currentUrl)}`

  return (
    <ResourceGrid
      resource={resource}
      document={result.document}
      reauthHref={reauthHref}
      rowHrefBase={base}
      // 키 자체를 넘기지 않는다(exactOptionalPropertyTypes - undefined 로 채우지
      // 않는다). 보기 목록이 하나도 안 접혔으면 그리드가 필터 전부를 텍스트
      // 입력으로 그린다.
      {...(Object.keys(filterOptions).length === 0 ? {} : { filterOptions })}
      {...(resource.writable
        ? {
            bulkDeleteAction: bulkDeleteResourceAction.bind(null, resource.slug),
            newHref: `${base}/new`,
          }
        : {})}
    />
  )
}
