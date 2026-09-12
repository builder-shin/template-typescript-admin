import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, readGridState, writeGridState } from '@/lib/grid/state'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('readGridState', () => {
  it('빈 URL 에서 기본값을 낸다', () => {
    const state = readGridState(new URLSearchParams(), EXAMPLES)
    expect(state).toEqual({
      filters: {},
      sort: null,
      pageQuery: {},
      pageSize: DEFAULT_PAGE_SIZE,
      hiddenColumns: [],
    })
  })

  it('선언에 없는 필터 키를 버린다', () => {
    const state = readGridState(new URLSearchParams('title=abc&bogus=1'), EXAMPLES)
    expect(state.filters).toEqual({ title: 'abc' })
  })

  it('선언에 없는 정렬을 버린다', () => {
    expect(readGridState(new URLSearchParams('sort=-updatedAt'), EXAMPLES).sort).toBe('-updatedAt')
    expect(readGridState(new URLSearchParams('sort=-bogus'), EXAMPLES).sort).toBeNull()
  })

  it('쪽당 건수를 100 으로 제한한다', () => {
    expect(readGridState(new URLSearchParams('pageSize=1000'), EXAMPLES).pageSize).toBe(100)
  })

  it('왕복해도 같은 상태다', () => {
    const params = new URLSearchParams('title=abc&status=active&sort=-updatedAt&hide=tags')
    const state = readGridState(params, EXAMPLES)
    expect(readGridState(writeGridState(state), EXAMPLES)).toEqual(state)
  })

  it('선언에 없는 열은 숨김 목록에서도 버린다', () => {
    // hide 는 질의에 실리지 않지만(query.test.ts), 그래도 선언에 없는 열
    // 이름을 상태에 남겨 두면 사라진 열을 가리키는 죽은 값이 URL 에 계속
    // 왕복한다. filters·sort 와 같은 "선언에 없으면 버린다" 규칙을 hide 에도
    // 그대로 적용한다.
    const state = readGridState(new URLSearchParams('hide=tags,bogus'), EXAMPLES)
    expect(state.hiddenColumns).toEqual(['tags'])
  })

  it('왕복 - 모든 필드가 기본값이 아닌 상태도 그대로 돌아온다', () => {
    // 위 "왕복해도 같은 상태다" 는 pageQuery 가 항상 {}, pageSize 가 항상
    // DEFAULT_PAGE_SIZE 인 채로 통과한다 - 그 두 필드를 왕복하는 코드가
    // 통째로 없어도 같은 결과가 나온다. 필드마다 기본값이 아닌 값을 채워서
    // 그 구멍을 막는다.
    const params = new URLSearchParams(
      'title=abc&status=active&score=10&sort=-updatedAt' +
        '&hide=tags,description&pageSize=25&page%5Bafter%5D=cursor-1',
    )
    const state = readGridState(params, EXAMPLES)

    // 이 상태가 실제로 "속이 찬" 상태인지 먼저 못박는다 - 아래 왕복 단언이
    // 통과해도 각 필드가 빈 값끼리 왕복한 것이면 아무것도 증명하지 못한다.
    expect(Object.keys(state.filters).length).toBeGreaterThan(1)
    expect(state.sort).not.toBeNull()
    expect(Object.keys(state.pageQuery).length).toBeGreaterThan(0)
    expect(state.pageSize).not.toBe(DEFAULT_PAGE_SIZE)
    expect(state.hiddenColumns.length).toBeGreaterThan(1)

    expect(readGridState(writeGridState(state), EXAMPLES)).toEqual(state)
  })
})
