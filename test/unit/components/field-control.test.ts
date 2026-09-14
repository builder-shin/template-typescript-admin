import { describe, expect, it } from 'vitest'
import {
  attributeControlFor,
  defaultAttributeValue,
  defaultRelationshipValues,
  inputTypeFor,
} from '@/components/resource/field-control'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

const ATTRIBUTES = SAMPLE_RESOURCE.attributes
const RELATIONSHIPS = SAMPLE_RESOURCE.relationships

describe('attributeControlFor', () => {
  it('string→text, text→textarea, enum→select, int→number, datetime→datetime', () => {
    expect(attributeControlFor(ATTRIBUTES.name!)).toBe('text')
    expect(attributeControlFor(ATTRIBUTES.body!)).toBe('textarea')
    expect(attributeControlFor(ATTRIBUTES.state!)).toBe('select')
    expect(attributeControlFor(ATTRIBUTES.rank!)).toBe('number')
    expect(attributeControlFor(ATTRIBUTES.createdAt!)).toBe('datetime')
  })
})

describe('inputTypeFor', () => {
  it('브라우저 input type 으로 옮긴다 - datetime 은 datetime-local 이다', () => {
    expect(inputTypeFor('text')).toBe('text')
    expect(inputTypeFor('number')).toBe('number')
    expect(inputTypeFor('datetime')).toBe('datetime-local')
  })
})

describe('defaultAttributeValue', () => {
  it('enum 은 첫 값이다 - 오늘 상태 필드가 첫 값을 고르는 것과 같다', () => {
    expect(defaultAttributeValue(ATTRIBUTES.state!)).toBe('on')
  })

  it('나머지 종류는 빈 값이다', () => {
    expect(defaultAttributeValue(ATTRIBUTES.name!)).toBe('')
    expect(defaultAttributeValue(ATTRIBUTES.body!)).toBe('')
    expect(defaultAttributeValue(ATTRIBUTES.rank!)).toBe('')
    expect(defaultAttributeValue(ATTRIBUTES.createdAt!)).toBe('')
  })

  it('values 가 빈 enum 도 던지지 않고 빈 값이다 - 불변식 테스트가 그 선언을 막는다', () => {
    expect(
      defaultAttributeValue({
        kind: 'enum',
        label: '빈',
        nullable: false,
        readOnly: false,
        values: [],
      }),
    ).toBe('')
  })
})

describe('defaultRelationshipValues', () => {
  const OPTIONS = [
    { id: 'o1', name: '첫째' },
    { id: 'o2', name: '둘째' },
  ]

  it('비울 수 있는 to-one 은 빈 값이다 - "없음"이 기본이다', () => {
    expect(defaultRelationshipValues(RELATIONSHIPS.owner!, OPTIONS)).toEqual([])
  })

  it('비울 수 없는 to-one 은 첫 보기다', () => {
    expect(
      defaultRelationshipValues(
        { cardinality: 'one', type: 'owners', label: '소유자', nullable: false },
        OPTIONS,
      ),
    ).toEqual(['o1'])
  })

  it('비울 수 없는 to-one 인데 보기가 없으면 빈 값이다 - 던지지 않는다', () => {
    expect(
      defaultRelationshipValues(
        { cardinality: 'one', type: 'owners', label: '소유자', nullable: false },
        [],
      ),
    ).toEqual([])
  })

  it('to-many 는 언제나 빈 값이다', () => {
    expect(defaultRelationshipValues(RELATIONSHIPS.marks!, OPTIONS)).toEqual([])
  })
})
