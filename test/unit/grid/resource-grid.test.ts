import { describe, expect, it } from 'vitest'
import {
  buildRows,
  extractCell,
  formatDateTime,
  pageHref,
  readRowCount,
  relationshipLabel,
  sortingStateFromToken,
  sortTokenFromState,
} from '@/components/grid/resource-grid'
import { indexResources } from '@/lib/jsonapi/normalize'
import type { CollectionDocument, ResourceObject } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!
const TITLE = EXAMPLES.columns.find((column) => column.key === 'title')!
const CATEGORY = EXAMPLES.columns.find((column) => column.key === 'category')!
const TAGS = EXAMPLES.columns.find((column) => column.key === 'tags')!

/** href 의 질의 부분만 URLSearchParams 로 되돌린다 - 상대 경로라 더미 베이스가 필요하다. */
function paramsOf(href: string): URLSearchParams {
  return new URL(href, 'http://x.invalid').searchParams
}

describe('pageHref', () => {
  it('커서가 이전 위치를 대체한다 - 나란히 쌓이지 않는다', () => {
    const current = new URLSearchParams('page%5Bafter%5D=old-cursor&sort=-updatedAt')
    const href = pageHref(
      '/examples',
      current,
      '/api/v1/examples?page%5Bafter%5D=new-cursor&sort=-updatedAt',
    )
    expect(href).not.toBeNull()
    expect(paramsOf(href!).getAll('page[after]')).toEqual(['new-cursor'])
  })

  it('링크가 반대 방향 커서만 주면 이전 방향 커서는 지워진다', () => {
    // 앞/뒤 두 키가 독립적으로 지워지는지, 같은 이름의 키만 지워지는 게
    // 아닌지를 잰다 - page[before]가 남아 있으면 다음 요청이 두 방향
    // 커서를 동시에 보내 백엔드가 어느 쪽을 따를지 알 수 없다.
    const current = new URLSearchParams('page%5Bbefore%5D=old-prev-cursor')
    const href = pageHref('/examples', current, '/api/v1/examples?page%5Bafter%5D=new-next-cursor')
    const params = paramsOf(href!)
    expect(params.has('page[before]')).toBe(false)
    expect(params.get('page[after]')).toBe('new-next-cursor')
  })

  it('필터·정렬·숨긴 열처럼 page 가 아닌 파라미터는 지금 URL 그대로 살아남는다', () => {
    // 링크에도 sort=title 이 실려 있다 - 실제 backend 링크는 그 쪽을 만든
    // 질의 전체(필터·정렬·include 포함)를 echo 하지, 커서만 담지 않는다.
    // 그런데도 우리는 링크의 sort 가 아니라 **지금 URL**의 sort 를 지켜야
    // 한다 - pageHref 는 위치만 옮기고 나머지 상태의 정본은 여전히 현재
    // URL 이기 때문이다. 링크의 sort=title 을 그대로 썼다면 이 테스트가
    // 잡는다.
    const current = new URLSearchParams('title=abc&sort=-updatedAt&hide=tags')
    const href = pageHref(
      '/examples',
      current,
      '/api/v1/examples?page%5Bafter%5D=next-cursor&sort=title',
    )
    const params = paramsOf(href!)
    expect(params.get('title')).toBe('abc')
    expect(params.get('hide')).toBe('tags')
    expect(params.get('page[after]')).toBe('next-cursor')
    // getAll 로 잰다 - .get()은 첫 값만 보므로 링크의 sort=title 이
    // 필터링 없이 뒤에 append 되어도(값이 둘이 돼도) 앞쪽 값만 보면
    // 통과해 버린다. 이 자리가 실제로 그렇게 새는 뮤턴트를 하나 놓쳤었다.
    expect(params.getAll('sort')).toEqual(['-updatedAt'])
  })

  it('커서 값은 내용을 해석하지 않고 그대로 옮긴다', () => {
    // base64 스러운(패딩 '=' 포함) 불투명 토큰 - 이 계층이 값을 디코딩하거나
    // 다시 인코딩하면(스펙이 금지하는 일) 이 문자열이 바뀐다.
    const OPAQUE = 'MTIzNDU2Nzg5MA=='
    const href = pageHref(
      '/examples',
      new URLSearchParams(),
      `/api/v1/examples?page%5Bafter%5D=${encodeURIComponent(OPAQUE)}`,
    )
    expect(paramsOf(href!).get('page[after]')).toBe(OPAQUE)
  })

  it('링크가 없으면(null/undefined) null 을 돌려준다', () => {
    expect(pageHref('/examples', new URLSearchParams(), null)).toBeNull()
    expect(pageHref('/examples', new URLSearchParams(), undefined)).toBeNull()
  })
})

describe('readRowCount', () => {
  it('meta.totalCount 를 읽는다', () => {
    expect(readRowCount({ data: [], meta: { totalCount: 1284 } })).toBe(1284)
  })

  it('meta 자체가 없으면 던진다 - 조용히 0 을 그리지 않는다', () => {
    expect(() => readRowCount({ data: [] })).toThrow()
  })

  it('meta 는 있는데 totalCount 키가 없으면 던진다', () => {
    expect(() => readRowCount({ data: [], meta: {} })).toThrow()
  })
})

describe('sortingStateFromToken / sortTokenFromState', () => {
  it('내림차순 토큰을 왕복한다 - desc 플래그가 살아남는다', () => {
    const state = sortingStateFromToken('-updatedAt')
    expect(state).toEqual([{ id: 'updatedAt', desc: true }])
    expect(sortTokenFromState(state)).toBe('-updatedAt')
  })

  it('오름차순 토큰을 왕복한다 - desc:false 도 지워지지 않고 살아남는다', () => {
    const state = sortingStateFromToken('updatedAt')
    expect(state).toEqual([{ id: 'updatedAt', desc: false }])
    expect(sortTokenFromState(state)).toBe('updatedAt')
  })

  it('정렬이 없으면(null) 빈 배열이고, 빈 배열은 다시 null 로 돌아온다', () => {
    // 이 경우만 보면 왕복이 트리비얼하게 통과한다(항상 비어 있으므로) - 그래서
    // 위 두 테스트가 실제 값을 담은 왕복을 먼저 잰다.
    expect(sortingStateFromToken(null)).toEqual([])
    expect(sortTokenFromState([])).toBeNull()
  })
})

describe('extractCell', () => {
  it('attributes 자체가 없는 자원 객체는 던지지 않고 null 을 낸다', () => {
    const object: ResourceObject = { type: 'examples', id: '1' }
    expect(extractCell(TITLE, object, indexResources([]))).toBeNull()
  })

  it('일반 속성은 그대로 옮긴다', () => {
    const object: ResourceObject = { type: 'examples', id: '1', attributes: { title: '제목' } }
    expect(extractCell(TITLE, object, indexResources([]))).toBe('제목')
  })

  it('관계 키 자체가 응답에 없으면(포함되지 않음) null 을 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = { type: 'examples', id: '1' }
    expect(extractCell(CATEGORY, object, indexResources([]))).toBeNull()
  })

  it('to-one 관계가 비어 있으면(data: null) null 을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: null } },
    }
    expect(extractCell(CATEGORY, object, indexResources([]))).toBeNull()
  })

  it('included 로 풀린 to-one 관계는 이름을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: { type: 'exampleCategories', id: '7' } } },
    }
    const index = indexResources([
      { type: 'exampleCategories', id: '7', attributes: { name: '분류A' } },
    ])
    expect(extractCell(CATEGORY, object, index)).toBe('분류A')
  })

  it('included 에 없는 to-one 관계는 식별자 id 를 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { category: { data: { type: 'exampleCategories', id: '7' } } },
    }
    expect(extractCell(CATEGORY, object, indexResources([]))).toBe('7')
  })

  it('included 에 없는 to-many 관계는 식별자 id 배열을 낸다 - 던지지 않는다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: {
        tags: {
          data: [
            { type: 'exampleTags', id: 'a' },
            { type: 'exampleTags', id: 'b' },
          ],
        },
      },
    }
    expect(extractCell(TAGS, object, indexResources([]))).toEqual(['a', 'b'])
  })

  it('빈 to-many 관계는 빈 배열을 낸다', () => {
    const object: ResourceObject = {
      type: 'examples',
      id: '1',
      relationships: { tags: { data: [] } },
    }
    expect(extractCell(TAGS, object, indexResources([]))).toEqual([])
  })
})

describe('relationshipLabel', () => {
  it('included 로 풀린 자원 객체는 attributes.name 을 낸다', () => {
    expect(
      relationshipLabel({ type: 'exampleCategories', id: '7', attributes: { name: '분류A' } }),
    ).toBe('분류A')
  })

  it('식별자뿐이면(included 밖) id 로 대신한다 - 던지지 않는다', () => {
    // {type, id} 뿐인 값은 isResourceObject 가 false 를 내는 자리다 -
    // extractCell 의 "included 에 없는 관계는 식별자 id 를 낸다" 테스트와
    // 같은 경계를 이 함수 자신에 대해서도 잰다.
    expect(relationshipLabel({ type: 'exampleCategories', id: '7' })).toBe('7')
  })

  it('자원 객체이지만 attributes.name 이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    // 위 테스트와 다른 경로다 - 여기서는 isResourceObject 가 true 다
    // (attributes 멤버가 있다). 그런데도 name 이 문자열이 아니라서 여전히
    // id 로 떨어져야 한다 - "자원 객체인가"와 "이름이 있는가"를 같은
    // 조건으로 뭉뚱그리면(예: `isResourceObject(target)` 만으로 분기하면)
    // 이 케이스에서 `target.attributes.name`(undefined)을 그대로 반환해
    // 실패한다.
    expect(relationshipLabel({ type: 'exampleCategories', id: '7', attributes: {} })).toBe('7')
  })
})

describe('formatDateTime', () => {
  it('ISO 문자열을 "YYYY-MM-DD HH:mm" 로 다듬는다', () => {
    expect(formatDateTime('2026-09-05T20:10:39.659534+00:00')).toBe('2026-09-05 20:10')
  })

  it('"T" 가 없어 날짜·시간으로 쪼개지지 않으면 원본을 그대로 돌려준다 - 던지거나 조작하지 않는다', () => {
    // date/time 분해가 실패하는 값(예: 이미 다듬어졌거나 애초에 ISO 가
    // 아닌 문자열)에서 이 함수가 자르거나 이어붙이는 시도를 하면 안 된다 -
    // split 결과의 둘째 원소가 undefined 인 이 분기가 그것을 잰다.
    expect(formatDateTime('2026-09-05')).toBe('2026-09-05')
  })
})

describe('buildRows', () => {
  it('행마다 선언된 열을 전부 채우고, 속성이 없는 행도 던지지 않는다', () => {
    const document: CollectionDocument = {
      data: [
        { type: 'examples', id: '1', attributes: { title: '첫 번째' } },
        { type: 'examples', id: '2' }, // attributes 자체가 없다
      ],
    }
    const rows = buildRows(EXAMPLES, document)
    expect(rows).toHaveLength(2)

    const first = rows.find((row) => row.id === '1')
    const second = rows.find((row) => row.id === '2')
    expect(first?.cells.title).toBe('첫 번째')
    expect(second?.cells.title).toBeNull()
    // 선언된 열 전부(예: category)가 행마다 키로 존재해야 한다 - 일부만
    // 채우면 렌더링 쪽에서 어떤 열이 "없어서 null"인지 "아예 안 채워서
    // undefined"인지 구별할 수 없게 된다.
    expect(first?.cells).toHaveProperty('category')
  })
})
