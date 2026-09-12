import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  columnFiltersFromParams,
  describeSort,
  paginationFromParams,
  resolveSort,
  sortingFromParams,
  sortingToToken,
} from '@/components/data-table-query'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('sortingFromParams / sortingToToken', () => {
  it('내림차순 토큰을 왕복한다 - desc 플래그가 살아남는다', () => {
    const state = sortingFromParams(new URLSearchParams('sort=-title'))
    expect(state).toEqual([{ id: 'title', desc: true }])
    expect(sortingToToken(state)).toBe('-title')
  })

  it('정렬이 없으면 빈 배열이고, 빈 배열은 다시 null 로 돌아온다', () => {
    expect(sortingFromParams(new URLSearchParams())).toEqual([])
    expect(sortingToToken([])).toBeNull()
  })
})

describe('columnFiltersFromParams', () => {
  it('filter_ 접두사가 붙은 파라미터만 걷어 열 이름으로 되돌린다', () => {
    const params = new URLSearchParams('filter_status=active&sort=-title&page=2')
    expect(columnFiltersFromParams(params)).toEqual([{ id: 'status', value: 'active' }])
  })

  it('접두사가 없으면 걷지 않는다', () => {
    expect(columnFiltersFromParams(new URLSearchParams('status=active'))).toEqual([])
  })
})

describe('paginationFromParams', () => {
  it('없으면 첫 쪽·기본 쪽 크기로 접는다', () => {
    expect(paginationFromParams(new URLSearchParams())).toEqual({
      pageIndex: 0,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it('1-based page 를 0-based pageIndex 로 옮긴다', () => {
    const pagination = paginationFromParams(new URLSearchParams('page=3&pageSize=20'))
    expect(pagination).toEqual({ pageIndex: 2, pageSize: 20 })
  })

  it('0 이하·정수가 아닌 값은 기본값으로 접는다', () => {
    const pagination = paginationFromParams(new URLSearchParams('page=0&pageSize=abc'))
    expect(pagination).toEqual({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('상한(MAX_PAGE_SIZE)을 넘는 값은 자른다 - 이 값은 표 자신의 getPageCount() 에도 쓰인다', () => {
    // 이 클램프가 없으면(예전 상태) ?pageSize=500 인 URL 에서 표는
    // "500 개씩 250 건이니 1 쪽"이라고 그리는데 recentExamplesRequest 가
    // gridQuery 를 거쳐 백엔드에 보내는 값은 결국 100 으로 잘려 100 개만
    // 오고 150 개가 오류 없이 사라진다 - lib/grid/query.ts 의 MAX_PAGE_SIZE
    // 문서화와 같은 결함이다.
    const pagination = paginationFromParams(new URLSearchParams('pageSize=500'))
    expect(pagination.pageSize).toBe(100)
  })
})

describe('resolveSort', () => {
  it('URL 에 정렬이 없으면 수정일 내림차순이 기본이다 - "최근 수정" 목록의 정의', () => {
    expect(resolveSort(new URLSearchParams())).toBe('-updatedAt')
  })

  it('URL 에 정렬이 있으면 그 값을 따른다 - 기본값이 덮어쓰지 않는다', () => {
    expect(resolveSort(new URLSearchParams('sort=title'))).toBe('title')
  })
})

describe('describeSort', () => {
  it('기본 정렬을 한국어 한 줄로 옮긴다', () => {
    expect(describeSort(EXAMPLES, '-updatedAt')).toBe('수정일 내림차순')
  })

  it('오름차순도 옮긴다 - 부호가 빠지면 방향이 달라진다', () => {
    expect(describeSort(EXAMPLES, 'title')).toBe('제목 오름차순')
  })
})
