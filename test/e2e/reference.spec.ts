import { expect, provisionAndSignIn, test } from './fixtures'
import { probeEmail } from './probe-email'

/**
 * 읽기 전용 자원(`writable: false`)의 화면과 선언에 없는 슬러그.
 *
 * ## 이 파일이 재는 것
 *
 * `app/(admin)/[slug]/` 한 벌이 `examples` 가 아닌 자원도 그린다는 것 -
 * 열두 시나리오(`auth`·`bulk`·`examples`)는 전부 `examples` 위에서 돌아
 * 제네릭 화면이 정말 제네릭인지는 이 파일만 잰다. 분류(`categories`)를
 * 고른 이유는 씨앗이 이미 두 건을 넣고(`seed/examples.sql`) 쓰기 라우트가
 * 없어(`lib/resources/category.ts`) "쓰기 UI 가 없다"를 실제 데이터로 잴 수
 * 있어서다.
 *
 * ## 접두사 - 행을 만들지 않는다
 *
 * 분류에는 쓰기 라우트가 없으니 이 파일은 행을 만들 수 없고 만들지도
 * 않는다. 목록은 씨앗 분류 이름의 접두사 `프로브` 로 좁힌다(`name` 필터,
 * `uiOperator: 'contains'`) - 다른 시나리오는 분류를 만들지 못하므로 그
 * 접두사가 잡는 행은 씨앗 둘뿐이다(`test/AGENTS.md` 규칙 3). 순서는
 * 단언하지 않는다 - 백엔드의 기본 정렬(`name`)이 한글을 어떤 콜레이션으로
 * 세우는지는 이 저장소가 정하지 않는다.
 *
 * ## 없는 슬러그 - HTTP 상태를 단언하지 않는다
 *
 * `resourceFromSlug` 가 `notFound()` 를 던지면 루트 `app/not-found.tsx` 가
 * 뜬다. 그 응답의 HTTP 상태는 스트리밍 여부에 따라 200 일 수도 404 일 수도
 * 있다(Next 문서 `not-found.md`: "Next.js will return a `200` HTTP status
 * code for streamed responses, and `404` for non-streamed responses" -
 * 실측 결과는 `app/(admin)/[slug]/resource.ts` 머리말). 그래서 단언은
 * 화면(찾을 수 없음 제목·홈 링크)이고, 404 가 오더라도 `consoleGuard` 가
 * 그 응답을 실패로 세지 않도록 미리 선언한다.
 */

const PASSWORD = 'probe-operator-password'

function uniqueEmail(label: string): string {
  return probeEmail(`probe-e2e-reference-${label}`)
}

/** 씨앗 분류 이름의 접두사 - `seed/examples.sql`·`examples.rails.sql` 양쪽에서 같다. */
const SEED_NAME_PREFIX = '프로브'
const CATEGORY_ONE = '프로브 분류 하나'
const CATEGORY_TWO = '프로브 분류 둘'

test.describe('읽기 전용 자원', () => {
  test('분류 목록은 씨앗 이름을 보이고 쓰기 UI 가 없으며, 행을 누르면 폼 없는 상세가 열린다', async ({
    page,
  }) => {
    await provisionAndSignIn(page, uniqueEmail('categories'), PASSWORD)

    await page.goto(`/categories?${new URLSearchParams({ name: SEED_NAME_PREFIX }).toString()}`)
    // 셸 헤더의 제목 - 선언의 라벨이다(components/site-header-title.ts).
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('분류')

    // 선택 열이 없으므로 첫 칸이 이름이다(examples.spec.ts 의 titleCells 는
    // 선택 열 때문에 둘째 칸을 본다).
    const nameCells = page.locator('tbody tr td:nth-child(1)')
    await expect(nameCells).toHaveCount(2)
    await expect(page.getByRole('link', { name: CATEGORY_ONE })).toBeVisible()
    await expect(page.getByRole('link', { name: CATEGORY_TWO })).toBeVisible()

    // 쓰기 UI 가 없다 - 체크박스(선택 열)도, "새로 만들기"도. 링크지만
    // button 역할로 찾는다 - base UI Button 이 `nativeButton={false}` 인
    // <a> 에 role="button" 을 얹는다(app/not-found.tsx 의 실측).
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '새로 만들기' })).toHaveCount(0)

    await page.getByRole('link', { name: CATEGORY_ONE }).click()
    await expect(page).toHaveURL(/\/categories\/[^/]+$/)
    // h1 이 둘이다 - 셸 헤더("분류 상세")와 화면 자신의 제목. 마지막 것이
    // 화면 것이다(examples.spec.ts 와 같은 이유).
    await expect(page.getByRole('heading', { level: 1 }).last()).toHaveText(CATEGORY_ONE)
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('분류 상세')
    // 폼도 위험 구역도 없다 - 저장된 값 카드 하나뿐이다(스펙 6.4).
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '삭제' })).toHaveCount(0)
    await expect(page.getByText('이름', { exact: true })).toBeVisible()
  })

  test('선언에 없는 슬러그는 찾을 수 없음 화면이다', async ({ page, consoleGuard }) => {
    await provisionAndSignIn(page, uniqueEmail('nope'), PASSWORD)

    // 404 로 오면 선언되지 않은 HTTP 실패로 세어 테스트가 죽는다 - 이 응답은
    // 이 테스트가 의도한 것이다(파일 머리말 "없는 슬러그" 절).
    consoleGuard.expectHttpFailure(/\/nope(\?|$)/)
    await page.goto('/nope')

    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible()
    await expect(page.getByRole('button', { name: '홈으로 이동' })).toBeVisible()
  })
})
