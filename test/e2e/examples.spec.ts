import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, provisionAndSignIn, test } from './fixtures'
import { probeEmail } from './probe-email'

/**
 * `examples` E2E - 목록의 서버 정렬(Step 7), 생성 폼의 Base UI 폼 참여(Step 7b),
 * 다국어 오류(Step 8).
 *
 * ## 씨앗과 격리 - `test/e2e/seed/examples.sql`
 *
 * 목록·정렬·페이지 이동을 재려면 여러 건이 필요한데 분류·라벨에는 쓰기
 * 라우트가 없다(`lib/resources/category.ts`·`tag.ts` 의 `writable: false`).
 * 그래서 compose 의 `seed-*` 서비스가 SQL 로 여섯 건을 넣는다 - 근거는 그
 * SQL 파일 머리말이다.
 *
 * 이 파일의 목록 시나리오는 씨앗 행을 바꾸지 않는다(읽기 전용). 생성 폼
 * 시나리오가 만드는 행과 섞이지 않도록, 목록 단언은 `title=probe-seed` 로
 * 좁혀서 본다(`SEED_PREFIX`) - 생성 시나리오는 `probe-create` 접두사만
 * 쓴다(`test/e2e/seed/README.md` 의 계약).
 *
 * ## Step 7 - 정렬이 실제로 서버를 태우는가
 *
 * Task 8 은 `sortedRowModel`·`filteredRowModel` 을 등록하지 않는 것으로
 * "정렬은 백엔드가 소유한다"를 설계했다(`lib/grid/table.ts`) - 그런데 그 계약이
 * 실제로 지켜지는지는 소스를 읽어서는 확인할 수 없다. 여기서 처음 세 쪽 중
 * 하나만 보이는 상태에서 정렬을 바꿔, **화면에 없던 행이 첫 행으로 온다**는
 * 것을 확인한다 - `sortedRowModel` 이 다시 등록되는 회귀(이미 받은 3건만
 * 클라이언트에서 재정렬)라면 화면에 없던 행은 영원히 첫 행이 될 수 없으므로
 * 이 단언이 죽는다.
 *
 * ## Step 7b - Base UI 가 정말 FormData 에 값을 넣는가
 *
 * `createExampleAction`(`app/(admin)/examples/actions.ts`)은 `FormData.get`/
 * `.getAll` 로 분류·라벨을 읽는데, Base UI 의 `Select`·`Checkbox` 는 네이티브
 * 입력이 아니라 숨은 `<input>` 을 곁에 렌더해 폼에 참여한다(근거:
 * `node_modules/@base-ui/react` 의 `SelectRoot.d.ts`·`CheckboxRoot.d.ts`). 이
 * 저장소에는 DOM 테스트 하네스가 없어 단위로는 원리상 덮을 수 없다 - 값이
 * 실리지 않으면 증상은 조용하다(`FormData.get` 이 `null`, 관계가 빠진 채
 * 201, 화면은 "분류 없음"을 정상처럼 그린다). 그래서 단정은 "제출이
 * 성공했다"가 아니라 "상세에 그 분류 이름과 그 라벨이 보인다"다.
 */

const SEED_PREFIX = 'probe-seed'
const ALPHA = `${SEED_PREFIX} alpha`
const BRAVO = `${SEED_PREFIX} bravo`
const CHARLIE = `${SEED_PREFIX} charlie`
const DELTA = `${SEED_PREFIX} delta`
const ECHO = `${SEED_PREFIX} echo`
const FOXTROT = `${SEED_PREFIX} foxtrot`

/** 생성 시나리오 전용 접두사 - 씨앗의 `probe-seed` 와 겹치지 않는다(seed/README.md). */
const CREATE_PREFIX = 'probe-create'

function uniqueTitle(label: string): string {
  return `${CREATE_PREFIX}-${label}-${randomUUID()}`
}

function uniqueEmail(label: string): string {
  return probeEmail(`probe-e2e-examples-${label}`)
}

const PASSWORD = 'probe-operator-password'

/** 한글이 하나라도 있는가. 언어 왕복 테스트가 문구를 박지 않고 쓰는 술어다. */
const HANGUL = /[가-힣]/

/**
 * 목록 표의 제목 칸(`select` 다음의 첫 데이터 열) - 열 선언 순서는
 * `lib/resources/example.ts` 의 `columns` 다: 제목·설명·상태·점수·분류·라벨·
 * 생성일·수정일.
 *
 * 칸 **위치**로 잡는다. 제목 칸 안에는 상세로 가는 링크가 있지만(그 셀
 * 하나만 링크다 - `resource-grid.tsx`) 그 역할로 좁히지 않는다: 이 헬퍼가
 * 재려는 것은 "어느 행이 어떤 순서로 왔는가"이고, 링크가 아니라 칸이 그
 * 질문의 단위다. `toHaveText` 는 자손 텍스트를 읽으므로 링크가 있어도 그대로
 * 동작한다.
 */
function titleCells(page: Page) {
  return page.locator('tbody tr td:nth-child(2)')
}

async function expectTitles(page: Page, titles: readonly string[]): Promise<void> {
  await expect(titleCells(page)).toHaveText([...titles])
}

function listUrl(extra: Readonly<Record<string, string>> = {}): string {
  const query = new URLSearchParams({ title: SEED_PREFIX, ...extra })
  return `/examples?${query.toString()}`
}

test.describe('목록 - 서버 정렬', () => {
  test('정렬을 바꾸면 화면에 없던 행이 첫 행으로 오고, 다음 쪽에서도 정렬이 유지된다', async ({
    page,
  }) => {
    await provisionAndSignIn(page, uniqueEmail('sort'), PASSWORD)

    // 쪽 크기 3 - 씨앗 여섯 건이 정확히 두 쪽이 된다. 기본 정렬(`-createdAt`)의
    // 첫 쪽은 alpha·charlie·echo 다(seed/examples.sql 의 정렬 표).
    await page.goto(listUrl({ pageSize: '3' }))
    await expectTitles(page, [ALPHA, CHARLIE, ECHO])

    // 점수 열을 눌러 정렬을 바꾼다. TanStack 의 첫 클릭 방향(asc/desc)에
    // 기대지 않는다 - 실제로 반영된 `sort` 파라미터를 읽어 그 값에 맞는
    // 전역 순서를 기대한다(둘 다 이 파일이 직접 계산해 둔 값이다).
    await page.getByRole('button', { name: '점수', exact: true }).click()
    await expect(page).toHaveURL(/[?&]sort=-?score(&|$)/)

    const sortToken = new URL(page.url()).searchParams.get('sort')
    const descending = sortToken === '-score'

    // 점수 오름차순: charlie(0) alpha(12) echo(38) delta(63) bravo(77) foxtrot(94)
    // 점수 내림차순: foxtrot(94) bravo(77) delta(63) echo(38) alpha(12) charlie(0)
    const firstPage = descending ? [FOXTROT, BRAVO, DELTA] : [CHARLIE, ALPHA, ECHO]
    const secondPage = descending ? [ECHO, ALPHA, CHARLIE] : [DELTA, BRAVO, FOXTROT]

    // 핵심 단언 - 지금 막 정렬을 바꾸기 전 화면에는 foxtrot·bravo·delta·charlie
    // 중 누구도 없었다(첫 쪽은 alpha·charlie·echo 뿐이었다). 클라이언트가 그
    // 세 건만 재정렬하는 회귀라면 이 세 건 중 화면에 없던 행은 결코 첫 행이
    // 될 수 없다 - 즉 이 단언이 서버 왕복을 실제로 잰다.
    await expectTitles(page, firstPage)

    await page.getByRole('button', { name: '다음 쪽으로' }).click()
    await expect(page).toHaveURL((url) => url.searchParams.get('sort') === sortToken)
    await expectTitles(page, secondPage)

    /**
     * 번호 페이지네이션. 씨앗 여섯 건에 쪽당 셋이라 **정확히 두 쪽**이고, 그
     * 쪽 수는 백엔드가 준 `links.last` 에서 온다 - 화면이 총 건수를 나눠
     * 계산하지 않는다(`components/grid/pagination-model.ts`). 그래서 이
     * 단언은 그 링크가 세 백엔드에서 실제로 오는지까지 함께 잰다: 오지
     * 않으면 번호가 한 칸도 그려지지 않아 아래 `toHaveText` 가 죽는다.
     *
     * 역할이 `link` 가 아니라 `button` 인 것은 레지스트리 부품이
     * `nativeButton={false}` 로 base UI Button 을 쓰기 때문이다(실측) -
     * `<a href>` 이지만 base UI 가 `role="button"` 을 얹는다.
     */
    const pageNumbers = page.getByRole('button', { name: /^\d+쪽으로$/ })
    await expect(pageNumbers).toHaveText(['1', '2'])
    await expect(page.getByRole('button', { name: '2쪽으로' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // 지금 쪽에만 붙는다 - 둘 다 붙으면 "지금 어디"가 사라진다.
    await expect(page.getByRole('button', { name: '1쪽으로' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )

    // 번호를 눌러 첫 쪽으로 돌아온다 - 정렬은 그대로 유지된다(쪽 이동이
    // 필터·정렬을 지우면 이 단언이 죽는다).
    await page.getByRole('button', { name: '1쪽으로' }).click()
    await expect(page).toHaveURL((url) => url.searchParams.get('sort') === sortToken)
    await expectTitles(page, firstPage)
  })
})

test.describe('목록 - 필터', () => {
  /**
   * 필터 바가 **서버에서** 걸리는지 잰다. 클라이언트가 이미 받은 행만
   * 걸러내는 회귀라면 이 단언은 죽지 않는다 - 여섯 건이 모두 한 쪽에 있기
   * 때문이다. 그래서 URL 파라미터(`status`)와 남은 행을 **함께** 본다:
   * 파라미터가 실려야 `gridQuery` 가 `filter[status][exact]` 로 바꿔 보내고
   * (lib/grid/query.ts), 그 왕복이 없으면 남는 행이 달라진다.
   *
   * 씨앗 여섯 건의 상태는 `seed/examples.sql` 이 정한다 - archived 는
   * charlie·foxtrot 둘이고, 기본 정렬(`-createdAt`)에서 그 순서로 온다.
   */
  test('상태 필터를 걸면 그 상태의 행만 남고, 지우면 되돌아온다', async ({ page }) => {
    await provisionAndSignIn(page, uniqueEmail('filter'), PASSWORD)

    await page.goto(listUrl())
    await expectTitles(page, [ALPHA, CHARLIE, ECHO, FOXTROT, BRAVO, DELTA])

    // 선언의 보기 목록(`options: ['draft','active','archived']`)이 그대로
    // Select 가 된다(components/grid/filter-control.ts).
    await page.getByLabel('상태').click()
    await page.getByRole('option', { name: 'archived', exact: true }).click()
    // Select 를 고르는 것만으로는 이동하지 않는다 - 적용이 한 번에 일어난다
    // (`filter-bar.tsx` 머리말: 경로를 하나로 둔다).
    await expectTitles(page, [ALPHA, CHARLIE, ECHO, FOXTROT, BRAVO, DELTA])

    await page.getByRole('button', { name: '적용' }).click()
    await expect(page).toHaveURL((url) => url.searchParams.get('status') === 'archived')
    await expectTitles(page, [CHARLIE, FOXTROT])
    // 제목 필터(URL 에 이미 있던 것)가 함께 실려 나간다 - 적용이 폼 전체를
    // 읽으므로, 한 필터를 걸 때 다른 필터가 조용히 지워지면 이 단언이 죽는다.
    await expect(page).toHaveURL((url) => url.searchParams.get('title') === SEED_PREFIX)

    await page.getByRole('button', { name: '지우기' }).click()
    await expect(page).toHaveURL((url) => url.searchParams.get('status') === null)
    await expect(page).toHaveURL((url) => url.searchParams.get('title') === null)
    // 필터가 비면 archived 아닌 씨앗 행이 다시 보인다.
    await expect(titleCells(page).filter({ hasText: ALPHA })).toHaveCount(1)
  })
})

test.describe('생성 폼', () => {
  test('Select 로 고른 분류와 Checkbox 로 켠 라벨이 상세에 보인다', async ({ page }) => {
    await provisionAndSignIn(page, uniqueEmail('create'), PASSWORD)

    const title = uniqueTitle('happy')

    await page.goto('/examples/new')
    await expect(page.getByRole('heading', { name: '예제 만들기' })).toBeVisible()

    await page.getByLabel('제목').fill(title)
    await page.getByLabel('점수').fill('42')

    // Base UI Select - 트리거는 role=combobox, 보기는 열린 뒤에야 role=option
    // 으로 나타난다. getByLabel 로 트리거를 여는 것 자체가 useId() 가 label 과
    // 트리거를 실제로 묶었는지까지 함께 잰다.
    await page.getByLabel('분류').click()
    await page.getByRole('option', { name: '프로브 분류 하나', exact: true }).click()

    // Base UI Checkbox - 라벨이 htmlFor 로 묶여 있다. getByLabel 은 쓰지
    //않는다 - 라벨이 가리키는 id 가 보이는 role=checkbox 요소와 그 곁의
    // 숨은 aria-hidden 네이티브 <input> 양쪽에 걸려 있어(이 스텝이 재려는
    // 바로 그 사실) strict mode 위반이 난다. role 로 좁히면 aria-hidden
    // 요소는 접근성 트리에서 빠져 하나만 남는다.
    await page.getByRole('checkbox', { name: '프로브 라벨 하나', exact: true }).click()

    await page.getByRole('button', { name: '만들기' }).click()

    // 착지 - 성공하면 상세로 간다(actions.ts 의 createExampleAction).
    await expect(page).toHaveURL(/\/examples\/[^/]+$/)
    // h1 이 둘이다 - 셸 헤더(site-header.tsx)가 경로별 제목("예제 상세")을
    // 먼저 그리고, 화면 고유의 제목(이 예제 자신의 title)이 그 뒤에 온다.
    // 마지막 것이 화면 것이다.
    await expect(page.getByRole('heading', { level: 1 }).last()).toHaveText(title)

    // 이 태스크가 갚는 빚 - "제출이 성공했다"가 아니라 "그 분류 이름과 그
    // 라벨이 보인다"를 잰다. 숨은 input 에 값이 실리지 않았다면
    // FormData.get(CATEGORY_FIELD) 가 null 이라 관계가 조용히 빠지고, 그
    // 자리가 "없음"으로 그려져 아래 단언이 죽는다.
    //
    // 화면이 그 구획에 붙인 접근성 이름으로 찾는다(상세 화면 머리말이 이
    // 결합을 밝힌다). 예전에는 `[data-slot="card-description"]` - 카드
    // primitive 의 스타일 슬롯 - 으로 찾았는데, 설명을 가진 카드가 그 화면에
    // 하나 더 생기는 순간 Playwright strict mode 위반으로 깨졌다. 테스트가
    // 레이아웃을 못 건드리게 잠그는 결합이라 이름으로 바꿨다.
    const summary = page.getByRole('group', { name: '분류와 라벨' })
    await expect(summary).toContainText('프로브 분류 하나')
    await expect(summary).toContainText('프로브 라벨 하나')
    // "분류 없음"이 아니라 "없음" 자체를 본다 - 분류·라벨 어느 쪽이 빠져도
    // 잡힌다(앞 문구로는 라벨만 빠진 경우가 통과했다).
    await expect(summary, '숨은 input 이 비면 이 자리가 "없음"으로 그려진다').not.toContainText(
      '없음',
    )

    // 폼의 분류 트리거도 **이름**을 보여야 한다. 이 화면은 저장된 값을 들고
    // 새로 서므로 base UI 가 값(UUID)에서 라벨을 되찾아야 하고, 그 통로는
    // `items` prop 뿐이다(edit-form.tsx 의 `categoryItems`). 그것이 없던
    // 동안 이 자리에 UUID 가 그려졌고, 위 요약 카드만 보는 단언으로는
    // 잡히지 않았다 - 요약은 `included` 를 직접 읽기 때문이다.
    // `getByLabel('분류')` 이 아니라 role 로 좁힌다 - `getByLabel` 은 접근성
    // 이름을 **부분 문자열**로 맞추므로 위 group(`분류와 라벨`)까지 함께
    // 걸려 strict mode 위반이 난다(실측). 생성 화면의 같은 호출(위 Select
    // 열기)은 그 화면에 그 group 이 없어 여전히 하나만 맞는다.
    const categoryTrigger = page.getByRole('combobox', { name: '분류' })
    await expect(categoryTrigger).toContainText('프로브 분류 하나')
    await expect(categoryTrigger, 'items 를 넘기지 않으면 여기 UUID 가 그려진다').not.toContainText(
      /[0-9a-f]{8}-[0-9a-f]{4}/,
    )
  })
})

test.describe('다국어 오류', () => {
  /**
   * 로케일 다른 컨텍스트 둘로 생성 폼의 필드 오류를 띄우고 **영어 쪽에
   * 한글이 없는지** 본다. 한국어 쪽만 단언하면 배선(Accept-Language 전달)을
   * 지워도 통과한다 - 헤더가 빠지면 백엔드가 `ko` 로 떨어지기 때문이다.
   *
   * 같은 페이지 하나에서 `setExtraHTTPHeaders` 로 언어만 바꿔 가며 두 번
   * 왕복한다 - 로그인 컨텍스트를 두 벌 열 필요가 없다.
   */
  test('생성 검증 오류 문구가 브라우저 언어를 따른다', async ({ page }) => {
    await provisionAndSignIn(page, uniqueEmail('locale'), PASSWORD)
    await page.goto('/examples/new')

    // 제목은 새 폼의 기본값이 이미 빈 문자열이다 - 비우는 동작이 따로 필요
    // 없다. 점수만 채워 그 필드는 통과시킨다.
    async function submitEmptyTitle(): Promise<void> {
      await page.getByLabel('점수').fill('1')
      await page.getByRole('button', { name: '만들기' }).click()
    }

    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US' })
    await submitEmptyTitle()

    const titleInput = page.getByLabel('제목')
    await expect(titleInput).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await titleInput.getAttribute('aria-describedby')
    expect(describedBy, '제목 입력이 aria-describedby 로 오류 목록을 가리켜야 한다').not.toBeNull()
    const fieldError = page.locator(`#${describedBy ?? ''}`)

    const english = (await fieldError.innerText()).trim()
    expect(english).not.toBe('')
    expect(english).not.toMatch(HANGUL)

    await page.setExtraHTTPHeaders({ 'accept-language': 'ko-KR' })
    await submitEmptyTitle()

    // 같은 폼 컴포넌트 인스턴스라 id 는 그대로고 문구만 갱신된다 - 영어에서
    // 한글로 바뀔 때까지 기다린다(그러지 않으면 아직 갱신 전인 영어 문구를
    // 그대로 다시 읽는 경합이 생긴다).
    await expect(fieldError).toContainText(HANGUL)
    const korean = (await fieldError.innerText()).trim()

    expect(korean).not.toBe('')
    expect(english, '두 언어가 같은 문구면 Accept-Language 가 전달되지 않은 것이다').not.toBe(
      korean,
    )
  })
})
