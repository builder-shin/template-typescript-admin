import { describe, expect, it } from 'vitest'
import { headingLabel, initialFormValues } from '@/lib/form/values'
import type { ResourceObject } from '@/lib/jsonapi/document'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

const OBJECT: ResourceObject = {
  type: 'samples',
  id: 's1',
  attributes: {
    name: '이름',
    body: null,
    state: 'on',
    rank: 7,
    weight: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  relationships: {
    owner: { data: { type: 'owners', id: 'o1' } },
    marks: {
      data: [
        { type: 'marks', id: 'm1' },
        { type: 'marks', id: 'm2' },
      ],
    },
  },
}

describe('initialFormValues', () => {
  it('폼 속성만 문자열로 편다 - readOnly 는 없고, 숫자는 문자열이 되고, null 은 빈 문자열이다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, OBJECT).attributes).toEqual({
      name: '이름',
      body: '',
      state: 'on',
      rank: '7',
      weight: '',
    })
  })

  it('attributes 자체가 없는 객체도 던지지 않고 전부 빈 문자열이다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, { type: 'samples', id: 's1' }).attributes).toEqual({
      name: '',
      body: '',
      state: '',
      rank: '',
      weight: '',
    })
  })

  it('to-one 은 id 하나, to-many 는 id 배열이다 - included 를 풀지 않아도 식별자에 id 가 있다', () => {
    expect(initialFormValues(SAMPLE_RESOURCE, OBJECT).relationships).toEqual({
      owner: ['o1'],
      marks: ['m1', 'm2'],
    })
  })

  it('빈 to-one, 응답에 없는 관계는 빈 배열이다', () => {
    const object: ResourceObject = {
      type: 'samples',
      id: 's1',
      relationships: { owner: { data: null } },
    }
    expect(initialFormValues(SAMPLE_RESOURCE, object).relationships).toEqual({
      owner: [],
      marks: [],
    })
  })
})

describe('headingLabel', () => {
  it('included 로 풀린 자원 객체는 heading 속성을 낸다 - name 이 아니라 넘긴 키다', () => {
    expect(
      headingLabel(
        { type: 'owners', id: 'o1', attributes: { title: '주인', name: '엉뚱' } },
        'title',
      ),
    ).toBe('주인')
  })

  it('식별자뿐이면(included 밖) id 로 대신한다 - 던지지 않는다', () => {
    expect(headingLabel({ type: 'owners', id: 'o1' }, 'title')).toBe('o1')
  })

  it('자원 객체이지만 heading 속성이 문자열이 아니면(누락 포함) id 로 대신한다', () => {
    expect(headingLabel({ type: 'owners', id: 'o1', attributes: {} }, 'title')).toBe('o1')
    expect(headingLabel({ type: 'owners', id: 'o1', attributes: { title: 3 } }, 'title')).toBe('o1')
  })

  it('heading 키가 undefined 면(대상 자원을 모를 때) id 다', () => {
    expect(
      headingLabel({ type: 'owners', id: 'o1', attributes: { title: '주인' } }, undefined),
    ).toBe('o1')
  })
})
