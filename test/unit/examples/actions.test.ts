import { describe, expect, it } from 'vitest'
import {
  createExampleRequest,
  deleteExampleRequest,
  updateExampleRequest,
} from '@/app/(admin)/examples/write'

/**
 * 네 쓰기 Action(`createExampleAction`·`updateExampleAction`·
 * `deleteExampleAction`·`bulkDeleteExampleAction`, `actions.ts`) 자신은
 * `requireSession()` 안의 `cookies()`가 요청 스코프를 요구해 이 저장소의
 * 단위 테스트 계층에서 부를 수 없다 - 그래서 그 네 Action 이 실제로
 * `accessToken` 을 싣는지는 여기서 직접 재지 못한다.
 *
 * 대신 각 Action 이 조립을 통째로 위임하는 순수 함수(`./write.ts` 의
 * `<동사>ExampleRequest`)를 잰다 - `accessToken` 이 **선택 인자로 슬쩍
 * 빠지는 것이 타입 오류가 아니라는 것**이 이 자리가 무가드였던 근본
 * 원인이다(`RequestOptions.accessToken` 이 optional - Task 13 실측: 실제
 * 백엔드 상대 E2E 를 처음 돌리기 전까지 네 Action 전부가 토큰 없이
 * 나가면서도 타입 검사·빌드·기존 단위 495개가 전부 통과했다). 그래서 이
 * 파일의 각 테스트는 반드시 `options.accessToken` 이 넘긴 값과 **같은
 * 문자열인지**를 명시적으로 잰다 - "정의돼 있다"가 아니라 "그 값이다".
 */

const FORM_DATA = new FormData()
FORM_DATA.set('title', '제목')
FORM_DATA.set('description', '')
FORM_DATA.set('status', 'draft')
FORM_DATA.set('score', '1')
FORM_DATA.set('category', '')

const TOKEN = 'probe-access-token'

describe('createExampleRequest', () => {
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = createExampleRequest(FORM_DATA, TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = createExampleRequest(FORM_DATA, TOKEN, null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })

  it('경로는 examples 컬렉션이고 메서드는 POST 다', () => {
    const [path, options] = createExampleRequest(FORM_DATA, TOKEN, 'ko')
    expect(path).toBe('/api/v1/examples')
    expect(options.method).toBe('POST')
    expect(options.acceptLanguage).toBe('ko')
  })
})

describe('updateExampleRequest', () => {
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = updateExampleRequest('e1', FORM_DATA, TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('경로는 그 id 의 상세이고 메서드는 PATCH 다(PUT 이 아니다)', () => {
    const [path, options] = updateExampleRequest('e1', FORM_DATA, TOKEN, 'en')
    expect(path).toBe('/api/v1/examples/e1')
    expect(options.method).toBe('PATCH')
    expect(options.acceptLanguage).toBe('en')
  })
})

describe('deleteExampleRequest', () => {
  // deleteExampleAction 과 bulkDeleteExampleAction 둘 다 이 함수 하나로
  // 조립한다(actions.ts 의 같은 이름 함수 주석) - 결과를 다루는 방식만
  // 갈릴 뿐 요청 자체는 같으므로 여기 하나로 두 Action 모두를 잰다.
  it('accessToken 이 옵션에 그대로 실린다', () => {
    const [, options] = deleteExampleRequest('e1', TOKEN, null)
    expect(options.accessToken).toBe(TOKEN)
  })

  it('경로는 그 id 의 상세이고 메서드는 DELETE 다', () => {
    const [path, options] = deleteExampleRequest('e1', TOKEN, 'ko')
    expect(path).toBe('/api/v1/examples/e1')
    expect(options.method).toBe('DELETE')
    expect(options.acceptLanguage).toBe('ko')
  })
})
