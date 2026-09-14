import { describe, expect, it } from 'vitest'
import { optionsFromDocument } from '@/lib/form/options'
import { OWNER_RESOURCE } from '../../fixtures/resources'

describe('optionsFromDocument', () => {
  it('id 와 heading 속성을 뽑는다 - name 이 아니라 선언의 heading 이다', () => {
    const document = {
      data: [{ type: 'owners', id: 'o1', attributes: { title: '주인', name: '엉뚱' } }],
    }
    expect(optionsFromDocument(OWNER_RESOURCE, document)).toEqual([{ id: 'o1', name: '주인' }])
  })

  it('heading 속성이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    const document = { data: [{ type: 'owners', id: 'o1' }] }
    expect(optionsFromDocument(OWNER_RESOURCE, document)).toEqual([{ id: 'o1', name: 'o1' }])
  })

  it('빈 목록은 빈 배열이다', () => {
    expect(optionsFromDocument(OWNER_RESOURCE, { data: [] })).toEqual([])
  })
})
