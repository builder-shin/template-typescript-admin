import { describe, expect, it } from 'vitest'
import { writeDocument } from '@/lib/form/write'
import { SAMPLE_RESOURCE } from '../../fixtures/resources'

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData()
  for (const [name, value] of entries) data.append(name, value)
  return data
}

describe('writeDocument - 속성', () => {
  it('readOnly 속성은 폼에 있어도 보내지 않는다 - 정본은 받으면 422 를 낸다', () => {
    const body = writeDocument(
      SAMPLE_RESOURCE,
      form([
        ['name', '이름'],
        ['createdAt', '2026-09-14T00:00:00Z'],
      ]),
    )
    expect(body.data.attributes).not.toHaveProperty('createdAt')
  })

  it('문자열은 원문 그대로다 - 앞뒤 공백도 지우지 않는다(정규화는 백엔드의 일)', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['name', ' 이름 ']])).data.attributes.name).toBe(
      ' 이름 ',
    )
  })

  it('nullable 속성이 비면(공백만 있어도) null 이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['body', '  ']])).data.attributes.body).toBeNull()
  })

  it('nullable 아닌 문자열 속성이 비면 빈 문자열 그대로다 - 백엔드가 필수 오류를 낸다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['name', '']])).data.attributes.name).toBe('')
  })

  it('enum 은 값 그대로다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['state', 'off']])).data.attributes.state).toBe(
      'off',
    )
  })

  it('int 는 정수 문자열이면 숫자다 - 앞뒤 공백은 허용한다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', ' 7 ']])).data.attributes.rank).toBe(7)
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', '-3']])).data.attributes.rank).toBe(-3)
  })

  it('int 가 비면 nullable 이면 null 이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['weight', '']])).data.attributes.weight).toBeNull()
  })

  it('int 가 비고 nullable 이 아니면 키 자체를 뺀다 - 0 으로 둔갑시키지 않는다', () => {
    const body = writeDocument(SAMPLE_RESOURCE, form([['rank', '']]))
    expect(body.data.attributes).not.toHaveProperty('rank')
  })

  it('int 가 정수가 아니면 원문 문자열을 그대로 보낸다 - NaN 은 JSON 에서 null 이 되어 값이 사라진다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', 'abc']])).data.attributes.rank).toBe('abc')
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', '4.5']])).data.attributes.rank).toBe('4.5')
  })

  it('안전 정수 범위를 넘는 정수 문자열은 원문 그대로 보낸다 - Number 가 반올림한 값은 적은 값이 아니다', () => {
    const huge = '99999999999999999999'
    expect(writeDocument(SAMPLE_RESOURCE, form([['rank', huge]])).data.attributes.rank).toBe(huge)
  })

  it('폼에 없는 속성은 빈 값으로 다룬다', () => {
    const { attributes } = writeDocument(SAMPLE_RESOURCE, form([])).data
    expect(attributes).toEqual({ name: '', body: null, state: '', weight: null })
  })

  it('선언에 없는 폼 필드는 무시한다', () => {
    const { attributes } = writeDocument(
      SAMPLE_RESOURCE,
      form([
        ['name', '이름'],
        ['extra', '여분'],
      ]),
    ).data
    expect(attributes).not.toHaveProperty('extra')
  })
})

describe('writeDocument - 관계', () => {
  it('to-one 이 비면 data: null 이다 - 관계를 비운다는 뜻이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([['owner', '']])).data.relationships.owner).toEqual({
      data: null,
    })
  })

  it('to-one 은 대상 자원의 type 과 id 다', () => {
    expect(
      writeDocument(SAMPLE_RESOURCE, form([['owner', 'o1']])).data.relationships.owner,
    ).toEqual({ data: { type: 'owners', id: 'o1' } })
  })

  it('to-many 가 없으면 빈 배열이다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([])).data.relationships.marks).toEqual({ data: [] })
  })

  it('to-many 는 같은 name 의 값마다 식별자다', () => {
    expect(
      writeDocument(
        SAMPLE_RESOURCE,
        form([
          ['marks', 'm1'],
          ['marks', 'm2'],
        ]),
      ).data.relationships.marks,
    ).toEqual({
      data: [
        { type: 'marks', id: 'm1' },
        { type: 'marks', id: 'm2' },
      ],
    })
  })
})

describe('writeDocument - 문서', () => {
  it('type 은 자원의 type 이고, id 를 넘기지 않으면(POST) id 키가 없다', () => {
    const body = writeDocument(SAMPLE_RESOURCE, form([]))
    expect(body.data.type).toBe('samples')
    expect(body.data).not.toHaveProperty('id')
  })

  it('id 를 넘기면(PATCH) data.id 에 실린다', () => {
    expect(writeDocument(SAMPLE_RESOURCE, form([]), 's1').data.id).toBe('s1')
  })
})
