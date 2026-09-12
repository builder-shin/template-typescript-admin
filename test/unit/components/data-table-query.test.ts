import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  buildRecentRows,
  columnFiltersFromParams,
  describeSort,
  paginationFromParams,
  recentExamplesRequest,
  resolveSort,
  sortingFromParams,
  sortingToToken,
} from '@/components/data-table-query'
import type { CollectionDocument } from '@/lib/jsonapi/document'
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

describe('recentExamplesRequest', () => {
  it('경로는 자원의 것이다', () => {
    expect(recentExamplesRequest(EXAMPLES, new URLSearchParams(), null)[0]).toBe(EXAMPLES.path)
  })

  it('URL 에 정렬이 없으면 질의도 수정일 내림차순을 보낸다', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams(), null)
    expect(options.query?.get('sort')).toBe('-updatedAt')
  })

  it('URL 의 정렬을 바꾸면 질의의 정렬도 바뀐다 - 이 표의 정렬 컨트롤이 실제로 서버에 가닿는다는 증거', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams('sort=title'), null)
    expect(options.query?.get('sort')).toBe('title')
  })

  it('총합을 켜서 요청한다 - rowCount 계산에 필요하다', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams(), null)
    expect(options.query?.get('page[totals]')).toBe('true')
  })

  it('page/pageSize 를 page[number]/page[size] 로 옮긴다', () => {
    const [, options] = recentExamplesRequest(
      EXAMPLES,
      new URLSearchParams('page=3&pageSize=20'),
      null,
    )
    expect(options.query?.get('page[number]')).toBe('3')
    expect(options.query?.get('page[size]')).toBe('20')
  })

  it('선언된 필터 키는 자원의 uiOperator 로 옮겨진다', () => {
    const [, options] = recentExamplesRequest(
      EXAMPLES,
      new URLSearchParams('filter_status=active'),
      null,
    )
    expect(options.query?.get('filter[status][exact]')).toBe('active')
  })

  it('선언에 없는 필터 키는 버려진다 - 백엔드가 400 으로 거절하는 파라미터를 보내지 않는다', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams('filter_bogus=1'), null)
    const leaked = [...(options.query?.keys() ?? [])].some((key) => key.includes('bogus'))
    expect(leaked).toBe(false)
  })

  it('Accept-Language 를 넘기면 옵션에 실린다', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams(), 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = recentExamplesRequest(EXAMPLES, new URLSearchParams(), null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})

describe('buildRecentRows', () => {
  it('속성을 행으로 옮긴다', () => {
    const document: CollectionDocument = {
      data: [
        {
          type: 'examples',
          id: '1',
          attributes: {
            title: '첫 번째',
            status: 'active',
            score: 10,
            updatedAt: '2026-09-01T00:00:00+00:00',
          },
        },
      ],
    }
    expect(buildRecentRows(document)).toEqual([
      {
        id: '1',
        title: '첫 번째',
        status: 'active',
        score: 10,
        updatedAt: '2026-09-01T00:00:00+00:00',
      },
    ])
  })

  it('문서의 행 순서를 그대로 보존한다 - "정렬을 바꾸면 첫 행이 바뀐다"의 절반을 잰다', () => {
    // 나머지 절반(백엔드가 실제로 정렬해서 돌려주는지)은 이 저장소의 단위
    // 테스트가 볼 수 없는 영역이다(E2E 의 몫, examples/page.tsx 의 headers()
    // 와 같은 이유) - 이 테스트는 "이 변환이 순서를 뒤섞지 않는다"만
    // 보장한다. recentExamplesRequest 가 URL 의 sort 를 질의에 그대로
    // 옮긴다는 위 테스트와 합치면, 정렬을 바꿨을 때 표의 첫 행이 바뀌는
    // 경로 전체(URL → 질의 → 응답 순서 → 화면 순서)가 끊기지 않는다.
    const document: CollectionDocument = {
      data: [
        { type: 'examples', id: 'b', attributes: { title: 'B' } },
        { type: 'examples', id: 'a', attributes: { title: 'A' } },
      ],
    }
    expect(buildRecentRows(document).map((row) => row.id)).toEqual(['b', 'a'])
  })

  it('속성이 없으면 던지지 않고 빈 값으로 접는다', () => {
    const document: CollectionDocument = { data: [{ type: 'examples', id: '1' }] }
    expect(buildRecentRows(document)).toEqual([
      { id: '1', title: '', status: '', score: 0, updatedAt: '' },
    ])
  })

  it('속성의 타입이 선언과 다르면(score 가 문자열 등) 던지지 않고 빈 값으로 접는다', () => {
    const document: CollectionDocument = {
      data: [{ type: 'examples', id: '1', attributes: { score: '10' } }],
    }
    expect(buildRecentRows(document)[0]?.score).toBe(0)
  })
})
