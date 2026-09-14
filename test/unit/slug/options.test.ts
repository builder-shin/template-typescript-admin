import { describe, expect, it } from 'vitest'
import {
  filterOptionsFromResults,
  optionsByRelationship,
  optionsRequest,
  relationshipFilterRequests,
  relationshipOptionRequests,
  unwrapOptionsResult,
} from '@/app/(admin)/[slug]/options'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { SAMPLE_INPUT } from '../../fixtures/resources'

const CATEGORIES = resourceByType('exampleCategories')!
const EXAMPLES = resourceByType('examples')!

describe('optionsRequest', () => {
  it('page[size]=100 만 싣고 include 는 절대 싣지 않는다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options.query?.get('page[size]')).toBe('100')
    expect(options.query?.has('include')).toBe(false)
  })

  it('resource.includes 가 채워진 자원을 넘겨도 include 를 만들지 않는다 - listRequest 를 재사용하지 않는다는 계약 자체를 잰다', () => {
    // EXAMPLES.includes 는 ['category', 'tags'] 다(비지 않았다). exampleCategories·
    // exampleTags 가 오늘 우연히 빈 includes 를 가져서 위 테스트가 통과하는
    // 것이 아니라는 것을 보이려는 자리 - optionsRequest 가 listRequest 처럼
    // resource.includes 를 읽어 include 를 만드는 코드 경로로 "단순화"되면
    // (그 코드 경로 자체가 없어야 한다는 것이 이 파일 머리말의 요지다), 이
    // 자원에서는 그 리팩터가 즉시 여기서 드러난다.
    const [, options] = optionsRequest(EXAMPLES, null)
    expect(options.query?.has('include')).toBe(false)
  })

  it('경로는 그 자원의 것이다', () => {
    expect(optionsRequest(CATEGORIES, null)[0]).toBe(CATEGORIES.path)
  })

  it('Accept-Language 를 그대로 싣는다', () => {
    const [, options] = optionsRequest(CATEGORIES, 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})

describe('unwrapOptionsResult', () => {
  it('성공하면 문서를 그대로 돌려준다', () => {
    const document = { data: [] }
    expect(unwrapOptionsResult({ ok: true, status: 200, document })).toBe(document)
  })

  // 호출부가 `!result.ok` 를 messageForReadFailure(../read-result.ts)로 먼저
  // 걸러야 한다 - 이 함수 자신은 detail 을 더 이상 메시지에 싣지 않는다
  // (app/error.tsx 가 백엔드의 진짜 설명을 discard 하고 "연결할 수 없다"는
  // 거짓 문구를 보여주던 자리였다). 실패한 결과가 여기 도달하는 것 자체가
  // 호출부의 버그이므로, detail 내용과 무관하게 항상 같은 내부 오류 문구로
  // 던진다.
  it('실패한 결과가 오면(호출부가 걸렀어야 함) 내부 오류로 던진다 - detail 을 담지 않는다', () => {
    expect(() =>
      unwrapOptionsResult({
        ok: false,
        status: 400,
        errors: [{ detail: '허용되지 않은 include 입니다' }],
      }),
    ).toThrow('내부 오류')
  })

  it('204(document: null)면 던진다 - 조용히 빈 목록으로 다루지 않는다', () => {
    expect(() => unwrapOptionsResult({ ok: true, status: 204, document: null })).toThrow(
      '선택 목록 응답에 본문이 없습니다.',
    )
  })
})

describe('relationshipOptionRequests', () => {
  it('관계마다 대상 자원의 보기 목록 요청을 만든다 - 순서는 선언 순서다', () => {
    const plans = relationshipOptionRequests(EXAMPLES, 'ko')
    expect(plans.map((plan) => plan.key)).toEqual(['category', 'tags'])
    expect(plans.map((plan) => plan.target.type)).toEqual(['exampleCategories', 'exampleTags'])
    expect(plans[0]!.request[0]).toBe('/api/v1/categories')
    expect(plans[0]!.request[1].acceptLanguage).toBe('ko')
  })

  it('관계가 없는 자원은 빈 배열이다', () => {
    expect(relationshipOptionRequests(CATEGORIES, null)).toEqual([])
  })

  it('대상 자원이 선언에 없으면 던진다 - 불변식 테스트가 막지만 여기서도 조용히 넘어가지 않는다', () => {
    const ghost = defineResource({
      ...SAMPLE_INPUT,
      relationships: {
        owner: { cardinality: 'one', type: 'nowhere', label: '소유자', nullable: true },
      },
    })
    expect(() => relationshipOptionRequests(ghost, null)).toThrow('nowhere')
  })
})

describe('optionsByRelationship', () => {
  const plans = relationshipOptionRequests(EXAMPLES, null)

  it('성공한 결과를 관계 키별 보기 목록으로 편다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      {
        ok: true,
        status: 200,
        document: {
          data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
        },
      },
      {
        ok: true,
        status: 200,
        document: { data: [{ type: 'exampleTags', id: 't1', attributes: { name: '라벨 하나' } }] },
      },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({
      ok: true,
      options: {
        category: [{ id: 'c1', name: '분류 하나' }],
        tags: [{ id: 't1', name: '라벨 하나' }],
      },
    })
  })

  it('하나라도 실패하면 그 오류를 그대로 돌려준다 - 폼을 반쪽으로 그리지 않는다', () => {
    const errors = [{ status: '500', code: 'INTERNAL', detail: '망가짐' }]
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 200, document: { data: [] } },
      { ok: false, status: 500, errors },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({ ok: false, errors })
  })

  it('204 는 던진다 - unwrapOptionsResult 의 판단 그대로', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 204, document: null },
      { ok: true, status: 200, document: { data: [] } },
    ]
    expect(() => optionsByRelationship(plans, results)).toThrow('선택 목록 응답에 본문이 없습니다.')
  })

  it('계획과 결과의 수가 다르면 던진다 - 호출부의 버그다', () => {
    expect(() => optionsByRelationship(plans, [])).toThrow('내부 오류')
  })

  it('계획이 없으면(관계 없는 자원) 빈 보기 목록으로 성공한다', () => {
    expect(optionsByRelationship([], [])).toEqual({ ok: true, options: {} })
  })
})

describe('relationshipFilterRequests', () => {
  it('키가 관계.id 인 필터마다 대상 자원의 요청을 만든다 - 계획의 key 는 필터 키다', () => {
    const plans = relationshipFilterRequests(EXAMPLES, 'ko')
    expect(plans.map((plan) => plan.key)).toEqual(['category.id'])
    expect(plans[0]!.target.type).toBe('exampleCategories')
    expect(plans[0]!.request[0]).toBe('/api/v1/categories')
    expect(plans[0]!.request[1].acceptLanguage).toBe('ko')
  })

  it('속성 필터뿐인 자원은 빈 배열이다', () => {
    expect(relationshipFilterRequests(CATEGORIES, null)).toEqual([])
  })

  it('관계.id 꼴이지만 그 관계가 선언에 없으면 건너뛴다 - 유도가 던지지 않는 규칙과 같다', () => {
    const odd = defineResource({
      ...SAMPLE_INPUT,
      filters: [{ key: 'ghost.id', operators: ['exact'], uiOperator: 'exact' }],
    })
    expect(relationshipFilterRequests(odd, null)).toEqual([])
  })

  it('대상 자원이 선언에 없으면 던진다', () => {
    const ghost = defineResource({
      ...SAMPLE_INPUT,
      relationships: {
        owner: { cardinality: 'one', type: 'nowhere', label: '소유자', nullable: true },
      },
    })
    expect(() => relationshipFilterRequests(ghost, null)).toThrow('nowhere')
  })
})

describe('filterOptionsFromResults', () => {
  const plans = relationshipFilterRequests(EXAMPLES, null)

  it('성공한 결과를 필터 키별 보기 목록으로 편다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      {
        ok: true,
        status: 200,
        document: {
          data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
        },
      },
    ]
    expect(filterOptionsFromResults(plans, results)).toEqual({
      'category.id': [{ id: 'c1', name: '분류 하나' }],
    })
  })

  it('실패한 결과는 그 키를 빼서 접는다 - 목록 화면은 배너로 바뀌지 않고 그 필터만 텍스트 입력이 된다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: false, status: 500, errors: [{ status: '500', code: 'INTERNAL' }] },
    ]
    expect(filterOptionsFromResults(plans, results)).toEqual({})
  })

  it('204 와 빈 목록도 키를 뺀다 - 보기 없는 Select("전체"뿐)를 그리지 않는다', () => {
    expect(filterOptionsFromResults(plans, [{ ok: true, status: 204, document: null }])).toEqual({})
    expect(
      filterOptionsFromResults(plans, [{ ok: true, status: 200, document: { data: [] } }]),
    ).toEqual({})
  })

  it('계획과 결과의 수가 다르면 던진다 - 호출부의 버그다', () => {
    expect(() => filterOptionsFromResults(plans, [])).toThrow('내부 오류')
  })
})
