import { describe, expect, it } from 'vitest'
import { optionsFromDocument, optionsRequest } from '@/app/(admin)/examples/options'
import { resourceByType } from '@/lib/resources'

const CATEGORIES = resourceByType('exampleCategories')!

describe('optionsRequest', () => {
  it('page[size]=100 만 싣고 include 는 절대 싣지 않는다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options.query?.get('page[size]')).toBe('100')
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
