import { withAcceptLanguage, type RequestOptions } from '@/lib/jsonapi/client'
import { gridQuery } from '@/lib/grid/query'
import { readGridState } from '@/lib/grid/state'
import type { ResourceDef } from '@/lib/resources'

/**
 * 목록 요청 조립을 함수 하나로 모은다 - 다시 쪼개지 마라.
 *
 * `resource.path`·`gridQuery`·`Accept-Language` 를 화면에서 각각 따로 부르는
 * 모양은 셋 중 하나를 지우는 뮤턴트가 단위 테스트 밖으로 빠져나가는 자리다
 * (형제 저장소에서 실제로 셋 다 살아남았다). 여기 모아 두면 세 값을 단위
 * 테스트의 `toEqual` 하나가 고정하고, 화면에 남는 무방비는 펼침 한 줄
 * (`request(...listRequest(...))`)뿐이다.
 *
 * 튜플을 돌려주는 이유는 복사해 온 `request<T>(path, options)` 가 인자를
 * 둘 받고 `RequestOptions.query` 가 `URLSearchParams` 이기 때문이다
 * (lib/jsonapi/client.ts). `withAcceptLanguage` 는 `acceptLanguage` 가
 * `null`/`undefined` 면 그대로 돌려주는 기존 헬퍼라 여기서 분기를 새로
 * 만들지 않는다.
 */
export function listRequest(
  resource: ResourceDef,
  params: URLSearchParams,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const state = readGridState(params, resource)
  const query = new URLSearchParams(gridQuery(resource, state))
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/**
 * Next 가 서버 컴포넌트에 건네는 `searchParams` (배열 값·`undefined` 를 가질
 * 수 있는 `Record`)를 `URLSearchParams` 로 정규화한다.
 *
 * 화면에 두지 않고 여기 두는 이유: 배열 값(`?status=a&status=b`)과
 * `undefined` 를 어떻게 다루는지가 필터 동작을 바꾸는 판단이다 - 화면에
 * 남으면 그 판단이 단위 테스트 밖으로 나간다.
 */
export function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one)
  }
  return params
}
