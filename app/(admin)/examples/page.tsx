import { headers } from 'next/headers'
import { ResourceGrid } from '@/components/grid/resource-grid'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
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
 */
export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resource = resourceByType('examples')!
  const result = await request<CollectionDocument>(
    ...listRequest(
      resource,
      toSearchParams(await searchParams),
      (await headers()).get('accept-language'),
    ),
  )

  // 읽기 경로는 던져서 error.tsx 를 띄우는 쪽을 고른다(lib/jsonapi/client.ts
  // 의 request() 문서화된 선택지) - 목록 조회 실패에서 사용자가 이 화면
  // 안에서 스스로 고칠 수 있는 것이 없다.
  if (!result.ok) {
    throw new Error(result.errors[0]?.detail ?? '목록을 불러오지 못했습니다.')
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙) -
  // 목록 GET 은 204 를 주지 않지만 타입은 그 분기를 여전히 포함한다.
  if (result.document === null) {
    throw new Error('목록 응답에 본문이 없습니다.')
  }

  return (
    <ResourceGrid
      resource={resource}
      document={result.document}
      bulkDeleteAction={bulkDeleteExampleAction}
    />
  )
}
