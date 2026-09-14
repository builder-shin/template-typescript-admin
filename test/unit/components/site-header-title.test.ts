import { describe, expect, it } from 'vitest'
import { titleFor } from '@/components/site-header-title'
import { RESOURCES, resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!
const CATEGORIES = resourceByType('exampleCategories')!

describe('titleFor', () => {
  it('/ 는 대시보드다', () => {
    expect(titleFor('/')).toBe('대시보드')
  })

  it('/<slug> 는 자원 라벨을 그대로 쓴다 - 사이드바·표와 같은 자리를 읽는다', () => {
    expect(titleFor(`/${EXAMPLES.slug}`)).toBe(EXAMPLES.label)
    expect(titleFor(`/${CATEGORIES.slug}`)).toBe(CATEGORIES.label)
  })

  it('/<slug>/new 는 "<라벨> 만들기"다 - E2E 가 "예제 만들기"를 찾는다', () => {
    expect(titleFor('/examples/new')).toBe('예제 만들기')
    expect(titleFor(`/${CATEGORIES.slug}/new`)).toBe(`${CATEGORIES.label} 만들기`)
  })

  it('/<slug>/<id> 는 "<라벨> 상세"다', () => {
    expect(titleFor('/examples/abc')).toBe('예제 상세')
    expect(titleFor(`/${CATEGORIES.slug}/11110000-0000-4000-8000-000000000001`)).toBe(
      `${CATEGORIES.label} 상세`,
    )
  })

  it('선언에 없는 slug 는 빈 문자열이다 - 문구를 지어내지 않는다', () => {
    expect(titleFor('/nope')).toBe('')
    expect(titleFor('/nope/new')).toBe('')
    expect(titleFor('/login')).toBe('')
  })

  it('모든 자원의 세 경로가 빈 문자열이 아니다', () => {
    for (const resource of RESOURCES) {
      expect(titleFor(`/${resource.slug}`)).not.toBe('')
      expect(titleFor(`/${resource.slug}/new`)).not.toBe('')
      expect(titleFor(`/${resource.slug}/x`)).not.toBe('')
    }
  })
})
