import { describe, expect, it } from 'vitest'
import { classifyHealth, healthRequest, HEALTH_PATH } from '@/app/(admin)/health'
import type { JsonApiResult } from '@/lib/jsonapi/client'

describe('healthRequest', () => {
  it('/health/ready 를 부른다 - /health 나 /health/live 가 아니다', () => {
    // /health 는 라우트가 아니다(404), /health/live 는 Postgres 를 보지 않아
    // DB 가 죽어도 ok 를 낸다 - 이 카드가 실제로 물어야 하는 것은 ready 쪽이다.
    expect(healthRequest()[0]).toBe('/health/ready')
    expect(HEALTH_PATH).toBe('/health/ready')
  })

  it('Accept-Language 를 넘기면 옵션에 실린다', () => {
    const [, options] = healthRequest('ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 를 넘기지 않으면 그 헤더 옵션 자체가 없다', () => {
    const [, options] = healthRequest()
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})

describe('classifyHealth', () => {
  it('2xx 는 healthy 다', () => {
    const result: JsonApiResult<unknown> = {
      ok: true,
      status: 200,
      document: { data: null, meta: { status: 'ok' } },
    }
    expect(classifyHealth(result)).toBe('healthy')
  })

  it('503(ready 가 스스로 실패를 선언한 상태)은 down 이다', () => {
    const result: JsonApiResult<unknown> = {
      ok: false,
      status: 503,
      errors: [
        {
          status: '503',
          code: 'INTERNAL_SERVER_ERROR',
          title: '서버 오류',
          detail: 'Postgres 에 연결할 수 없습니다.',
        },
      ],
    }
    expect(classifyHealth(result)).toBe('down')
  })

  it('전송 자체가 실패하면(합성 오류 - 네트워크 불능) down 이다', () => {
    // client.ts 의 synthesizeError 가 남기는 표시(meta.synthetic)로 판정한다 -
    // 응답을 아예 받지 못한 경우도 "다운"과 같은 뜻으로 취급한다.
    const result: JsonApiResult<unknown> = {
      ok: false,
      status: 0,
      errors: [
        {
          status: '0',
          code: 'NETWORK_ERROR',
          title: 'NETWORK_ERROR',
          detail: 'The backend could not be reached.',
          meta: { synthetic: true },
        },
      ],
    }
    expect(classifyHealth(result)).toBe('down')
  })

  it('404(경로가 틀렸거나 라우트가 없음)는 down 이 아니라 unexpected 다', () => {
    // 이 테스트가 이번에 겪은 결함 그 자체를 지킨다 - /health(존재하지 않는
    // 경로)를 부르면 이 모양의 응답이 온다. 이걸 down 으로 읽으면 멀쩡한
    // 백엔드가 항상 "다운"으로 뜬다. down 테스트(503·네트워크 오류)만으로는
    // 이 회귀를 잡지 못한다 - 셋 다 "실패"로 뭉뚱그리면 이 테스트 없이도
    // 통과했을 것이다.
    const result: JsonApiResult<unknown> = {
      ok: false,
      status: 404,
      errors: [
        {
          status: '404',
          code: 'RESOURCE_NOT_FOUND',
          title: '리소스를 찾을 수 없음',
          detail: '요청한 리소스를 찾을 수 없습니다.',
        },
      ],
    }
    expect(classifyHealth(result)).toBe('unexpected')
  })

  it('503 이 아닌 5xx 도 unexpected 다 - down 은 ready 가 선언한 503 하나뿐이다', () => {
    const result: JsonApiResult<unknown> = {
      ok: false,
      status: 500,
      errors: [{ status: '500', code: 'INTERNAL_ERROR', title: '서버 오류' }],
    }
    expect(classifyHealth(result)).toBe('unexpected')
  })

  it('오류 배열이 비어 있어도(있어서는 안 되지만) 던지지 않고 unexpected 로 접는다', () => {
    const result: JsonApiResult<unknown> = { ok: false, status: 404, errors: [] }
    expect(() => classifyHealth(result)).not.toThrow()
    expect(classifyHealth(result)).toBe('unexpected')
  })
})
