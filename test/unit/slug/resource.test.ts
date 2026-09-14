import { describe, expect, it } from 'vitest'
import { resourceFromSlug, writableResource } from '@/app/(admin)/[slug]/resource'
import { resourceByType } from '@/lib/resources'

/**
 * `notFound()`(next/navigation)는 요청 스코프 없이도 던진다 - digest 를 단
 * `Error` 를 throw 할 뿐이라(실측: `node_modules/next/dist/client/components/
 * not-found.js`) vitest(node)에서 그대로 부를 수 있다. `redirect()`·
 * `cookies()` 와 다른 점이고, 그래서 이 파일은 요청 스코프 API 를 스텁하지
 * 않는 저장소 관례를 어기지 않는다.
 */
describe('resourceFromSlug', () => {
  it('선언된 slug 는 그 선언이다', () => {
    expect(resourceFromSlug('examples')).toBe(resourceByType('examples'))
    expect(resourceFromSlug('categories')).toBe(resourceByType('exampleCategories'))
  })

  it('선언에 없는 slug 는 notFound() 로 던진다', () => {
    expect(() => resourceFromSlug('nope')).toThrow()
  })

  it('type 으로는 찾지 않는다 - slug 와 type 이 다른 자원이 그 증거다', () => {
    // exampleCategories 의 slug 는 categories 다. type 을 넘기면 404 여야 한다.
    expect(() => resourceFromSlug('exampleCategories')).toThrow()
  })
})

describe('writableResource', () => {
  it('쓰기 가능한 자원은 그 선언이다', () => {
    expect(writableResource('examples')).toBe(resourceByType('examples'))
  })

  it('읽기 전용 자원은 던진다 - 화면이 제공하지 않는 경로라 사용자 문구가 없다', () => {
    expect(() => writableResource('categories')).toThrow('categories')
  })

  it('선언에 없는 slug 도 던진다', () => {
    expect(() => writableResource('nope')).toThrow('nope')
  })
})
