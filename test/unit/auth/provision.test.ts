import { describe, expect, it, vi } from 'vitest'
import { provisionOperator } from '@/lib/auth/provision'

describe('provisionOperator', () => {
  it('가입 경로에 JSON:API 미디어 타입으로 POST 한다', async () => {
    const fetchMock = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 'u1', type: 'users' } }), {
          status: 201,
          headers: { 'content-type': 'application/vnd.api+json' },
        }),
      )
    const result = await provisionOperator(
      { backendUrl: 'http://api:4000', email: 'ops@example.com', password: 'pw' },
      fetchMock,
    )
    expect(result.id).toBe('u1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('http://api:4000/api/v1/auth/register')
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/vnd.api+json',
    )
  })

  it('이메일 로컬 파트가 RFC 5321 의 64자를 넘으면 백엔드를 부르기 전에 던진다', async () => {
    const fetchMock = vi.fn()
    await expect(
      provisionOperator(
        { backendUrl: 'http://api:4000', email: `${'a'.repeat(65)}@example.com`, password: 'pw' },
        fetchMock,
      ),
    ).rejects.toThrow(/64/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
