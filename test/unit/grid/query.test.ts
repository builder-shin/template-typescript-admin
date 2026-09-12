import { describe, expect, it } from 'vitest'
import { gridQuery } from '@/lib/grid/query'
import { readGridState } from '@/lib/grid/state'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('gridQuery', () => {
  it('선언된 연산자로 필터를 조립하고 include 를 반드시 싣는다', () => {
    const state = readGridState(
      new URLSearchParams('title=abc&status=active&sort=-updatedAt'),
      EXAMPLES,
    )
    expect(gridQuery(EXAMPLES, state)).toEqual({
      'filter[title][contains]': 'abc',
      'filter[status][exact]': 'active',
      sort: '-updatedAt',
      'page[size]': '50',
      'page[totals]': 'true',
      include: 'category,tags',
    })
  })

  it('총합을 항상 요청한다 - 표가 전체 쪽 수를 계산해야 한다', () => {
    const state = readGridState(new URLSearchParams(), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['page[totals]']).toBe('true')
  })

  it('관계 필터는 점을 포함한 키를 그대로 쓴다', () => {
    const state = readGridState(new URLSearchParams('category.id=7c1f'), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['filter[category.id][exact]']).toBe('7c1f')
  })

  it('커서 질의를 해석하지 않고 그대로 전달한다', () => {
    const state = readGridState(new URLSearchParams('page%5Bafter%5D=opaque-token'), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['page[after]']).toBe('opaque-token')
  })

  it('숨긴 열은 질의에 영향을 주지 않는다', () => {
    const shown = gridQuery(EXAMPLES, readGridState(new URLSearchParams(), EXAMPLES))
    const hidden = gridQuery(EXAMPLES, readGridState(new URLSearchParams('hide=tags'), EXAMPLES))
    expect(hidden).toEqual(shown)
  })

  it('커서가 앞뒤 두 방향이어도 둘 다 그대로 전달한다', () => {
    // 위 테스트는 page[after] 하나만 잰다 - pageQuery 가 항상 값 하나만
    // 옮기는 특수 경로가 아니라 실제로 딕셔너리를 그대로 펼치는지 확인한다.
    const state = readGridState(
      new URLSearchParams('page%5Bafter%5D=next-token&page%5Bbefore%5D=prev-token'),
      EXAMPLES,
    )
    const query = gridQuery(EXAMPLES, state)
    expect(query['page[after]']).toBe('next-token')
    expect(query['page[before]']).toBe('prev-token')
  })

  it('include 가 없는 자원은 include 파라미터를 내지 않는다', () => {
    // examples 는 includes 가 둘이라 위 테스트들이 전부 include 를 낸다.
    // includes: [] 인 참조 자원에서는 그 키 자체가 없어야 한다 - 빈
    // include= 를 보내는 것과 아예 안 보내는 것은 다른 질문이다.
    const categories = resourceByType('exampleCategories')!
    const state = readGridState(new URLSearchParams(), categories)
    expect(gridQuery(categories, state)).not.toHaveProperty('include')
  })
})
