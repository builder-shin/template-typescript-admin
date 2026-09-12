import { randomUUID } from 'node:crypto'
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test'
import { JSONAPI_MEDIA_TYPE } from '@/lib/jsonapi/client'
import { expect, provisionAndSignIn, test } from './fixtures'
import { probeEmail } from './probe-email'
import { BACKEND_BASE_URL } from './stack'

/**
 * 일괄 삭제 E2E - 행별 결과 표, 부분 실패, 취소.
 *
 * ## 부분 실패를 만드는 방법 - 404, 그리고 왜 그것뿐인가
 *
 * 삭제가 422 로 거절되는 상태는 이 백엔드에 존재하지 않는다(실측: `destroy`
 * 는 성공 204, 없는 행 404 이고 `example_tags` 가 CASCADE 다). 그래서 부분
 * 실패는 **목록을 그린 뒤 그 행 하나를 HTTP 로 직접 지우고** 화면에서 일괄
 * 삭제를 실행해 만든다 - 그 행만 404 로 죽는다. 운영자 둘이 같은 그리드를
 * 보고 목록이 낡는 것과 같은 모양이다.
 *
 * ## "재시도" 에 대해 정직하게 적어 둔다
 *
 * `components/grid/bulk-result.tsx` 의 `classify()` 는 `RESOURCE_NOT_FOUND`
 * 코드를 `alreadyGone` 통으로 보내고, 재시도 버튼(`showRetry`)은
 * `summary.retryable.length > 0` 일 때만 뜬다 - 그리고 `alreadyGone` 은
 * `retryable` 이 아니다(다시 보내도 같은 404 뿐이라 버튼을 아예 그리지
 * 않는다 - 그 파일의 "재시도는 summarize(report).retryable 만 받는다" 절).
 * 이 백엔드의 DELETE 가 낼 수 있는 실패는 204 아니면 404 뿐이므로(위 실측),
 * **`retryable` 통은 이 백엔드를 상대로는 실제로 도달할 수 없다** - 모킹
 * 없이는 재현할 방법이 없다(`retryable` 로 가려면 `RESOURCE_NOT_FOUND` 도
 * 세션 코드도 아닌 오류 코드가 필요한데, 이 라우트는 그런 코드를 내지
 * 않는다). 그 갈래(`mergeRetryReport`, 재시도 버튼 클릭 자체)는 이미 단위
 * 테스트가 지킨다(`test/unit/components/bulk-result.test.ts`) - 여기서는
 * 대신 **실제로 도달 가능한 절반**을 잰다: `alreadyGone` 이 섞인 결과에
 * 재시도 버튼이 뜨지 않는다는 것(`showRetry` 배선이 실제 DOM 에서도
 * 지켜지는가 - 단위에는 DOM 하네스가 없어 여기서만 잴 수 있다).
 *
 * 취소는 다른 문제라 실제로 잴 수 있다 - 순차 실행 중간에 취소해도 이미 나간
 * 요청은 막지 못하고 다음 요청부터 막힌다는 것을 실제 응답 지연으로 확인한다
 * (응답을 지어내지 않는다 - 진짜 응답을 늦출 뿐이다, `examples.spec.ts` 의
 * "다국어 오류" 와 같은 종류의 정직한 우회다).
 */

const PASSWORD = 'probe-operator-password'

function uniqueEmail(label: string): string {
  return probeEmail(`probe-e2e-bulk-${label}`)
}

/** 씨앗의 `probe-seed`·생성 폼의 `probe-create` 와 겹치지 않는다(seed/README.md). */
const BULK_PREFIX = 'probe-bulk'

function uniqueTitle(label: string): string {
  return `${BULK_PREFIX}-${label}-${randomUUID()}`
}

/**
 * 세션 쿠키에서 access 토큰을 꺼낸다. `session.ts` 의 `encodeAccessCookieValue`
 * 가 만드는 `<epochMs>:<jwt>` 형식을 역산한다 - 첫 콜론 앞은 만료 시각,
 * 그 뒤 전부가 토큰이다(토큰 자체는 콜론을 담지 않지만 뒷부분을 통째로 쓰는
 * 이유는 그 파일의 decodeAccessCookieValue 와 같다). 쿠키 값은 퍼센트
 * 인코딩되어 온다(`ResponseCookies.set()` 이 인코딩한다) - 실제 문자로
 * 되돌리려면 먼저 디코드한다.
 */
async function accessTokenFrom(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies()
  const raw = cookies.find((cookie) => cookie.name === 'session_access')?.value
  if (raw === undefined) throw new Error('session_access 쿠키가 없다')
  const decoded = decodeURIComponent(raw)
  const separatorIndex = decoded.indexOf(':')
  return decoded.slice(separatorIndex + 1)
}

/**
 * 백엔드에 직접 example 을 만든다. Step 7b 는 Base UI 폼이 값을 싣는지 재는
 * 자리라 UI 를 거치지만, 이 파일은 "행이 존재한다"는 사실만 필요하다 - 매
 * 테스트 3~5건을 화면 제출로 만들면 굼뜨고, 그 제출 경로 자체는 이미
 * `examples.spec.ts` 가 잰다.
 */
async function createExampleDirect(
  request: APIRequestContext,
  accessToken: string,
  title: string,
): Promise<string> {
  const response = await request.post(`${BACKEND_BASE_URL}/api/v1/examples`, {
    headers: {
      accept: JSONAPI_MEDIA_TYPE,
      'content-type': JSONAPI_MEDIA_TYPE,
      authorization: `Bearer ${accessToken}`,
    },
    data: {
      data: {
        type: 'examples',
        attributes: { title, description: null, status: 'draft', score: 0 },
        relationships: { category: { data: null }, tags: { data: [] } },
      },
    },
  })
  if (!response.ok()) {
    throw new Error(`직접 생성 실패 - ${response.status()} ${await response.text()}`)
  }
  const document = (await response.json()) as { data: { id: string } }
  return document.data.id
}

async function deleteExampleDirect(
  request: APIRequestContext,
  accessToken: string,
  id: string,
): Promise<void> {
  const response = await request.delete(`${BACKEND_BASE_URL}/api/v1/examples/${id}`, {
    headers: { accept: JSONAPI_MEDIA_TYPE, authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok()) {
    throw new Error(`직접 삭제 실패 - ${response.status()} ${await response.text()}`)
  }
}

function selectAllCheckbox(page: Page) {
  return page.getByRole('checkbox', { name: '전체 선택' })
}

function resultSummary(page: Page) {
  return page.locator('p', { hasText: '건 실패' })
}

/** 이 제목들 중 하나라도 담긴 데이터 행. accessible name 계산에 기대지 않고
 * 텍스트 내용으로 직접 거른다 - 표에는 상세로 가는 링크가 없어 셀이 평문이다. */
function rowsWithAnyTitle(page: Page, titles: readonly string[]) {
  return page.locator('tbody tr').filter({ hasText: new RegExp(titles.join('|')) })
}

test.describe('일괄 삭제', () => {
  test('행별 결과 표에 성공과 이미 없음이 섞여 나오고, 그때는 재시도 버튼이 없다', async ({
    page,
    context,
    request,
  }) => {
    await provisionAndSignIn(page, uniqueEmail('partial'), PASSWORD)
    const accessToken = await accessTokenFrom(context)

    const titles = [uniqueTitle('one'), uniqueTitle('two'), uniqueTitle('three')]
    const ids = await Promise.all(
      titles.map((title) => createExampleDirect(request, accessToken, title)),
    )

    // 목록을 그린다 - 세 건 다 아직 살아 있는 상태를 화면이 본다.
    await page.goto(
      `/examples?${new URLSearchParams({ title: BULK_PREFIX, pageSize: '10' }).toString()}`,
    )
    await expect(rowsWithAnyTitle(page, titles)).toHaveCount(3)

    // 화면 몰래 한 건을 지운다 - "다른 운영자가 먼저 지웠다"와 같은 모양이다.
    // 화면은 아직 새로고침 전이라 여전히 세 건을 보여준다.
    await deleteExampleDirect(request, accessToken, ids[2]!)

    await selectAllCheckbox(page).click()
    await page.getByRole('button', { name: '일괄 삭제' }).click()
    await page.getByRole('button', { name: '삭제 확인' }).click()

    await expect(resultSummary(page)).toBeVisible()
    await expect(page.getByText('3건 중')).toContainText('1건 실패')

    // 행별 결과 - 두 건 성공, 한 건 이미 없음.
    await expect(page.getByRole('cell', { name: '성공', exact: true })).toHaveCount(2)
    await expect(page.getByRole('cell', { name: '이미 없음', exact: true })).toHaveCount(1)
    await expect(page.getByText('1건은 이미 삭제되어 있었습니다', { exact: false })).toBeVisible()

    // 재시도 버튼이 없다 - 위 파일 머리말의 "재시도에 대해 정직하게" 절이
    // 이 배선의 근거다. 있으면 이 알려진 한계가 조용히 뒤집힌 것이다.
    await expect(page.getByRole('button', { name: /^재시도/ })).toHaveCount(0)

    // 닫고 목록을 새로 고치면 세 건 다 사라져 있다(둘은 방금 지웠고, 하나는
    // 이미 지워져 있었다) - 부분 실패가 "지우려던 목적은 이미 달성됐다"는
    // 뜻이라는 결과 표의 안내와 실제 데이터가 일치하는지 확인한다.
    await page.getByRole('button', { name: '닫기' }).click()
    await page.reload()
    await expect(rowsWithAnyTitle(page, titles)).toHaveCount(0)
  })

  /**
   * 순차 실행 중간에 취소하면 **이미 나간 요청은 끝까지 두고 다음 요청부터
   * 막는다**(`lib/bulk/executor.ts` 의 `runBulk`). 실제 네트워크 타이밍
   * 없이는 "중간"을 잡을 수 없으므로, 각 삭제의 **응답**(브라우저가 `web`
   * 의 Server Action 엔드포인트로부터 받는 응답)을 인위적으로 늦춘다 - 값을
   * 지어내지 않는다, 진짜 204 응답이 늦게 도착할 뿐이다
   * (`examples.spec.ts` 의 언어 왕복 테스트와 다른, 이 파일만의 우회다).
   */
  test('취소하면 이미 나간 요청은 끝까지 처리되고 남은 요청은 나가지 않는다', async ({
    page,
    context,
    request,
  }) => {
    await provisionAndSignIn(page, uniqueEmail('cancel'), PASSWORD)
    const accessToken = await accessTokenFrom(context)

    const titles = Array.from({ length: 5 }, (_unused, index) => uniqueTitle(`cancel-${index}`))
    const ids = await Promise.all(
      titles.map((title) => createExampleDirect(request, accessToken, title)),
    )

    await page.route('**/examples*', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
    })

    await page.goto(
      `/examples?${new URLSearchParams({ title: BULK_PREFIX, pageSize: '10' }).toString()}`,
    )
    await expect(rowsWithAnyTitle(page, titles)).toHaveCount(5)

    await selectAllCheckbox(page).click()
    await page.getByRole('button', { name: '일괄 삭제' }).click()
    await page.getByRole('button', { name: '삭제 확인' }).click()

    // 첫 요청이 끝날 시간(500ms)은 주고, 다섯 개가 전부 끝날 시간(2.5초)은
    // 주지 않은 채로 취소한다.
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: '취소' }).click()

    await expect(page.getByText('취소됨', { exact: false })).toBeVisible()
    const summaryText = await resultSummary(page).innerText()
    // "N / 5건 시도" 형식(bulk-result.tsx) - N 이 5 미만이어야 취소가 실제로
    // 나머지를 막은 것이다.
    const attempted = Number(summaryText.match(/(\d+)\s*\/\s*5건/)?.[1])
    expect(attempted, `요약 문구: ${summaryText}`).toBeGreaterThan(0)
    expect(attempted, `요약 문구: ${summaryText}`).toBeLessThan(5)

    // 취소 뒤 남은 행이 실제로 살아 있는가 - 요청 자체가 나가지 않았다는
    // 증거다(요청이 나갔는데 응답만 늦는 것과 구별된다).
    await page.unroute('**/examples*')
    await page.reload()
    const remaining = await rowsWithAnyTitle(page, titles).count()
    expect(remaining, '취소로 막힌 행은 지워지지 않은 채 남아 있어야 한다').toBeGreaterThan(0)

    // 정리 - 남은 행을 직접 지운다(다음 테스트가 같은 접두사로 골라도
    // 안전하도록).
    for (const id of ids) {
      await deleteExampleDirect(request, accessToken, id).catch(() => {
        // 이미 지워졌으면(취소되지 않고 처리된 행) 404 다 - 정리 목적이라
        // 무시한다.
      })
    }
  })
})
