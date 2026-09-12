import { describe, expect, it } from 'vitest'
import { examplesFormState } from '@/app/(admin)/examples/form-state'

describe('examplesFormState', () => {
  it('속성 오류는 속성 입력에, 관계 오류는 관계 입력에 붙인다', () => {
    const state = examplesFormState([
      {
        code: 'VALIDATION_ERROR',
        detail: '제목이 너무 깁니다',
        source: { pointer: '/data/attributes/title' },
      },
      {
        code: 'VALIDATION_ERROR',
        detail: '없는 분류입니다',
        source: { pointer: '/data/relationships/category' },
      },
    ])
    expect(state.attributeErrors).toEqual({ title: ['제목이 너무 깁니다'] })
    expect(state.relationshipErrors).toEqual({ category: ['없는 분류입니다'] })
    expect(state.documentErrors).toEqual([])
  })

  it('관계 배열의 항목별 실패는 그 관계 하나로 접힌다 - 둘 다 남긴다', () => {
    // 실측: relationship_resolver 가 `/data/relationships/tags/data/<n>/id` 를 낸다.
    // placeError 가 네 번째 세그먼트(tags)를 필드로 쓰므로 같은 키로 모인다.
    const state = examplesFormState([
      {
        code: 'VALIDATION_ERROR',
        detail: '첫 번째',
        source: { pointer: '/data/relationships/tags/data/0/id' },
      },
      {
        code: 'VALIDATION_ERROR',
        detail: '두 번째',
        source: { pointer: '/data/relationships/tags/data/1/id' },
      },
    ])
    expect(state.relationshipErrors).toEqual({ tags: ['첫 번째', '두 번째'] })
  })

  it('pointer 없는 VALIDATION_ERROR 는 배너로 간다 - 실측된 경로다', () => {
    // 실측(exception_handlers.py): 본문이 깨진 JSON 이면 `json_invalid` 라
    // _validation_source 가 아무 출처도 못 만들고, 백엔드는 pointer 없는
    // VALIDATION_ERROR 를 낸다. actionForErrors 는 그래도 'fieldErrors' 를
    // 돌려주므로, 붙일 필드가 없다는 사실을 화면이 스스로 알아야 한다.
    const state = examplesFormState([
      { code: 'VALIDATION_ERROR', detail: '본문을 해석할 수 없습니다' },
    ])
    expect(state.attributeErrors).toEqual({})
    expect(state.relationshipErrors).toEqual({})
    expect(state.documentErrors).toEqual(['본문을 해석할 수 없습니다'])
  })

  it('문구가 하나도 없으면 쓸 수 없는 응답이다 - 빈 빨간 상자를 그리지 않는다', () => {
    expect(examplesFormState([{}]).unusable).toBe(true)
  })

  it('transport 는 폼이 받지 않는다', () => {
    // client.ts 가 합성한 오류는 app/error.tsx 의 일이다. flow.ts 와 같은 판정.
    const state = examplesFormState([
      { status: '0', code: 'NETWORK_ERROR', title: 'NETWORK_ERROR', meta: { synthetic: true } },
    ])
    expect(state.unusable).toBe(true)
  })
})
