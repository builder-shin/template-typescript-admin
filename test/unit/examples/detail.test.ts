import { describe, expect, it } from 'vitest'
import { detailRequest } from '@/app/(admin)/examples/[id]/detail'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!
const CATEGORIES = resourceByType('exampleCategories')!

describe('detailRequest', () => {
  it('경로는 resource.path/id 이고 include·Accept-Language 를 함께 싣는다', () => {
    expect(detailRequest(EXAMPLES, 'abc', 'ko')).toEqual([
      `${EXAMPLES.path}/abc`,
      { query: new URLSearchParams({ include: 'category,tags' }), acceptLanguage: 'ko' },
    ])
  })

  it('resource.includes 가 비어 있으면(exampleCategories) include 자체를 싣지 않는다 - 실었다간 거절당한다', () => {
    // 실측: exampleCategories·exampleTags 는 includes 허용 목록이 빈
    // 집합이다(역참조가 순환을 만들어서 의도적으로 비웠다).
    const [, options] = detailRequest(CATEGORIES, 'c1', null)
    expect(options.query).toBeUndefined()
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = detailRequest(EXAMPLES, 'abc', null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})
