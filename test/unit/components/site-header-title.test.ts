import { describe, expect, it } from 'vitest'
import { titleFor } from '@/components/site-header-title'
import { resourceByType } from '@/lib/resources'

describe('titleFor', () => {
  it('/ 는 대시보드다', () => {
    expect(titleFor('/')).toBe('대시보드')
  })

  it('/examples 는 자원 라벨을 그대로 쓴다 - 사이드바·표와 같은 자리를 읽는다', () => {
    expect(titleFor('/examples')).toBe(resourceByType('examples')!.label)
  })

  it('/examples/new 는 예제 만들기다', () => {
    expect(titleFor('/examples/new')).toBe('예제 만들기')
  })

  it('그 외(예: /examples/abc, 상세 화면)는 예제 상세다', () => {
    expect(titleFor('/examples/abc')).toBe('예제 상세')
  })
})
