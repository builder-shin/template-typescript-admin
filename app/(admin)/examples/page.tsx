import { headers } from 'next/headers'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceGrid } from '@/components/grid/resource-grid'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { LOGIN_REDIRECT_PARAM } from '@/proxy'
import { messageForReadFailure } from '../read-result'
import { bulkDeleteExampleAction } from './actions'
import { listRequest, toSearchParams } from './list'

/**
 * `examples` 목록 화면 - 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 조립(경로·질의·Accept-Language)은 `listRequest` 하나로 모여 있다(./list.ts) -
 * 여기서 다시 쪼개면(예: gridQuery·resource.path·accept-language 를 각각
 * 부르면) 그중 하나를 지우는 뮤턴트가 이 화면에서는 잡히지 않는다 - 셋을
 * 따로 부르는 모양에서는 화면의 단위 테스트가 없어 셋 중 어느 것을 지워도
 * 게이트가 초록을 유지한다.
 *
 * `headers()` 는 요청 스코프를 요구해 vitest(node) 에서 던진다 - 이 저장소는
 * 그것을 스텁하지 않는 관례를 갖는다(app/(auth)/actions.ts 와 같은 이유).
 * 그래서 이 한 줄은 단위 테스트가 볼 수 없고, 실제로 넘어가는지는 로케일이
 * 다른 두 컨텍스트로 서는 E2E 의 몫이다.
 *
 * `bulkDeleteAction` 은 `./actions.ts` 가 이미 채운 Action 을 그대로 건넨다 -
 * `examples` 라는 이름은 이 화면과 `actions.ts` 안에만 있고, `ResourceGrid`
 * 는 그 이름을 몰라도 되는 Action 참조 하나만 받는다.
 *
 * `reauthHref` 도 여기서 완성해 건넨다 - `ResourceGrid` 는 클라이언트
 * 컴포넌트라 `proxy.ts`(그 안의 `LOGIN_REDIRECT_PARAM`)를 값으로 import 하면
 * `lib/auth/session.ts` 를 거쳐 `next/headers` 가 클라이언트 번들에 끌려
 * 들어간다(실측: `pnpm build` 가 그 자리에서 깨진다). 이 화면은 서버
 * 컴포넌트라 그 걱정이 없고, 마침 그리드의 현재 필터·정렬·페이지를 담은
 * `searchParams` 도 이미 갖고 있어 되돌아올 경로를 그대로 실을 수 있다.
 */
export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resource = resourceByType('examples')!
  const currentParams = toSearchParams(await searchParams)
  const result = await request<CollectionDocument>(
    ...listRequest(resource, currentParams, (await headers()).get('accept-language')),
  )

  // transport(실제로 백엔드에 못 닿음)만 던져서 error.tsx 를 띄운다(그
  // 파일의 "연결할 수 없다"는 고정 문구가 참이 되는 경우가 그것뿐이라서다) -
  // 그 외 백엔드가 실제로 낸 오류(예: 잘못된 정렬 파라미터의 검증 오류)는
  // 던지지 않고 배너로 그 자리에서 보여준다(messageForReadFailure, 폼이
  // 이미 하는 것과 같은 선택).
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

  const currentQuery = currentParams.toString()
  const currentUrl = currentQuery === '' ? '/examples' : `/examples?${currentQuery}`
  const reauthHref = `/login?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(currentUrl)}`

  return (
    <ResourceGrid
      resource={resource}
      document={result.document}
      bulkDeleteAction={bulkDeleteExampleAction}
      reauthHref={reauthHref}
      rowHrefBase="/examples"
    />
  )
}
