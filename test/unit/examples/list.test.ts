import { describe, expect, it } from 'vitest'
import { listRequest, toSearchParams } from '@/app/(admin)/examples/list'
import { gridQuery } from '@/lib/grid/query'
import { readGridState } from '@/lib/grid/state'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('toSearchParams', () => {
  it('문자열 값을 그대로 옮긴다', () => {
    expect(toSearchParams({ title: 'abc' }).get('title')).toBe('abc')
  })

  it('배열 값은 같은 키로 여러 번 실어 ?status=a&status=b 를 만든다', () => {
    expect(toSearchParams({ status: ['a', 'b'] }).getAll('status')).toEqual(['a', 'b'])
  })

  it('undefined 값은 키 자체를 만들지 않는다', () => {
    expect(toSearchParams({ title: undefined }).has('title')).toBe(false)
  })
})

describe('listRequest', () => {
  it('경로·질의·Accept-Language 를 한 호출에서 조립한다 - 셋 중 하나를 지우면 이 하나가 잡는다', () => {
    const params = new URLSearchParams('title=abc&sort=-updatedAt')
    const state = readGridState(params, EXAMPLES)
    const expectedQuery = new URLSearchParams(gridQuery(EXAMPLES, state))

    expect(listRequest(EXAMPLES, params, 'ko')).toEqual([
      EXAMPLES.path,
      { query: expectedQuery, acceptLanguage: 'ko' },
    ])
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = listRequest(EXAMPLES, new URLSearchParams(), null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })

  it('선언에 없는 필터 키는 readGridState 를 거쳐 질의에서 버려진다', () => {
    // gridQuery 를 params 에서 직접 만들지 않고 readGridState 를 먼저 거치는지
    // 재는 테스트다 - 우회해서 만들면(예: params 를 그대로 펼치면) bogus 가
    // 새어 나가 백엔드가 400 INVALID_QUERY_PARAMETER 로 거절한다.
    const [, options] = listRequest(EXAMPLES, new URLSearchParams('bogus=1'), null)
    expect(options.query?.has('bogus')).toBe(false)
  })
})
