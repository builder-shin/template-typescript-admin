import { describe, expect, it } from 'vitest'
import {
  optionsFromDocument,
  optionsRequest,
  unwrapOptionsResult,
} from '@/app/(admin)/examples/options'
import { resourceByType } from '@/lib/resources'

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

describe('optionsFromDocument', () => {
  it('id 와 attributes.name 을 뽑는다', () => {
    const document = {
      data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
    }
    expect(optionsFromDocument(document)).toEqual([{ id: 'c1', name: '분류 하나' }])
  })

  it('name 이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    const document = { data: [{ type: 'exampleCategories', id: 'c1' }] }
    expect(optionsFromDocument(document)).toEqual([{ id: 'c1', name: 'c1' }])
  })
})

describe('unwrapOptionsResult', () => {
  it('성공하면 문서를 그대로 돌려준다', () => {
    const document = { data: [] }
    expect(unwrapOptionsResult({ ok: true, status: 200, document })).toBe(document)
  })

  // 호출부(`[id]/page.tsx`·`new/page.tsx`)가 `!result.ok` 를 messageForReadFailure
  // (../read-result.ts)로 먼저 걸러야 한다 - 이 함수 자신은 detail 을 더 이상
  // 메시지에 싣지 않는다(app/error.tsx 가 백엔드의 진짜 설명을 discard 하고
  // "연결할 수 없다"는 거짓 문구를 보여주던 자리였다). 실패한 결과가 여기
  // 도달하는 것 자체가 호출부의 버그이므로, detail 내용과 무관하게 항상 같은
  // 내부 오류 문구로 던진다.
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
