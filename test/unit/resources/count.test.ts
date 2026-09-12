import { describe, expect, it } from 'vitest'
import { countRequest, readTotal } from '@/lib/resources/count'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('자원 카운트', () => {
  it('한 건만 받고 총합을 켜서 받는다', () => {
    const [, options] = countRequest(EXAMPLES)
    expect(options.query?.get('page[size]')).toBe('1')
    expect(options.query?.get('page[totals]')).toBe('true')
  })

  it('include 를 싣지 않는다', () => {
    const [, options] = countRequest(EXAMPLES)
    expect(options.query?.get('include')).toBeNull()
  })

  it('경로는 그 자원의 것이다', () => {
    expect(countRequest(EXAMPLES)[0]).toBe(EXAMPLES.path)
  })

  it('meta.totalCount 를 읽는다', () => {
    expect(readTotal({ data: [], meta: { totalCount: 1284 } })).toBe(1284)
  })

  it('총합이 없으면 던진다 - 조용히 0 을 그리지 않는다', () => {
    expect(() => readTotal({ data: [] })).toThrow()
    expect(() => readTotal({ data: [], meta: {} })).toThrow()
  })

  it('Accept-Language 를 넘기면 그 값이 옵션에 실린다', () => {
    // 넘기지 않은 위 호출들과 대조되는 자리 - acceptLanguage 를 받아
    // withAcceptLanguage 에 위임하는 조립 자체가 지워지는 뮤턴트를 여기서
    // 잡는다(위 호출만으로는 acceptLanguage 인자가 아예 없어도 통과한다).
    const [, options] = countRequest(EXAMPLES, 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 를 넘기지 않으면(undefined) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = countRequest(EXAMPLES)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})
