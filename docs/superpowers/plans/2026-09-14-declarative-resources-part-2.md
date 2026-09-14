# 선언 하나로 자원 화면 전부 - 둘째 계획: 라우트와 셸

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `app/(admin)/examples/` 를 지우고 동적 세그먼트 `app/(admin)/[slug]/` 한 벌이 선언된 자원 전부의 목록·생성·상세 화면을 그리게 하며, 사이드바·헤더 제목·대시보드 카드가 `RESOURCES` 에서 나오게 한다. 끝나면 새 자원은 선언 파일 하나와 `index.ts` 한 줄로 화면 전부를 얻는다(스펙 1.1).

**Architecture:** 세 화면의 첫 줄이 `resourceFromSlug(slug)` 다 - 선언에 없으면 `notFound()`. Server Action 넷은 `slug` 를 첫 인자로 받고 첫 줄에서 `writableResource(slug)` 로 쓰기 가능 여부를 확인한다. 그리드는 `bulkDeleteAction` 이 있을 때만 선택 열을 그리고 `newHref` 가 있을 때만 "새로 만들기"를 그린다 - 둘 다 자원 이름을 모르는 prop 이라 `components/grid/` 의 규칙 안이다. 읽기 전용 자원의 상세는 폼 없이 카드 하나다. 정적 폴더 `app/(admin)/<slug>/` 가 있으면 그 자원만 그 파일로 그린다 - Next 의 라우트 정렬이 정적 자식을 `[slug]` 보다 먼저 낸다(스펙 2.3). 이번 구현은 그 덮어쓰기 예시를 남기지 않고 실측만 문서에 적는다(스펙 6.6).

**Tech Stack:** Next.js 16.3.4 App Router · React 19.2.8 · TypeScript 6.0.3 (strict · `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes`) · shadcn `base-nova` (`@base-ui/react` 1.8.0) · TanStack Table v9 · vitest · Playwright(Docker 위 실제 백엔드) · pnpm. prettier 는 `semi: false` · `singleQuote` · `printWidth: 100` · `trailingComma: all`.

**Spec:** `docs/superpowers/specs/2026-09-14-declarative-resources-design.md` - 5.3(파일 배치) · 6장(화면·라우트·셸·덮어쓰기·로딩) · 7.4(Server Action 넷) · 8장(새 갈래 셋) · 10.2(E2E) · 11장(실측 다섯) · 12장(문서)이 이 계획의 범위다. 첫째 계획(`2026-09-14-declarative-resources-part-1.md`, 브랜치 `feat/declarative-resources-1`, PR #1)이 선언 확장·`lib/form/`·`components/resource/` 를 끝냈고 이 계획은 그 위에 쌓인다.

## Global Constraints

- **계층 위반의 정의**(스펙 5.1, 루트 `AGENTS.md`): `app/(admin)/[slug]/` 는 세 화면 한 벌·Server Action 넷·요청 조립 튜플을 소유하고 `fetch` 직접 호출·쿼리 조립은 소유하지 않는다. `components/grid/*` · `components/resource/*` 에 자원 이름으로 분기하는 코드가 있으면 위반이다 - 이 계획이 그리드에 더하는 `newHref` 와 선택 열 조건은 둘 다 prop 의 유무로 갈리지 자원 이름으로 갈리지 않는다. `lib/form/*` · `components/resource/*` 에 실제 자원 이름·필드 이름 리터럴이 코드로 나타나면 위반이다.
- **`app/` 는 자원 이름을 알아도 된다** - 단, 이 계획이 끝나면 `app/(admin)/[slug]/` 아래에는 `examples` · `exampleCategories` · `exampleTags` · `title` · `category` 같은 리터럴이 **코드로** 하나도 남지 않는다(주석의 설명은 대상이 아니다). 대시보드의 최근 표(`app/(admin)/page.tsx` 의 `resourceByType('examples')`·`recent.ts` 의 `RecentRow`)만 예외다 - 스펙 6.5 가 표본으로 남기기로 정했다.
- **지시어 경계**(스펙 9장, 루트 `AGENTS.md` 규칙 6): `app/(admin)/[slug]/loading.tsx` · `new/loading.tsx` · `[id]/loading.tsx` 셋은 `'use client'`(`useParams`). `actions.ts` 는 `'use server'` 이고 **동기 함수를 export 하지 않는다** - `writableResource` 는 지시어 없는 `resource.ts` 에 둔다. `resource.ts` 는 `next/navigation` 의 `notFound` 만 값으로 가져온다. 비-클라이언트 모듈은 `'use client'` 모듈의 값을 호출하지 않는다 - `test/unit/components/boundary-policy.test.ts` 가 저장소 전체를 훑어 기계적으로 잰다.
- **오류 정책은 스펙 8장 그대로** - 읽기의 transport 만 던지고(`error.tsx`) 백엔드가 낸 오류는 `FormBanner`, 없는 id 는 `notFound()`, **선언에 없는 slug 는 `notFound()`**, **`writable` 아닌 자원의 `/new` 는 `notFound()`**, **`writable` 아닌 자원으로 쓰기 Action 은 던진다**, 목록의 관계 보기 목록 조회 실패는 접고(텍스트 입력), 생성·상세의 조회 실패는 화면 전체를 배너로.
- **로딩 상태에 텍스트를 쓰지 않는다.** 스켈레톤만 두고 열 수·필터 수·필드 수는 `useParams` 로 읽은 slug 의 선언에서 센다. 선택 열은 `writable` 인 자원에만 있으므로 스켈레톤도 그 칸을 `writable` 일 때만 그린다.
- **URL 은 오늘과 같다** - `/examples` · `/examples/new` · `/examples/<id>` 가 그대로라 `auth.spec.ts` · `bulk.spec.ts` · `examples.spec.ts` 의 열두 시나리오가 회귀망이다. 상세 group 이름 `관계` 는 바꾸지 않는다. 새 `test/e2e/reference.spec.ts` 는 행을 만들지 않고 씨앗 분류 이름의 접두사 `프로브` 로 목록을 좁힌다(`test/AGENTS.md` 규칙 셋).
- **덮어쓰기 예시를 커밋하지 않는다**(스펙 6.6·13장). 실측용 `app/(admin)/examples/page.tsx` 는 재고 지운다 - 남으면 제네릭 화면이 `examples` 에서 검증되지 않는다.
- **스펙 11장의 실측 다섯**은 구현이 재고 결과를 그 자리의 주석과 `AGENTS.md` 에 **사실 문장**으로 적는다 - 잰 것만 적고, 재지 못한 것은 재지 못했다고 적는다.
- **사라질 자리를 인용하지 않는다.** 계획 문서·세션 스크래치패드·`D<숫자> Task`·`브랜치 리뷰` 표기를 코드·문서 주석에 쓰면 게이트 `[5/9]` 가 죽인다(`scripts/check-citations.sh`). 근거는 사실 문장으로 적는다.
- **커밋 메시지에 AI 관련 태그를 넣지 않는다.** 제목은 영어 한 줄, 본문은 한국어다(저장소 관례).
- **매 과업의 검증 명령**: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`. Task 4 와 Task 6 만 Docker 가 필요한 단계를 더 돈다. 라우트 파일을 옮기거나 지운 뒤 `TS2307` 이 나면 `rm -rf .next` 부터 한다(루트 `AGENTS.md` 규칙 4) - 이번 계획이 그 규칙이 실제로 걸리는 자리다(스펙 11장 5번).

## File Structure

| 위치 | 책임 | 이 계획에서 |
| --- | --- | --- |
| `components/grid/resource-grid.tsx` | `buildColumns(resource, selectable)` - 선택 열은 `bulkDeleteAction` 이 있을 때만. `newHref` prop 으로 "새로 만들기" | 수정 |
| `app/(admin)/[slug]/resource.ts` | `resourceFromSlug(slug)`(없으면 `notFound()`) · `writableResource(slug)`(없거나 읽기 전용이면 던진다) | 신규 |
| `app/(admin)/[slug]/list.ts` · `write.ts` · `bulk-outcome.ts` · `[id]/detail.ts` | 오늘 `examples/` 의 파일을 `git mv` 로 옮긴다. 코드는 그대로, 주석의 경로만 고친다 | 이동 |
| `app/(admin)/[slug]/options.ts` | 옮기고 `relationshipFilterRequests` · `filterOptionsFromResults` 를 더한다(목록의 관계 필터 보기 목록) | 이동+수정 |
| `app/(admin)/[slug]/actions.ts` | `createResourceAction(slug, prev, formData)` · `updateResourceAction(slug, id, prev, formData)` · `deleteResourceAction(slug, id)` · `bulkDeleteResourceAction(slug, id)` | 신규(옛 `examples/actions.ts` 를 대신한다) |
| `app/(admin)/[slug]/page.tsx` · `loading.tsx` | 목록. 관계 필터마다 대상 자원의 보기 목록을 병행 조회. `writable` 일 때만 `bulkDeleteAction` · `newHref` | 신규 |
| `app/(admin)/[slug]/new/page.tsx` · `new/loading.tsx` | 생성. `writable` 이 아니면 `notFound()` | 신규 |
| `app/(admin)/[slug]/[id]/page.tsx` · `[id]/loading.tsx` | 상세. `writable` 이면 두 열(폼·저장된 값·위험 구역), 아니면 카드 하나 | 신규 |
| `app/(admin)/examples/` 전체 | 손으로 쓴 라우트 | 삭제 |
| `app/(admin)/page.tsx` | 카운트 카드가 `RESOURCES` 를 돈다. `toSearchParams` 를 `./[slug]/list` 에서 가져온다 | 수정 |
| `app/not-found.tsx` | 머리말의 "아직 호출부가 없다"를 실제 호출부로 고친다 | 수정(주석) |
| `lib/resources/define.ts` · `index.ts` | `filterRelationshipKey(filterKey)` 를 export 한다(옛 비공개 `relationshipKeyOf`). 이연 항목: `columnKindOf` 의 exhaustive 가드, 주석 "두 곳"→"세 곳" | 수정 |
| `lib/form/write.ts` · `values.ts` | 이연 항목: `attributeOutcome` 을 `kind` switch 로, `attributeText` 의 `''` 규칙 주석 | 수정 |
| `components/nav-items.ts` | `DASHBOARD_NAV_ITEM` · `resourceNavItems()` - 지시어 없음, 단위 테스트가 부른다 | 신규 |
| `components/app-sidebar.tsx` | 항목을 `nav-items.ts` 에서 만든다. 자원 아이콘은 전부 `ListIcon` | 수정 |
| `components/site-header-title.ts` | 경로의 첫 세그먼트로 `resourceBySlug` - `label` · `<label> 만들기` · `<label> 상세` · 못 찾으면 `''` | 수정 |
| `components/section-cards.tsx` | `counts: ResourceCount[]` 하나를 받는다 | 수정 |
| `test/unit/slug/` | 오늘 `test/unit/examples/` 를 옮긴다 - `write.test.ts`(옛 `actions.test.ts`) · `list.test.ts` · `detail.test.ts` · `options.test.ts` · `bulk-outcome.test.ts` · 새 `resource.test.ts` | 이동+수정 |
| `test/unit/grid/resource-grid.test.ts` | `buildColumns` 의 선택 열 조건 | 수정 |
| `test/unit/components/sidebar.test.ts` · `site-header-title.test.ts` | 항목이 `RESOURCES` 순서·개수와 같다 · slug 기반 문구 규칙 | 수정 |
| `test/unit/resources/define.test.ts` · `test/unit/components/field-control.test.ts` | `filterRelationshipKey` · 이연 항목 테스트 둘 | 수정 |
| `test/e2e/reference.spec.ts` | 읽기 전용 자원의 목록·상세, 선언에 없는 슬러그 | 신규 |
| `test/e2e/examples.spec.ts` | 생성 시나리오가 목록의 "새로 만들기"로 진입. 빈 점수 시나리오(스펙 11장 3번의 실측) | 수정 |
| `README.md` · 루트 `AGENTS.md` · `app/AGENTS.md` · `lib/resources/AGENTS.md` · `components/AGENTS.md` · `test/AGENTS.md` · `docs/AGENTS.md` · `lib/AGENTS.md` · `lib/bulk/AGENTS.md` · `.github/workflows/ci.yml`(주석) | 새 자원 절차 두 단계, `[slug]` 절, 덮어쓰기 실측, 화면 표, 옛 경로 정리 | 수정 |
| `docs/superpowers/specs/2026-09-14-declarative-resources-design.md` | 구현과 어긋난 문장의 정정 註(6.1 · 6.5 · 7.1 · 7.2 · 9장 · 10.1)와 11장 실측 결과 | 수정 |

Task 2 가 라우트를 통째로 바꾸므로 그 과업이 끝날 때까지 사이드바·헤더는 옛 코드로 남고(URL 이 같아 동작한다), Task 3 이 셸을 잇는다. Task 1 의 그리드 변경은 옛 `examples/page.tsx` 와도 호환된다 - `newHref` 를 안 넘기면 버튼이 없고 `bulkDeleteAction` 은 오늘처럼 넘긴다.

---

### Task 1: 그리드 - 선택 열 조건화와 "새로 만들기"

**Files:**
- Modify: `components/grid/resource-grid.tsx`
- Test: `test/unit/grid/resource-grid.test.ts`

**Interfaces:**
- Consumes: 없음(첫 과업)
- Produces: `ResourceGrid` 의 새 prop `newHref?: string`; 선택 열·체크박스·"선택 N개" 문구는 `bulkDeleteAction` 이 있을 때만; `export function buildColumns(resource: ResourceDef, selectable: boolean)`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/unit/grid/resource-grid.test.ts` 의 import 에 `buildColumns` 를 더하고(기존 이름들 사이, 알파벳순) 파일 끝에 붙인다:

```ts
describe('buildColumns', () => {
  it('bulkDeleteAction 이 있을 때만 선택 열이 맨 앞에 붙는다 - 읽기 전용 자원은 선언한 열뿐이다', () => {
    const selectable = buildColumns(EXAMPLES, true)
    const readOnly = buildColumns(EXAMPLES, false)
    expect(selectable[0]?.id).toBe('select')
    expect(selectable).toHaveLength(EXAMPLES.columns.length + 1)
    expect(readOnly[0]?.id).toBe(EXAMPLES.columns[0]?.key)
    expect(readOnly).toHaveLength(EXAMPLES.columns.length)
  })

  it('선언한 열의 id 는 열 키 그대로다 - 선택 열 유무와 무관하다', () => {
    const keys = EXAMPLES.columns.map((column) => column.key)
    expect(buildColumns(EXAMPLES, false).map((column) => column.id)).toEqual(keys)
    expect(buildColumns(EXAMPLES, true).slice(1).map((column) => column.id)).toEqual(keys)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run test/unit/grid/resource-grid.test.ts`
Expected: FAIL - `buildColumns` 는 export 되지 않았고 인자도 하나뿐이다.

- [ ] **Step 3: 그리드를 고친다**

`components/grid/resource-grid.tsx` 에서 다음을 바꾼다.

lucide import 에 `PlusIcon` 을 더한다:

```ts
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  Columns3Icon,
  PlusIcon,
} from 'lucide-react'
```

파일 머리말(`/** \`examples\`·\`exampleCategories\`·\`exampleTags\` 어느 자원이든 …`)의 마지막 문단을 다음으로 바꾼다:

```
 * `bulkDeleteAction` 을 받으면(쓰기 가능한 자원만) 선택 열·선택 바·확인 줄·
 * 진행률·결과 표가 나타난다 - 어느 것도 자원 이름으로 분기하지 않는다. 받지
 * 않으면 선택 열 자체를 그리지 않는다 - 예전에는 `enableRowSelection: true`
 * 가 무조건이라 읽기 전용 자원에도 아무 일도 못 하는 체크박스가 그려졌다.
 * `newHref` 를 받으면 툴바에 "새로 만들기" 링크가 생긴다 - 이 두 prop 의
 * 유무가 곧 그 자원이 쓰기 가능한가이고, 그 판단은 호출부(`app/`)가 선언의
 * `writable` 을 읽어 한다. `runBulk` 을 실제로 돌리는 것도, `id` 마다
 * `JsonApiResult` 를 `BulkOutcome` 으로 바꾸는 것도 이 컴포넌트가 아니라
 * 호출부가 넘긴 Action 의 일이다 - 이 파일은 그 결과를 `bulk-result.tsx` 의
 * `summarize` 로 읽어 표시만 한다.
```

`function buildColumns(resource: ResourceDef) {` 를 다음으로 바꾼다 - export 하고, 선택 열을 조건으로 만든다:

```tsx
/**
 * `selectable` 이면 선택 열이 맨 앞에 붙는다. export 하는 이유는 이 파일의
 * 다른 순수 함수들과 같다 - `test/unit/grid/resource-grid.test.ts` 가 "선택
 * 열은 `bulkDeleteAction` 이 있을 때만"을 DOM 없이 잰다.
 */
export function buildColumns(resource: ResourceDef, selectable: boolean) {
  const selectColumn = columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="전체 선택"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="행 선택"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  })

  return [
    ...(selectable ? [selectColumn] : []),
    ...resource.columns.map((column) =>
      // 반환 타입을 unknown 으로 못박는다 - display 열(TValue=unknown)과 같은
      // 배열에 담이므로, 여기서 GridCellValue 로 추론되게 두면 콜백 인자
      // 위치의 반변성 때문에 배열 전체의 타입이 통합되지 않는다(실측: 이
      // 캐스팅 없이 tsc 가 footer/header 템플릿 불일치로 거절했다). 실제
      // 값이 GridCellValue 라는 사실은 extractCell 이 보장하므로 cell 에서
      // 되돌려 잰다.
      columnHelper.accessor((row): unknown => row.cells[column.key] ?? null, {
        id: column.key,
        header: ({ column: tableColumn }) =>
          column.sortable ? (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground"
              onClick={tableColumn.getToggleSortingHandler()}
            >
              {column.label}
              {tableColumn.getIsSorted() === 'asc' && <ChevronUpIcon className="size-3.5" />}
              {tableColumn.getIsSorted() === 'desc' && <ChevronDownIcon className="size-3.5" />}
              {tableColumn.getIsSorted() === false && (
                <ChevronsUpDownIcon className="size-3.5 opacity-40" />
              )}
            </button>
          ) : (
            column.label
          ),
        cell: ({ getValue }) => renderCell(column.kind, getValue() as GridCellValue),
        enableSorting: column.sortable,
        enableHiding: true,
      }),
    ),
  ]
}
```

`ResourceGrid` 의 props 타입에 `filterOptions` 다음으로 더한다(`ResourceGridInner` 의 인라인 타입에도 같은 줄을 더한다):

```tsx
  /**
   * 있으면 툴바에 "새로 만들기" 링크를 그린다. `rowHrefBase` 와 같은 이유로
   * 완성된 문자열이다 - 이 파일은 어느 자원인지도, 그 자원에 생성 화면이
   * 있는지도 모른다. 호출부가 선언의 `writable` 을 읽어 넘기거나 넘기지 않는다.
   */
  newHref?: string
```

`ResourceGridInner` 의 구조 분해에 `newHref` 를 더하고, 본문에서 다음 넷을 바꾼다:

1. `const columns = React.useMemo(() => buildColumns(resource), [resource])` →

```tsx
  const selectable = bulkDeleteAction !== undefined
  const columns = React.useMemo(() => buildColumns(resource, selectable), [resource, selectable])
```

2. `useTable` 옵션의 `enableRowSelection: true,` → `enableRowSelection: selectable,`

3. 툴바 첫 줄(`<div className="flex items-center justify-between">` 안)을 다음으로 바꾼다 - 총 건수는 그대로, 오른쪽에 "새로 만들기"(있을 때)와 열 드롭다운:

```tsx
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">총 {rowCount}건</p>
        <div className="flex items-center gap-2">
          {newHref !== undefined && (
            // nativeButton={false}: render 대상이 <button> 이 아니라 Next 의
            // <Link>(<a>)다 - `app/not-found.tsx` 의 같은 자리 주석이 실측을
            // 적어 뒀다(base UI 가 <a> 에 role="button" 을 얹는다 - E2E 는
            // 그래서 이 링크를 button 역할로 찾는다).
            <Button render={<Link href={newHref} />} nativeButton={false} size="sm">
              <PlusIcon data-icon="inline-start" />
              새로 만들기
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />열
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {resource.columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={table.getColumn(column.key)?.getIsVisible() ?? true}
                  onCheckedChange={(value) => table.getColumn(column.key)?.toggleVisibility(!!value)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
```

4. 하단 문구(`<p className="text-sm text-muted-foreground">선택 {…}개 · 이 페이지 …`)를 다음으로 바꾼다 - 선택 열이 없는 표에 "선택 0개"를 적지 않는다:

```tsx
        <p className="text-sm text-muted-foreground">
          {selectable ? `선택 ${table.getFilteredSelectedRowModel().rows.length}개 · ` : ''}이 페이지{' '}
          {table.getRowModel().rows.length}개 (전체 {rowCount}건)
        </p>
```

`rowHrefBase` prop 의 주석에서 "참조용 자원처럼 상세 화면이 없는 것은 그냥 넘기지 않는다" 문장을 "오늘은 선언된 자원 전부가 상세 화면을 가지므로 호출부가 항상 넘기지만, 이 파일은 여전히 그 사실을 모른다" 로 바꾼다(그 앞뒤 문장은 그대로 둔다).

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `test/unit/grid/resource-grid.test.ts` 의 새 테스트 둘이 통과한다.

- [ ] **Step 5: 커밋**

```bash
git add components/grid/resource-grid.tsx test/unit/grid/resource-grid.test.ts
git commit -F - <<'EOF'
feat: gate the grid's selection column and add a new-item link

선택 열·체크박스·"선택 N개" 문구는 `bulkDeleteAction` 을 받았을 때만
그린다 - 읽기 전용 자원에 아무 일도 못 하는 체크박스가 그려지던 것을
없앤다. `newHref` 를 받으면 툴바에 "새로 만들기" 링크를 그린다. 둘 다
prop 의 유무로 갈리고 자원 이름은 모른다. `buildColumns` 를 export 해
선택 열 조건을 단위 테스트가 DOM 없이 잰다.
EOF
```

---
### Task 2: `app/(admin)/[slug]/` 한 벌 - 라우트 교체와 `examples` 폴더 삭제

**Files:**
- Modify: `lib/resources/define.ts`(`filterRelationshipKey` export) · `lib/resources/index.ts`(재수출)
- Create: `app/(admin)/[slug]/resource.ts` · `app/(admin)/[slug]/actions.ts` · `app/(admin)/[slug]/page.tsx` · `app/(admin)/[slug]/loading.tsx` · `app/(admin)/[slug]/new/page.tsx` · `app/(admin)/[slug]/new/loading.tsx` · `app/(admin)/[slug]/[id]/page.tsx` · `app/(admin)/[slug]/[id]/loading.tsx`
- Move(`git mv`): `app/(admin)/examples/list.ts` · `write.ts` · `bulk-outcome.ts` · `options.ts` → `app/(admin)/[slug]/`, `app/(admin)/examples/[id]/detail.ts` → `app/(admin)/[slug]/[id]/detail.ts`
- Modify: `app/(admin)/[slug]/options.ts`(관계 필터 보기 목록 둘) · 옮긴 넷의 주석 경로
- Delete: `app/(admin)/examples/` 에 남는 전부(`page.tsx` · `loading.tsx` · `actions.ts` · `new/page.tsx` · `new/loading.tsx` · `[id]/page.tsx` · `[id]/loading.tsx`)
- Modify: `app/(admin)/page.tsx`(import 한 줄) · `app/not-found.tsx`(주석)
- Test: `test/unit/examples/` → `test/unit/slug/`(`git mv`), `actions.test.ts` → `write.test.ts`, 새 `resource.test.ts`, `options.test.ts` 에 describe 둘, `test/unit/resources/define.test.ts` 에 `filterRelationshipKey`

**Interfaces:**
- Consumes: `ResourceGrid.newHref` · 선택 열 조건(Task 1). 첫째 계획의 `ResourceForm` · `RelationshipBadges` · `AttributeTable` · `initialFormValues` · `readOnlyAttributes` · `formAttributes` · `resourceBySlug`.
- Produces: `resourceFromSlug(slug: string): ResourceDef` · `writableResource(slug: string): ResourceDef` · `createResourceAction(slug, previous, formData)` · `updateResourceAction(slug, id, previous, formData)` · `deleteResourceAction(slug, id)` · `bulkDeleteResourceAction(slug, id)` · `relationshipFilterRequests(resource, lang): readonly OptionRequestPlan[]` · `filterOptionsFromResults(plans, results): Readonly<Record<string, readonly OptionItem[]>>` · `filterRelationshipKey(filterKey: string): string | null`. `toSearchParams` 의 새 자리 `app/(admin)/[slug]/list.ts`.

- [ ] **Step 1: `filterRelationshipKey` 를 export 한다**

`lib/resources/define.ts` 에서 비공개 `relationshipKeyOf` 를 다음으로 바꾼다(호출부 `deriveFilter` 의 `relationshipKeyOf(filter.key)` 도 `filterRelationshipKey(filter.key)` 로):

```ts
/**
 * `관계.id` 꼴 필터 키에서 관계 키를 얻는다. 그 꼴이 아니면 `null`.
 * `deriveFilter` 가 라벨을 유도할 때, 그리고 목록 화면이 관계 필터의 보기
 * 목록을 어느 자원에서 조회할지 정할 때(`app/(admin)/[slug]/options.ts`)
 * 같은 판정을 쓴다 - 접미사 `.id` 를 두 곳이 각자 자르면 한쪽만 바뀌는 날
 * 필터 라벨과 보기 목록이 서로 다른 관계를 가리킨다.
 */
export function filterRelationshipKey(filterKey: string): string | null {
  const suffix = '.id'
  return filterKey.endsWith(suffix) ? filterKey.slice(0, -suffix.length) : null
}
```

`lib/resources/index.ts` 의 값 재수출 줄을 다음으로 바꾼다:

```ts
export { filterRelationshipKey, formAttributes, isRequiredAttribute, readOnlyAttributes } from './define'
```

`test/unit/resources/define.test.ts` 의 import 에 `filterRelationshipKey` 를 더하고(`@/lib/resources/define` 에서) 파일 끝에 붙인다:

```ts
describe('filterRelationshipKey', () => {
  it('관계.id 꼴이면 관계 키, 아니면 null 이다', () => {
    expect(filterRelationshipKey('owner.id')).toBe('owner')
    expect(filterRelationshipKey('name')).toBeNull()
    expect(filterRelationshipKey('id')).toBeNull()
  })
})
```

Run: `pnpm vitest run test/unit/resources`
Expected: PASS.

- [ ] **Step 2: 옮길 파일을 옮긴다**

```bash
mkdir -p "app/(admin)/[slug]/[id]" "app/(admin)/[slug]/new"
git mv "app/(admin)/examples/list.ts" "app/(admin)/[slug]/list.ts"
git mv "app/(admin)/examples/write.ts" "app/(admin)/[slug]/write.ts"
git mv "app/(admin)/examples/bulk-outcome.ts" "app/(admin)/[slug]/bulk-outcome.ts"
git mv "app/(admin)/examples/options.ts" "app/(admin)/[slug]/options.ts"
git mv "app/(admin)/examples/[id]/detail.ts" "app/(admin)/[slug]/[id]/detail.ts"
git mv test/unit/examples test/unit/slug
git mv test/unit/slug/actions.test.ts test/unit/slug/write.test.ts
```

옮긴 넷의 주석에서 경로만 고친다(코드는 손대지 않는다):

- `[slug]/list.ts`: 고칠 것 없음(경로 언급이 없다).
- `[slug]/write.ts` 머리말: "`../list.ts` 의 `listRequest` · `./[id]/detail.ts` 의 `detailRequest`" 는 상대 경로라 그대로 맞다. "둘째 계획이 이 파일을 `[slug]/write.ts` 로 옮긴다." 문장을 "어느 자원에도 같은 코드가 동작한다 - `actions.ts` 가 `slug` 로 찾은 선언을 그대로 넘긴다." 로 바꾼다.
- `[slug]/bulk-outcome.ts` 머리말: "이 판정이 `'use client'` 파일(예전의 `components/grid/bulk-result.tsx` 의 `classify`)에" 는 그대로. "단건 삭제(`actions.ts` 의 `deleteExampleAction`)" → "단건 삭제(`actions.ts` 의 `deleteResourceAction`)".
- `[slug]/[id]/detail.ts` 머리말: "`examples` 는 `includes: ['category', 'tags']` 라" 는 사실 설명이라 그대로 둔다. "생성 폼의 선택 목록은 이 함수가 아니라 ../options.ts 의" 는 상대 경로라 그대로 맞다.

- [ ] **Step 3: `resource.ts` 를 만든다 - 테스트 먼저**

`test/unit/slug/resource.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resourceFromSlug, writableResource } from '@/app/(admin)/[slug]/resource'
import { resourceByType } from '@/lib/resources'

/**
 * `notFound()`(next/navigation)는 요청 스코프 없이도 던진다 - digest 를 단
 * `Error` 를 throw 할 뿐이라(실측: `node_modules/next/dist/client/components/
 * not-found.js`) vitest(node)에서 그대로 부를 수 있다. `redirect()`·
 * `cookies()` 와 다른 점이고, 그래서 이 파일은 요청 스코프 API 를 스텁하지
 * 않는 저장소 관례를 어기지 않는다.
 */
describe('resourceFromSlug', () => {
  it('선언된 slug 는 그 선언이다', () => {
    expect(resourceFromSlug('examples')).toBe(resourceByType('examples'))
    expect(resourceFromSlug('categories')).toBe(resourceByType('exampleCategories'))
  })

  it('선언에 없는 slug 는 notFound() 로 던진다', () => {
    expect(() => resourceFromSlug('nope')).toThrow()
  })

  it('type 으로는 찾지 않는다 - slug 와 type 이 다른 자원이 그 증거다', () => {
    // exampleCategories 의 slug 는 categories 다. type 을 넘기면 404 여야 한다.
    expect(() => resourceFromSlug('exampleCategories')).toThrow()
  })
})

describe('writableResource', () => {
  it('쓰기 가능한 자원은 그 선언이다', () => {
    expect(writableResource('examples')).toBe(resourceByType('examples'))
  })

  it('읽기 전용 자원은 던진다 - 화면이 제공하지 않는 경로라 사용자 문구가 없다', () => {
    expect(() => writableResource('categories')).toThrow('categories')
  })

  it('선언에 없는 slug 도 던진다', () => {
    expect(() => writableResource('nope')).toThrow('nope')
  })
})
```

Run: `pnpm vitest run test/unit/slug/resource.test.ts`
Expected: FAIL - 모듈이 없다.

`app/(admin)/[slug]/resource.ts`:

```ts
import { notFound } from 'next/navigation'
import { resourceBySlug, type ResourceDef } from '@/lib/resources'

/**
 * URL 의 첫 세그먼트(`slug`) → 자원 선언. 이 디렉터리의 세 화면이 첫 줄에서
 * 부른다 - 선언에 없는 slug 는 `notFound()` 로 루트 `app/not-found.tsx` 에
 * 간다(그 파일은 `(admin)` 셸 밖에서 뜬다 - 루트 `AGENTS.md` 규칙 2).
 * `generateStaticParams` + `dynamicParams = false` 로 같은 404 를 얻는 길은
 * 쓰지 않는다 - 코드 한 줄이 같은 일을 하고, 정적 파라미터 등록이
 * 프리렌더와 얽히는 자리를 만들지 않는다.
 *
 * Next 16 의 `params` 는 Promise 라 화면이 먼저 `await` 하고 문자열을
 * 넘긴다.
 *
 * `notFound()` 는 요청 스코프 없이도 던진다 - digest 를 단 `Error` 를
 * throw 할 뿐이다(실측: `node_modules/next/dist/client/components/not-found.js`).
 * 그래서 `test/unit/slug/resource.test.ts` 가 이 함수를 직접 부른다 -
 * `redirect()`·`cookies()` 를 스텁하지 않는 저장소 관례와 부딪히지 않는다.
 *
 * 지시어가 없다 - `actions.ts`(`'use server'`)가 `writableResource` 를 값으로
 * 부르고, 그 파일은 동기 함수를 export 할 수 없다(루트 `AGENTS.md` 규칙 6).
 */
export function resourceFromSlug(slug: string): ResourceDef {
  const resource = resourceBySlug(slug)
  if (resource === undefined) notFound()
  return resource
}

/**
 * 쓰기 Action 넷의 첫 줄. 선언에 없거나 `writable` 이 아니면 **던진다** -
 * `notFound()` 가 아니다. 화면이 그 경로(읽기 전용 자원의 생성 화면·저장·
 * 삭제 버튼)를 아예 제공하지 않으므로 사용자 문구를 두지 않는다. 던지면
 * `app/error.tsx` 가 받는다 - 그 화면의 "연결할 수 없다"는 문구가 이 경우엔
 * 거짓이지만, 이 경로는 화면 밖에서 Action 을 직접 부를 때만 열린다.
 */
export function writableResource(slug: string): ResourceDef {
  const resource = resourceBySlug(slug)
  if (resource === undefined) {
    throw new Error(`선언에 없는 자원입니다: ${slug}`)
  }
  if (!resource.writable) {
    throw new Error(`쓰기 라우트가 없는 자원입니다: ${slug}`)
  }
  return resource
}
```

Run: `pnpm vitest run test/unit/slug/resource.test.ts`
Expected: PASS.

- [ ] **Step 4: 목록의 관계 필터 보기 목록 - 테스트 먼저**

`test/unit/slug/options.test.ts` 전체를 다음으로 바꾼다(import 경로가 `[slug]` 로 바뀌고 describe 둘이 는다):

```ts
import { describe, expect, it } from 'vitest'
import {
  filterOptionsFromResults,
  optionsByRelationship,
  optionsRequest,
  relationshipFilterRequests,
  relationshipOptionRequests,
  unwrapOptionsResult,
} from '@/app/(admin)/[slug]/options'
import type { JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { resourceByType } from '@/lib/resources'
import { defineResource } from '@/lib/resources/define'
import { SAMPLE_INPUT } from '../../fixtures/resources'

const CATEGORIES = resourceByType('exampleCategories')!
const EXAMPLES = resourceByType('examples')!

describe('optionsRequest', () => {
  it('page[size]=100 만 싣고 include 는 절대 싣지 않는다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options.query?.get('page[size]')).toBe('100')
    expect(options.query?.has('include')).toBe(false)
  })

  it('resource.includes 가 채워진 자원을 넘겨도 include 를 만들지 않는다 - listRequest 를 재사용하지 않는다는 계약 자체를 잰다', () => {
    // EXAMPLES.includes 는 ['category', 'tags'] 다(비지 않았다). exampleCategories·
    // exampleTags 가 오늘 우연히 빈 includes 를 가져서 위 테스트가 통과하는
    // 것이 아니라는 것을 보이려는 자리 - optionsRequest 가 listRequest 처럼
    // resource.includes 를 읽어 include 를 만드는 코드 경로로 "단순화"되면
    // (그 코드 경로 자체가 없어야 한다는 것이 이 파일 머리말의 요지다), 이
    // 자원에서는 그 리팩터가 즉시 여기서 드러난다.
    const [, options] = optionsRequest(EXAMPLES, null)
    expect(options.query?.has('include')).toBe(false)
  })

  it('경로는 그 자원의 것이다', () => {
    expect(optionsRequest(CATEGORIES, null)[0]).toBe(CATEGORIES.path)
  })

  it('Accept-Language 를 그대로 싣는다', () => {
    const [, options] = optionsRequest(CATEGORIES, 'ko')
    expect(options.acceptLanguage).toBe('ko')
  })

  it('Accept-Language 가 없으면(null) 그 헤더 옵션 자체가 없다', () => {
    const [, options] = optionsRequest(CATEGORIES, null)
    expect(options).not.toHaveProperty('acceptLanguage')
  })
})

describe('unwrapOptionsResult', () => {
  it('성공하면 문서를 그대로 돌려준다', () => {
    const document = { data: [] }
    expect(unwrapOptionsResult({ ok: true, status: 200, document })).toBe(document)
  })

  // 호출부가 `!result.ok` 를 messageForReadFailure(../read-result.ts)로 먼저
  // 걸러야 한다 - 이 함수 자신은 detail 을 더 이상 메시지에 싣지 않는다
  // (app/error.tsx 가 백엔드의 진짜 설명을 discard 하고 "연결할 수 없다"는
  // 거짓 문구를 보여주던 자리였다). 실패한 결과가 여기 도달하는 것 자체가
  // 호출부의 버그이므로, detail 내용과 무관하게 항상 같은 내부 오류 문구로
  // 던진다.
  it('실패한 결과가 오면(호출부가 걸렀어야 함) 내부 오류로 던진다 - detail 을 담지 않는다', () => {
    expect(() =>
      unwrapOptionsResult({
        ok: false,
        status: 400,
        errors: [{ detail: '허용되지 않은 include 입니다' }],
      }),
    ).toThrow('내부 오류')
  })

  it('204(document: null)면 던진다 - 조용히 빈 목록으로 다루지 않는다', () => {
    expect(() => unwrapOptionsResult({ ok: true, status: 204, document: null })).toThrow(
      '선택 목록 응답에 본문이 없습니다.',
    )
  })
})

describe('relationshipOptionRequests', () => {
  it('관계마다 대상 자원의 보기 목록 요청을 만든다 - 순서는 선언 순서다', () => {
    const plans = relationshipOptionRequests(EXAMPLES, 'ko')
    expect(plans.map((plan) => plan.key)).toEqual(['category', 'tags'])
    expect(plans.map((plan) => plan.target.type)).toEqual(['exampleCategories', 'exampleTags'])
    expect(plans[0]!.request[0]).toBe('/api/v1/categories')
    expect(plans[0]!.request[1].acceptLanguage).toBe('ko')
  })

  it('관계가 없는 자원은 빈 배열이다', () => {
    expect(relationshipOptionRequests(CATEGORIES, null)).toEqual([])
  })

  it('대상 자원이 선언에 없으면 던진다 - 불변식 테스트가 막지만 여기서도 조용히 넘어가지 않는다', () => {
    const ghost = defineResource({
      ...SAMPLE_INPUT,
      relationships: {
        owner: { cardinality: 'one', type: 'nowhere', label: '소유자', nullable: true },
      },
    })
    expect(() => relationshipOptionRequests(ghost, null)).toThrow('nowhere')
  })
})

describe('optionsByRelationship', () => {
  const plans = relationshipOptionRequests(EXAMPLES, null)

  it('성공한 결과를 관계 키별 보기 목록으로 편다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      {
        ok: true,
        status: 200,
        document: {
          data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
        },
      },
      {
        ok: true,
        status: 200,
        document: { data: [{ type: 'exampleTags', id: 't1', attributes: { name: '라벨 하나' } }] },
      },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({
      ok: true,
      options: {
        category: [{ id: 'c1', name: '분류 하나' }],
        tags: [{ id: 't1', name: '라벨 하나' }],
      },
    })
  })

  it('하나라도 실패하면 그 오류를 그대로 돌려준다 - 폼을 반쪽으로 그리지 않는다', () => {
    const errors = [{ status: '500', code: 'INTERNAL', detail: '망가짐' }]
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 200, document: { data: [] } },
      { ok: false, status: 500, errors },
    ]
    expect(optionsByRelationship(plans, results)).toEqual({ ok: false, errors })
  })

  it('204 는 던진다 - unwrapOptionsResult 의 판단 그대로', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: true, status: 204, document: null },
      { ok: true, status: 200, document: { data: [] } },
    ]
    expect(() => optionsByRelationship(plans, results)).toThrow('선택 목록 응답에 본문이 없습니다.')
  })

  it('계획과 결과의 수가 다르면 던진다 - 호출부의 버그다', () => {
    expect(() => optionsByRelationship(plans, [])).toThrow('내부 오류')
  })

  it('계획이 없으면(관계 없는 자원) 빈 보기 목록으로 성공한다', () => {
    expect(optionsByRelationship([], [])).toEqual({ ok: true, options: {} })
  })
})

describe('relationshipFilterRequests', () => {
  it('키가 관계.id 인 필터마다 대상 자원의 요청을 만든다 - 계획의 key 는 필터 키다', () => {
    const plans = relationshipFilterRequests(EXAMPLES, 'ko')
    expect(plans.map((plan) => plan.key)).toEqual(['category.id'])
    expect(plans[0]!.target.type).toBe('exampleCategories')
    expect(plans[0]!.request[0]).toBe('/api/v1/categories')
    expect(plans[0]!.request[1].acceptLanguage).toBe('ko')
  })

  it('속성 필터뿐인 자원은 빈 배열이다', () => {
    expect(relationshipFilterRequests(CATEGORIES, null)).toEqual([])
  })

  it('관계.id 꼴이지만 그 관계가 선언에 없으면 건너뛴다 - 유도가 던지지 않는 규칙과 같다', () => {
    const odd = defineResource({
      ...SAMPLE_INPUT,
      filters: [{ key: 'ghost.id', operators: ['exact'], uiOperator: 'exact' }],
    })
    expect(relationshipFilterRequests(odd, null)).toEqual([])
  })

  it('대상 자원이 선언에 없으면 던진다', () => {
    const ghost = defineResource({
      ...SAMPLE_INPUT,
      relationships: {
        owner: { cardinality: 'one', type: 'nowhere', label: '소유자', nullable: true },
      },
    })
    expect(() => relationshipFilterRequests(ghost, null)).toThrow('nowhere')
  })
})

describe('filterOptionsFromResults', () => {
  const plans = relationshipFilterRequests(EXAMPLES, null)

  it('성공한 결과를 필터 키별 보기 목록으로 편다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      {
        ok: true,
        status: 200,
        document: {
          data: [{ type: 'exampleCategories', id: 'c1', attributes: { name: '분류 하나' } }],
        },
      },
    ]
    expect(filterOptionsFromResults(plans, results)).toEqual({
      'category.id': [{ id: 'c1', name: '분류 하나' }],
    })
  })

  it('실패한 결과는 그 키를 빼서 접는다 - 목록 화면은 배너로 바뀌지 않고 그 필터만 텍스트 입력이 된다', () => {
    const results: JsonApiResult<CollectionDocument>[] = [
      { ok: false, status: 500, errors: [{ status: '500', code: 'INTERNAL' }] },
    ]
    expect(filterOptionsFromResults(plans, results)).toEqual({})
  })

  it('204 와 빈 목록도 키를 뺀다 - 보기 없는 Select("전체"뿐)를 그리지 않는다', () => {
    expect(filterOptionsFromResults(plans, [{ ok: true, status: 204, document: null }])).toEqual(
      {},
    )
    expect(
      filterOptionsFromResults(plans, [{ ok: true, status: 200, document: { data: [] } }]),
    ).toEqual({})
  })

  it('계획과 결과의 수가 다르면 던진다 - 호출부의 버그다', () => {
    expect(() => filterOptionsFromResults(plans, [])).toThrow('내부 오류')
  })
})
```

Run: `pnpm vitest run test/unit/slug/options.test.ts`
Expected: FAIL - `relationshipFilterRequests` · `filterOptionsFromResults` 가 없다.

- [ ] **Step 5: `options.ts` 를 고친다**

`app/(admin)/[slug]/options.ts` 전체:

```ts
import { optionsFromDocument, type OptionItem } from '@/lib/form/options'
import { withAcceptLanguage, type JsonApiResult, type RequestOptions } from '@/lib/jsonapi/client'
import type { CollectionDocument, ErrorObject } from '@/lib/jsonapi/document'
import { filterRelationshipKey, resourceByType, type ResourceDef } from '@/lib/resources'

/**
 * 관계 대상 자원의 보기 목록을 조회하는 요청 - `count.ts`·`health.ts` 와 같은
 * 이유로 화면 옆에 둔다(lib/resources/ 는 어떤 내부 모듈도 import 하지 않는
 * 순수 선언 계층이다, lib/resources/AGENTS.md). 문서 → 항목 변환
 * (`optionsFromDocument`)은 `lib/form/options.ts` 에 있다 - 그것은 순수
 * 변환이라 요청 조립과 층이 다르다.
 *
 * 소비자가 둘이다. 생성·상세 화면은 **관계마다** 조회해(`relationshipOptionRequests`)
 * 하나라도 실패하면 화면 전체를 배너로 바꾸고(`optionsByRelationship` - 보기
 * 없이 만들면 관계가 조용히 빠진다), 목록 화면은 **관계 필터마다** 조회해
 * (`relationshipFilterRequests`) 실패한 것은 접는다(`filterOptionsFromResults` -
 * 그 필터만 텍스트 입력으로 떨어진다, `components/grid/filter-control.ts`).
 * 두 접기 규칙이 다른 이유는 화면의 일이 다르기 때문이다 - 목록의 일은
 * 행을 보여 주는 것이고, 필터 드롭다운을 못 채운 것 때문에 목록을 가리면
 * 더 나쁘다.
 *
 * `listRequest`(./list.ts)를 재사용하지 않는다 - 이유는 include 다. 실측
 * (2026-09-12): `exampleCategories`·`exampleTags` 는 `includes` 허용 목록이
 * **빈 집합**이라(역참조가 순환을 만들어서 의도적으로 비웠다) include 를
 * 실으면 거절된다. 오늘은 두 자원의 `resource.includes` 가 실제로 비어
 * 있어 `listRequest` 를 그대로 써도 결과가 같지만, 그건 우연이다 - 훗날 두
 * 자원에 include 가 추가되면 `listRequest` 는 그 즉시 include 를 실어 이
 * 목록 조회가 거절되기 시작한다. 이 함수는 애초에 include 를 만들 수 있는
 * 경로 자체를 두지 않아 그 회귀에서 안전하다(`countRequest` 가 카드 용도로
 * include 를 아예 안 싣는 것과 같은 판단).
 *
 * `page[size]=100` 만 고정으로 싣는다 - 선택 목록은 필터·정렬·커서 없이
 * "가능한 한 많이" 받으면 되는 용도라 `listRequest`처럼 그리드 상태 전체를
 * 조립할 이유가 없다. `page[totals]` 는 싣지 않는다 - 이 함수의 소비자는
 * 총합을 읽지 않는다(countRequest 와 반대 지점 - 그쪽은 총합만 필요하다).
 */
export function optionsRequest(
  resource: ResourceDef,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions] {
  const query = new URLSearchParams({ 'page[size]': '100' })
  return [resource.path, withAcceptLanguage({ query }, acceptLanguage)]
}

/**
 * `optionsRequest` 의 결과를 문서로 좁힌다.
 *
 * **호출부가 `!result.ok` 를 먼저 걸렀다고 가정한다.** 예전에는 이 함수
 * 자신이 `result.errors[0]?.detail` 을 메시지에 실어 던졌다 - 그러면
 * `app/error.tsx` 가 그 detail(백엔드가 실제로 준 설명)을 버리고 고정 문구
 * "백엔드에 연결할 수 없습니다"를 보여준다(검증 오류·500 같은, 백엔드가
 * 실제로 응답한 경우에도 "연결할 수 없다"는 거짓 진단이 된다). 지금은
 * 호출부가 `messageForReadFailure`(../read-result.ts)로 먼저 갈라 transport 만
 * 던지고(그 경우에만 저 고정 문구가 참이다) 그 외는 배너로 그 자리에서
 * 보여준다 - 이 함수에 `!result.ok` 인 값이 넘어오는 것은 그 자체로 호출부의
 * 버그다.
 */
export function unwrapOptionsResult(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error(
      '내부 오류: 실패한 결과가 unwrapOptionsResult 에 도달했습니다(호출부가 먼저 걸렀어야 한다).',
    )
  }
  if (result.document === null) {
    throw new Error('선택 목록 응답에 본문이 없습니다.')
  }
  return result.document
}

/**
 * 보기 목록 요청 계획 하나 - 접을 때 쓸 키, 대상 자원, 그 자원의
 * `optionsRequest` 튜플. `key` 의 뜻은 만든 함수가 정한다 -
 * `relationshipOptionRequests` 는 관계 키(`category`),
 * `relationshipFilterRequests` 는 필터 키(`category.id`)다.
 */
export interface OptionRequestPlan {
  readonly key: string
  readonly target: ResourceDef
  readonly request: [path: string, options: RequestOptions]
}

/** 계획과 결과의 수가 다를 때의 문구 - 두 접기 함수가 같은 문장으로 던진다. */
const PLAN_RESULT_MISMATCH = '내부 오류: 요청 계획과 결과의 수가 다릅니다.'

/**
 * `type` 으로 대상 자원을 찾는다. `RESOURCES` 에 없으면 던진다 - 불변식
 * 테스트(`test/unit/resources/index.test.ts` 8번)가 그 선언을 막지만, 이
 * 자리가 조용히 빈 목록을 그리는 것보다 던지는 것이 낫다(관계 선택기가
 * 비어 있으면 운영자는 그 관계를 걸 수 없다).
 */
function targetOf(key: string, type: string): ResourceDef {
  const target = resourceByType(type)
  if (target === undefined) {
    throw new Error(`관계 ${key} 의 대상 자원 ${type} 이 선언에 없습니다.`)
  }
  return target
}

/**
 * 자원의 관계마다 대상 자원의 보기 목록 요청을 만든다 - 선언 순서대로.
 * 생성·상세 화면이 이 계획들을 `Promise.all` 로 함께 보내고
 * `optionsByRelationship` 으로 접는다.
 */
export function relationshipOptionRequests(
  resource: ResourceDef,
  acceptLanguage: string | null,
): readonly OptionRequestPlan[] {
  return Object.entries(resource.relationships).map(([key, relationship]) => {
    const target = targetOf(key, relationship.type)
    return { key, target, request: optionsRequest(target, acceptLanguage) }
  })
}

export type OptionsOutcome =
  | { readonly ok: true; readonly options: Readonly<Record<string, readonly OptionItem[]>> }
  | { readonly ok: false; readonly errors: readonly ErrorObject[] }

/**
 * 계획들과 그 결과를 관계 키별 보기 목록으로 접는다. 하나라도 실패하면 그
 * 오류를 돌려주고 화면이 배너로 바꾼다 - 폼을 반쪽으로 그리지 않는다
 * (보기 없이 만들면 관계가 조용히 빠진다). 204 는 `unwrapOptionsResult` 가
 * 던진다. 계획이 없으면(관계 없는 자원) 빈 목록으로 성공이다.
 */
export function optionsByRelationship(
  plans: readonly OptionRequestPlan[],
  results: readonly JsonApiResult<CollectionDocument>[],
): OptionsOutcome {
  if (plans.length !== results.length) throw new Error(PLAN_RESULT_MISMATCH)
  const options: Record<string, readonly OptionItem[]> = {}
  for (const [position, plan] of plans.entries()) {
    const result = results[position]
    if (result === undefined) throw new Error(PLAN_RESULT_MISMATCH)
    if (!result.ok) return { ok: false, errors: result.errors }
    options[plan.key] = optionsFromDocument(plan.target, unwrapOptionsResult(result))
  }
  return { ok: true, options }
}

/**
 * 목록 화면의 관계 필터(키가 `관계.id`)마다 대상 자원의 보기 목록 요청을
 * 만든다 - 선언의 필터 순서대로. 계획의 `key` 는 **필터 키**다 - 화면이
 * `filterOptionsFromResults` 로 접은 결과를 그대로 `ResourceGrid.filterOptions`
 * 에 넘기고, 그리드는 필터 키로 찾는다(`components/grid/filter-bar.tsx`).
 *
 * `관계.id` 꼴인데 그 관계가 선언에 없는 필터는 건너뛴다 - 유도가 던지지
 * 않는 규칙(`lib/resources/define.ts` 머리말)과 같다. 그 필터는 텍스트
 * 입력으로 남는다.
 */
export function relationshipFilterRequests(
  resource: ResourceDef,
  acceptLanguage: string | null,
): readonly OptionRequestPlan[] {
  return resource.filters.flatMap((filter) => {
    const relationshipKey = filterRelationshipKey(filter.key)
    const relationship =
      relationshipKey === null ? undefined : resource.relationships[relationshipKey]
    if (relationshipKey === null || relationship === undefined) return []
    const target = targetOf(relationshipKey, relationship.type)
    return [{ key: filter.key, target, request: optionsRequest(target, acceptLanguage) }]
  })
}

/**
 * 목록 화면의 접기 규칙 - 실패·204·빈 목록은 그 키를 **빼서** 그 필터가
 * 텍스트 입력으로 떨어지게 한다(`filter-control.ts`). 빈 배열을 넘기지
 * 않는 이유: 보기가 하나도 없는 Select("전체"뿐)가 그려져 필터를 쓸 수
 * 없다. 텍스트 입력으로 떨어지면 운영자가 id 로라도 걸 수 있다 - 사라지지
 * 않으므로 조용한 실패가 아니다. `operatorFromResult`(../operator.ts)가
 * 운영자 배지에 쓰는 것과 같은 판단이다.
 */
export function filterOptionsFromResults(
  plans: readonly OptionRequestPlan[],
  results: readonly JsonApiResult<CollectionDocument>[],
): Readonly<Record<string, readonly OptionItem[]>> {
  if (plans.length !== results.length) throw new Error(PLAN_RESULT_MISMATCH)
  const options: Record<string, readonly OptionItem[]> = {}
  for (const [position, plan] of plans.entries()) {
    const result = results[position]
    if (result === undefined || !result.ok || result.document === null) continue
    const items = optionsFromDocument(plan.target, result.document)
    if (items.length > 0) options[plan.key] = items
  }
  return options
}
```

Run: `pnpm vitest run test/unit/slug/options.test.ts`
Expected: PASS.

- [ ] **Step 6: Server Action 넷을 `slug` 인자로 다시 쓴다**

`app/(admin)/[slug]/actions.ts` 전체(옛 `examples/actions.ts` 의 실측 문단은 그대로 옮기고 `examples` 고유 표현만 바꿨다):

```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { BulkOutcome } from '@/lib/bulk/executor'
import { LOGIN_PATH, requireSession } from '@/lib/auth/guard'
import { clearSession } from '@/lib/auth/session'
import { resourceFormState } from '@/lib/form/flow'
import type { ResourceFormState } from '@/lib/form/form-state'
import { request } from '@/lib/jsonapi/client'
import type { ErrorObject, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { bucketForFailure, isAlreadyGone } from './bulk-outcome'
import { writableResource } from './resource'
import { createRequest, deleteRequest, updateRequest } from './write'

/**
 * 선언된 어느 자원에든 쓰는 생성·수정·삭제 Server Action 넷. 어느 자원인지는
 * 첫 인자 `slug` 가 정한다 - 화면이 `action.bind(null, resource.slug)`(생성) ·
 * `.bind(null, resource.slug, id)`(수정·삭제)로 넘기고, bind 된 인자는
 * 문자열이라 직렬화에 문제가 없다(스펙 7.4). 넷 다 첫 줄이
 * `writableResource(slug)` 다(./resource.ts) - 선언에 없거나 읽기 전용이면
 * 던진다. 화면이 그 경로를 제공하지 않으므로 사용자 문구는 두지 않는다.
 *
 * 판단은 이미 다른 파일에 있다 - 필드 배치는 `lib/jsonapi/errors.ts`,
 * 실패/성공 분류는 `resourceFormState`(lib/form/flow.ts), 요청 조립은
 * `createRequest`·`updateRequest`·`deleteRequest`(./write.ts), 본문은
 * `lib/form/write.ts` 의 `writeDocument`. 이 파일은 그것들을 기계적으로
 * 잇기만 한다 - `app/(auth)/actions.ts` 가 `lib/auth/flow.ts` 를 잇기만 하는
 * 것과 같은 이유다(이 파일도 headers()·`requireSession()` 안의 `cookies()`·
 * redirect() 가 요청 스코프를 요구해 단위 테스트 계층에서 부를 수 없다 -
 * 그 저장소의 관례를 그대로 따른다).
 *
 * **이 파일에는 `'use server'` 가 있다 - 그래서 순수 함수를 여기 두지
 * 않는다.** Next 는 그 지시어가 있는 파일의 모든 export 를 Server Action
 * 참조로 다루고, Server Action 은 반드시 async 함수여야 한다(실측: 동기
 * 함수를 여기 export 하면 `next build` 가 "Server Actions must be async
 * functions" 로 죽는다) - 요청 조립을 `./write.ts`, slug 판정을
 * `./resource.ts`(둘 다 지시어 없음)로 뺀 이유가 그것이다.
 *
 * **PATCH 로 수정한다, PUT 이 아니다.** 실측(route_registrar.py,
 * 2026-09-12): `PUT /api/v1/examples/{id}` 는 `enable_upsert = True` 인
 * 업서트라 존재하지 않는 id 에 201 로 새 자원을 만들 수 있다 - 편집 폼이
 * 부를 요청이 아니다.
 *
 * **네 Action 모두 `requireSession()`(lib/auth/guard.ts)을 먼저 부르고
 * `accessToken` 을 `./write.ts` 의 조립 함수에 넘긴다.** 실측(실제 백엔드
 * 상대 E2E): 이 호출이 없으면 네 Action 전부가 Authorization 헤더 없이 나가
 * 백엔드가 401 `AUTHENTICATION_REQUIRED` 로 거절한다 - mock 을 상대로는 이
 * 누락이 전혀 드러나지 않았다. **읽기 경로(목록·상세·선택 목록)에는 이
 * 토큰을 넣지 않는다 - 그것도 계약이다.** 세 백엔드 전부 읽기는 공개, 쓰기만
 * 인증을 요구한다(실측: fastapi 의 `route_registrar.py` 가 `read_dependencies`/
 * `write_dependencies` 를 나누고 `ExamplesController` 는 후자만 채운다,
 * nestjs 의 `examples.controller.ts` 가 `writeGuards` 를 index/show/관계
 * GET 에는 적용하지 않는다고 스스로 주석에 남긴다, rails 의
 * `examples_controller.rb` 가 `before_action :authenticate_active_user!, only:
 * PROTECTED_WRITE_ACTIONS` 로 좁힌다). "이 Action 이 실제로 토큰을 싣는가"는
 * `./write.ts` 의 조립 함수를 통해 단위(`test/unit/slug/write.test.ts`)가
 * 직접 잰다.
 *
 * ## 세 단건 Action 은 `destroySession` 을 여기서 직접 다룬다
 *
 * proxy.ts 의 회전은 "요청당 정확히 한 번"만 보장한다(그 파일 "알려진
 * 한계" 절) - 같은 만료 임박 쿠키를 실은 서로 다른 요청 여럿(다중 탭, 링크
 * prefetch)이 거의 동시에 오면 하나만 회전에 성공하고 나머지는 이미 소비된
 * refresh 토큰을 내밀어 세션이 죽는다(실측: 5 동시 요청 중 1 생존 · 4
 * TOKEN_REVOKED). 그 넷의 쿠키는 여전히 멀쩡해 보이고 `decideRotation` 은
 * `pass` 를 고르므로, 그 사용자는 로그인 상태 그대로 다음 쓰기를 시도하다가
 * 매번 401 `TOKEN_REVOKED` 를 받는다 - access 쿠키의 남은 수명 동안.
 * `guard.ts`·proxy.ts 의 갈래들은 "이 401 은 `errors.ts` 의 destroySession
 * 액션이 다룬다"고 적어 두고 자신은 만료를 판정하지 않는다 - 그 액션을
 * 실제로 실행하는 자리가 `redirectToLoginOnSessionDeath` 다.
 *
 * `bulkDeleteResourceAction` 에는 쓰지 않는다 - 그 Action 의 실패는
 * `components/grid/bulk-result.tsx` 가 이미 `sessionLost` 버킷(재시도 버튼
 * 숨김 + "다시 로그인" 링크)으로 온전히 다루고, 결과 표 렌더링 도중에
 * 리다이렉트를 던지면 그 표 자체가(아직 확인 못 한 나머지 건의 결과와 함께)
 * 통째로 사라진다.
 *
 * `clearSession()` 을 여기서 부르는 것은 안전하다 - 이 파일 전체가 Server
 * Action 이라 `next/headers` 의 쓰기 제약(session.ts 파일 상단 "⚠️" 절)에
 * 걸리지 않는다.
 *
 * **단위 테스트가 없다.** `cookies()`/`redirect()` 가 요청 스코프를 요구해
 * 단위 계층에서 부를 수 없다 - 실제로 리다이렉트가 일어나는지는 E2E 의
 * 몫이다.
 */

/**
 * `errors` 가 세션이 죽어서 난 것이면 쿠키를 지우고 로그인으로 보낸다 -
 * 아니면 아무것도 하지 않고 그대로 돌아간다(호출자가 이어서 자기 방식대로
 * 실패를 그린다). `redirect()` 는 반환하지 않지만(타입이 `never`), 세션이
 * 죽지 않은 흔한 경우(필드 오류·배너 등)에는 그냥 돌아와야 하므로 함수
 * 전체의 반환 타입은 `never` 가 아니라 `Promise<void>` 다.
 */
async function redirectToLoginOnSessionDeath(errors: readonly ErrorObject[]): Promise<void> {
  if (actionForErrors(errors) !== 'destroySession') return
  await clearSession()
  redirect(LOGIN_PATH)
}

/**
 * 삭제 요청(단건·일괄 공통)의 타임아웃(ms).
 *
 * **여기서 만든 신호는 브라우저의 취소 버튼이 아니다 - 만들 수가 없다.**
 * `resource-grid.tsx` 의 일괄 삭제 취소 버튼은 `AbortController` 를 쥐고
 * `runBulk`(lib/bulk/executor.ts)에 그 `signal` 을 넘기지만, `runBulk` 는 그
 * 신호를 **다음 요청을 내기 전에만** 확인한다 - 이미 나가 있는
 * `bulkDeleteResourceAction` 호출 하나는 끝까지 기다린다(의도적: 이미 보낸
 * 요청은 되돌리지 않는다). 그 신호를 이 Server Action 안까지 실어 쓰고
 * 싶어질 수 있는데, 불가능하다 - React 의 Server Function 인자 직렬화
 * (react-server-dom 의 `processReply`, 실측: `FormData`·`Map`·`Set`·`Blob`·
 * `Date` 만 특수 처리되고 그 밖의 클래스 인스턴스는 "Only plain objects, and
 * a few built-ins, can be passed to Server Functions"로 **그 자리에서
 * 던진다**)는 `AbortSignal` 을 인자로 받지 않는다.
 *
 * 그래서 이 타임아웃은 이 함수 **안에서** 매 호출마다 새로 만든다(rotation.ts
 * 의 `ROTATION_FETCH_TIMEOUT_MS` 와 같은 기법) - 백엔드가 응답을 거절하는
 * 게 아니라 그냥 멈추면(잠금 대기 등) `await run(id)`(executor.ts)가 영원히
 * 끝나지 않아 취소 버튼이 아무 일도 하지 않는 것처럼 보인다 - 이 타임아웃은
 * 그 한도를 유한하게 만든다.
 */
const DELETE_FETCH_TIMEOUT_MS = 10_000

/** 성공하면 만들어진 자원의 상세로 보낸다(스펙 7.4) - 실측: `POST /api/v1/examples` -> 201. */
export async function createResourceAction(
  slug: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...createRequest(resource, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된
  // 함정 - JsonApiResult<T> 는 판별자가 섞여 있어 status 비교로는 멤버를
  // 배제하지 못한다).
  if (result.document === null) {
    throw new Error('생성 응답에 본문이 없습니다.')
  }
  if (result.document.data === null) {
    throw new Error('생성 응답에 자원이 없습니다.')
  }
  redirect(`/${resource.slug}/${result.document.data.id}`)
}

/** 성공하면 상세를 갱신한다(스펙 7.4) - 실측: `PATCH /api/v1/examples/{id}` -> 200. */
export async function updateResourceAction(
  slug: string,
  id: string,
  _previous: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<SingleDocument>(
    ...updateRequest(resource, id, formData, session.accessToken, acceptLanguage),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    return resourceFormState(result.errors)
  }
  redirect(`/${resource.slug}/${id}`)
}

/**
 * 성공하면 목록으로 보낸다(스펙 7.4) - 실측: `DELETE /api/v1/examples/{id}`
 * -> 204, 본문 없음. 실패는 폼 필드가 없는 동작이라 resourceFormState 로
 * 받지 않고 던진다 - `app/error.tsx`가 받는다.
 *
 * **404 는 이 "실패" 에서 뺀다 - 성공으로 다룬다.** `isAlreadyGone`
 * (./bulk-outcome.ts)이 그 행은 이미 없다고 답하면 운영자가 지우려던 의도는
 * 이미 달성됐다. 다시 지워도 영원히 같은 404 뿐이고, "실패했다"고 던지면
 * 백엔드가 실제로 응답했고 행도 실제로 없는데 `error.tsx` 는 "백엔드에
 * 연결할 수 없습니다"를 보여준다.
 */
export async function deleteResourceAction(slug: string, id: string): Promise<void> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      resource,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (!result.ok) {
    await redirectToLoginOnSessionDeath(result.errors)
    if (!isAlreadyGone(result.errors)) {
      throw new Error(result.errors[0]?.detail ?? '삭제하지 못했습니다.')
    }
  }
  redirect(`/${resource.slug}`)
}

/**
 * 일괄 삭제의 건별 실행 - `components/grid/resource-grid.tsx` 가 이 함수를
 * (slug 를 bind 한 채로) `runBulk`(lib/bulk/executor.ts)의 `run` 콜백으로
 * 넘긴다. 그리드는 클라이언트 컴포넌트라 이 함수는 `<form action>` 이
 * 아니라 클라이언트 쪽 반복문에서 `id` 하나마다 직접 호출된다 - Next 는
 * Server Action 을 그렇게 호출하는 것을 그대로 지원한다. 건마다 왕복
 * 하나씩이라 `runBulk` 의 `onProgress` 가 실제로 갱신되고, 취소 신호가
 * 다음 요청을 실제로 막을 수 있다.
 *
 * `deleteResourceAction` 과 달리 실패해도 던지지 않는다 - 부분 실패가 이
 * 실행의 정상 경로라(lib/bulk/AGENTS.md), 한 건의 실패로 나머지 실행을
 * 막으면 안 된다. 성공·실패 모두 `BulkOutcome` 하나로 돌려주고, 화면은
 * 그것을 그리기만 한다 - 판단(어느 통인가)은 `bucketForFailure`
 * (./bulk-outcome.ts)로 여기서 끝내 둔다. **`bucket` 을 여기서 채우는 이유**:
 * `actionForErrors` 는 `lib/jsonapi/errors` → `client.ts` →
 * `lib/config/settings.ts` 로 이어지는 값 import 다 - 이 판정이 결과 화면
 * (`'use client'`)에 있으면 그 사슬이 클라이언트 번들의 그래프에 들어온다.
 *
 * 두 함정을 여기서 피한다(둘 다 실측됨) - 성공한 삭제는 204·본문 없음이라
 * `ok` 로만 좁힌다(`status === 204` 로는 판별자가 섞여 좁혀지지 않는다).
 * `errors` 배열은 그대로 넘긴다 - `status`·`detail` 만 뽑아 새 객체로 옮기면
 * `code` 가 사라지고, `exactOptionalPropertyTypes` 아래서는 `{ status:
 * error.status }` 조차 컴파일되지 않는다.
 */
export async function bulkDeleteResourceAction(slug: string, id: string): Promise<BulkOutcome> {
  const resource = writableResource(slug)
  const session = await requireSession()
  const acceptLanguage = (await headers()).get('accept-language')
  const result = await request<never>(
    ...deleteRequest(
      resource,
      id,
      session.accessToken,
      acceptLanguage,
      AbortSignal.timeout(DELETE_FETCH_TIMEOUT_MS),
    ),
  )

  if (result.ok) return { id, ok: true, bucket: 'ok' }
  return { id, ok: false, errors: result.errors, bucket: bucketForFailure(result.errors) }
}
```

- [ ] **Step 7: 목록 화면과 로딩을 쓴다**

`app/(admin)/[slug]/page.tsx`:

```tsx
import { headers } from 'next/headers'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceGrid } from '@/components/grid/resource-grid'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { LOGIN_REDIRECT_PARAM } from '@/proxy'
import { messageForReadFailure } from '../read-result'
import { bulkDeleteResourceAction } from './actions'
import { listRequest, toSearchParams } from './list'
import { filterOptionsFromResults, relationshipFilterRequests } from './options'
import { resourceFromSlug } from './resource'

/**
 * 선언된 어느 자원이든 그리는 목록 화면 - 첫 줄이 `resourceFromSlug` 다
 * (./resource.ts, 선언에 없으면 404). 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 조립(경로·질의·Accept-Language)은 `listRequest` 하나로 모여 있다(./list.ts) -
 * 여기서 다시 쪼개면 그중 하나를 지우는 뮤턴트가 이 화면에서는 잡히지
 * 않는다(화면 자신은 단위 테스트 대상이 아니다 - `headers()` 가 요청
 * 스코프를 요구해 vitest(node)에서 던지고, 이 저장소는 그것을 스텁하지 않는
 * 관례를 갖는다). 실제로 넘어가는지는 로케일이 다른 두 컨텍스트로 서는
 * E2E 의 몫이다.
 *
 * 관계 필터(키가 `관계.id`)의 보기 목록은 관계마다 대상 자원을 병행 조회하고
 * **실패하면 접는다**(`filterOptionsFromResults`) - 이 화면의 일은 행을
 * 보여 주는 것이고, 필터 드롭다운을 못 채운 것 때문에 목록을 가리면 더
 * 나쁘다. 접히면 그 필터는 텍스트 입력으로 떨어져 운영자가 id 를 직접
 * 넣을 수 있다.
 *
 * `writable` 일 때만 `bulkDeleteAction`(slug 를 bind 한 Server Action)과
 * `newHref` 를 넘긴다 - 그리드는 그 둘의 유무로 선택 열과 "새로 만들기"를
 * 그린다(`components/grid/resource-grid.tsx`). 읽기 전용 자원은 둘 다
 * 넘기지 않는다. 어느 자원인지 판단하는 것은 이 화면(선언의 `writable`)이지
 * 그리드가 아니다.
 *
 * `reauthHref` 도 여기서 완성해 건넨다 - `ResourceGrid` 는 클라이언트
 * 컴포넌트라 `proxy.ts`(그 안의 `LOGIN_REDIRECT_PARAM`)를 값으로 import 하면
 * `lib/auth/session.ts` 를 거쳐 `next/headers` 가 클라이언트 번들에 끌려
 * 들어간다(실측: `pnpm build` 가 그 자리에서 깨진다).
 */
export default async function ResourceListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const resource = resourceFromSlug(slug)
  const currentParams = toSearchParams(await searchParams)
  const lang = (await headers()).get('accept-language')
  const plans = relationshipFilterRequests(resource, lang)

  // 목록과 보기 목록들은 서로 의존하지 않는다 - 함께 보낸다
  // (app/(admin)/page.tsx 가 여러 요청을 묶는 것과 같은 이유).
  const [result, optionResults] = await Promise.all([
    request<CollectionDocument>(...listRequest(resource, currentParams, lang)),
    Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  ])

  // transport(실제로 백엔드에 못 닿음)만 던져서 error.tsx 를 띄운다 - 그 외
  // 백엔드가 실제로 낸 오류(예: 잘못된 정렬 파라미터의 검증 오류)는 던지지
  // 않고 배너로 그 자리에서 보여준다(messageForReadFailure).
  if (!result.ok) {
    const message = messageForReadFailure(result.errors, '목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙) -
  // 목록 GET 은 204 를 주지 않지만 타입은 그 분기를 여전히 포함한다.
  if (result.document === null) {
    throw new Error('목록 응답에 본문이 없습니다.')
  }

  const filterOptions = filterOptionsFromResults(plans, optionResults)
  const base = `/${resource.slug}`
  const currentQuery = currentParams.toString()
  const currentUrl = currentQuery === '' ? base : `${base}?${currentQuery}`
  const reauthHref = `/login?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(currentUrl)}`

  return (
    <ResourceGrid
      resource={resource}
      document={result.document}
      reauthHref={reauthHref}
      rowHrefBase={base}
      // 키 자체를 넘기지 않는다(exactOptionalPropertyTypes - undefined 로 채우지
      // 않는다). 보기 목록이 하나도 안 접혔으면 그리드가 필터 전부를 텍스트
      // 입력으로 그린다.
      {...(Object.keys(filterOptions).length === 0 ? {} : { filterOptions })}
      {...(resource.writable
        ? {
            bulkDeleteAction: bulkDeleteResourceAction.bind(null, resource.slug),
            newHref: `${base}/new`,
          }
        : {})}
    />
  )
}
```

`app/(admin)/[slug]/loading.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { resourceBySlug } from '@/lib/resources'

/**
 * 목록의 로딩 스켈레톤. `'use client'` 인 이유는 `useParams` 하나다 -
 * `loading.tsx` 는 인자를 받지 않지만(Next 문서 `loading.md`: "Loading UI
 * components do not accept any parameters") 클라이언트 컴포넌트가 될 수
 * 있고, 그 안에서 `useParams` 로 지금 slug 를 읽어 열 수·필터 수를 선언에서
 * 센다. `lib/resources` 는 내부 모듈을 하나도 import 하지 않아 클라이언트
 * 번들에 들어가도 서버 전용 코드에 닿지 않는다
 * (`test/unit/components/boundary-policy.test.ts` 둘째 방향이 잰다).
 * `useParams` 가 Suspense 를 요구하는 것은 `cacheComponents` 가 켜졌을
 * 때뿐이다 - 이 저장소는 켜지 않는다(`next.config.ts`).
 *
 * 선언에 없는 slug 면 열·필터 0개짜리 스켈레톤이다 - 곧 `notFound()` 가
 * 온다. 선택 열은 쓰기 가능 자원에만 있다(`ResourceGrid` 가 `bulkDeleteAction`
 * 을 받을 때만 그린다) - 스켈레톤도 같은 칸 수를 그린다. 툴바 오른쪽도
 * 같다 - 쓰기 가능이면 "새로 만들기"와 "열" 둘, 아니면 "열" 하나. 텍스트는
 * 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const writable = resource?.writable ?? false
  const filterCount = resource?.filters.length ?? 0
  const columnCount = resource === undefined ? 0 : resource.columns.length + (writable ? 1 : 0)
  const rowCount = 8

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-2">
          {writable ? <Skeleton className="h-8 w-28" /> : null}
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: filterCount }, (_, index) => (
          <div key={index} className="flex w-44 flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        {filterCount > 0 ? <Skeleton className="h-8 w-16" /> : null}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex gap-2 border-b bg-muted p-2">
          {Array.from({ length: columnCount }, (_, index) => (
            <Skeleton key={index} className="h-5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rowCount }, (_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-2 border-b p-2 last:border-0">
            {Array.from({ length: columnCount }, (_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 생성 화면과 로딩을 쓴다**

`app/(admin)/[slug]/new/page.tsx`:

```tsx
import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormBanner } from '@/components/form/form-banner'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { messageForReadFailure } from '../../read-result'
import { createResourceAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'
import { resourceFromSlug } from '../resource'

/**
 * 생성 화면 - 폼은 `ResourceForm`(components/resource) 이 선언에서 그린다.
 * 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 읽기 전용 자원에는 생성 화면이 없다 - `notFound()` 다(스펙 6.3·8장).
 * 사이드바·목록 어디에도 이 경로로 오는 링크가 없으므로(목록의 "새로
 * 만들기"는 `writable` 일 때만 그려진다) 주소를 직접 친 경우뿐이다.
 *
 * 관계 선택 목록은 선언의 관계마다 대상 자원을 `include` 없이 조회한다
 * (../options.ts 머리말). 조회를 병행하고 하나라도 실패하면 화면 전체를
 * 배너로 바꾼다(`optionsByRelationship`) - 보기 없이 만들면 관계가 조용히
 * 빠진다.
 *
 * Action 은 `createResourceAction.bind(null, resource.slug)` 로 넘긴다 - bind
 * 된 문자열 인자는 직렬화되어 `useActionState` 를 거쳐 서버에 돌아온다
 * (스펙 7.4; 실측은 이 화면을 여는 E2E 생성 시나리오가 한다).
 */
export default async function NewResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resource = resourceFromSlug(slug)
  if (!resource.writable) notFound()

  const lang = (await headers()).get('accept-language')
  const plans = relationshipOptionRequests(resource, lang)
  const outcome = optionsByRelationship(
    plans,
    await Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  )

  // transport 만 던져 error.tsx 로 보낸다 - 그 외(백엔드가 실제로 낸 오류)는
  // 배너로 그 자리에서 보여준다(../../read-result.ts).
  if (!outcome.ok) {
    const message = messageForReadFailure(outcome.errors, '선택 목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  return (
    // `max-w-[35rem]` - 폼 자신이 `max-w-lg`(32rem)로 폭을 정하므로
    // (components/resource/resource-form.tsx) 거기에 `lg` 좌우 여백 1.5rem
    // 둘을 더한 값이다. 셸이 이미 96rem 에서 가운데로 모으지만
    // (`(admin)/layout.tsx`) 그 폭 안에서는 이 화면의 내용이 여전히 왼쪽에
    // 붙으므로, 폼 폭에 맞춰 한 번 더 좁힌다. 상세 화면은 오른쪽 열이 있어
    // 55.5rem 이다.
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Button
        render={<Link href={`/${resource.slug}`} />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        목록으로
      </Button>

      <ResourceForm
        resource={resource}
        action={createResourceAction.bind(null, resource.slug)}
        options={outcome.options}
      />
    </div>
  )
}
```

`app/(admin)/[slug]/new/loading.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, resourceBySlug } from '@/lib/resources'

/**
 * 생성 화면의 스켈레톤. 필드 수는 `useParams` 로 읽은 slug 의 선언에서 센다 -
 * 폼이 그리는 속성(`formAttributes`)과 관계의 합이다(`'use client'` 인 이유와
 * 그 안전성은 `../loading.tsx` 머리말). 선언에 없거나 읽기 전용인 slug 면
 * 필드 0개다 - 곧 `notFound()` 가 온다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const fieldCount =
    resource === undefined || !resource.writable
      ? 0
      : formAttributes(resource).length + Object.keys(resource.relationships).length

  return (
    <div className="mx-auto flex w-full max-w-[35rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <Skeleton className="h-8 w-24" />
      <div className="max-w-lg space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: 상세 화면과 로딩을 쓴다**

`app/(admin)/[slug]/[id]/page.tsx`:

```tsx
import { ArrowLeftIcon } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormBanner } from '@/components/form/form-banner'
import { ConfirmedDeleteForm } from '@/components/grid/bulk-confirm'
import { AttributeTable, RelationshipBadges } from '@/components/resource/resource-detail'
import { ResourceForm } from '@/components/resource/resource-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { initialFormValues } from '@/lib/form/values'
import { request } from '@/lib/jsonapi/client'
import type { CollectionDocument, SingleDocument } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'
import { indexResources } from '@/lib/jsonapi/normalize'
import { readOnlyAttributes } from '@/lib/resources'
import { messageForReadFailure } from '../../read-result'
import { deleteResourceAction, updateResourceAction } from '../actions'
import { optionsByRelationship, relationshipOptionRequests } from '../options'
import { resourceFromSlug } from '../resource'
import { detailRequest } from './detail'

/**
 * 상세 화면. `writable` 이면 인라인 편집·삭제가 있는 두 열, 아니면 저장된
 * 값 카드 하나다(스펙 6.4). 폼·관계 배지·값 표는 `components/resource/` 의
 * 부품이 선언에서 그린다 - 이 파일에는 fetch 와 JSX 만 둔다.
 *
 * 상세 하나 + (`writable` 이면) 관계마다 선택 목록 하나를 병행한다. 읽기
 * 전용 자원은 폼이 없어 선택 목록을 조회하지 않는다 - 계획이 빈 배열이라
 * `optionsByRelationship` 도 빈 목록으로 성공한다. `detailRequest` 는
 * `resource.includes` 를 그대로 싣는다(./detail.ts) - `RelationshipBadges` 가
 * 그 `included` 를 읽어 현재 관계를 이름으로 보여준다.
 *
 * **값으로 부르는 함수는 전부 지시어 없는 모듈의 것이다** - `initialFormValues`
 * (lib/form)·`readOnlyAttributes`(lib/resources)·`indexResources`(lib/jsonapi).
 * 클라이언트 부품(`ResourceForm`·`ConfirmedDeleteForm`)은 JSX 로만 그린다
 * (루트 `AGENTS.md` 규칙 6).
 *
 * ## 레이아웃 - 두 열의 폭은 계산해서 나온 값이다
 *
 * `xl` 이상에서 둘로 나눈다: 왼쪽이 편집 폼, 오른쪽이 지금 저장된 값과
 * 위험 구역이다. **왼쪽 트랙 `34rem`** 은 폼의 `max-w-lg`(32rem)에 카드
 * 좌우 여백 `--card-spacing`(1rem) 둘을 더한 값이라 폼이 카드 안을 꽉
 * 채운다. **경계를 `xl` 로 잡은 것**도 산수다 - 두 트랙 합 34 + 1.5(gap) +
 * 17 = 52.5rem 이고, `lg`(1024px)에서 사이드바(18rem)와 여백을 빼면 약
 * 43rem 뿐이라 두 열이 서로를 짓눌렀다. 래퍼 `max-w-[55.5rem]` 은 그 합에
 * `lg` 좌우 여백 1.5rem 둘을 더한 값이다 - 머리글까지 같은 래퍼 안에 두어야
 * 제목과 카드가 어긋나지 않는다. 읽기 전용 자원의 카드 하나도 같은 래퍼를
 * 쓴다 - 화면마다 다른 폭을 두면 자원을 오갈 때 내용이 좌우로 뛴다.
 *
 * 머리글은 `heading` 속성 값이 h1(비어 있으면 `(이름 없음)`), `enum` 속성들의
 * 값이 그 옆 배지(그리드와 같은 표기 - 와이어 값 그대로), id 가 그 아래
 * mono 다. h1 은 값 하나만 담는다 - E2E 가 `heading level 1` 의 마지막
 * 것을 제목과 비교한다. 관계 묶음의 `aria-label="관계"` 는 E2E 가 이름으로
 * 찾는 자리다(`components/resource/resource-detail.tsx` 머리말). 관계가 없는
 * 자원은 그 묶음을 아예 그리지 않는다 - 빈 group 을 남기지 않는다.
 *
 * 읽기 실패 - transport 만 던지고(`error.tsx`) 그 외는 배너, "이 id 의
 * 자원이 없다"(RESOURCE_NOT_FOUND, 또는 200 인데 `data: null`)는
 * `notFound()`(스펙 8장).
 *
 * 삭제는 `ConfirmedDeleteForm`(components/grid/bulk-confirm.tsx) 으로 확인을
 * 거친다 - 확인 전에는 작은 트리거 버튼만 보이고, 저장 버튼과는 아예 다른
 * 카드에 있어 오조준 자체가 어렵다.
 */
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const resource = resourceFromSlug(slug)
  const lang = (await headers()).get('accept-language')
  const plans = resource.writable ? relationshipOptionRequests(resource, lang) : []

  const [detailResult, optionResults] = await Promise.all([
    request<SingleDocument>(...detailRequest(resource, id, lang)),
    Promise.all(plans.map((plan) => request<CollectionDocument>(...plan.request))),
  ])

  if (!detailResult.ok) {
    if (actionForErrors(detailResult.errors) === 'notFound') notFound()
    const message = messageForReadFailure(detailResult.errors, '상세를 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }
  // status(리터럴)가 아니라 document 자체로 좁힌다(client.ts 의 문서화된 규칙).
  if (detailResult.document === null) {
    throw new Error('상세 응답에 본문이 없습니다.')
  }
  if (detailResult.document.data === null) {
    notFound()
  }

  // 선택 목록도 같은 기준으로 가른다 - 상세 자체는 받았는데 이 중 하나가
  // 실패하면 폼을 반쪽으로 그리는 대신 화면 전체를 배너로 바꾼다.
  const outcome = optionsByRelationship(plans, optionResults)
  if (!outcome.ok) {
    const message = messageForReadFailure(outcome.errors, '선택 목록을 불러오지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  const object = detailResult.document.data
  const index = indexResources(detailResult.document.included)
  const base = `/${resource.slug}`
  const hasRelationships = Object.keys(resource.relationships).length > 0

  const headingValue = object.attributes?.[resource.heading]
  const title =
    typeof headingValue === 'string' && headingValue !== '' ? headingValue : '(이름 없음)'
  const badges = Object.entries(resource.attributes).flatMap(([key, attribute]) => {
    if (attribute.kind !== 'enum') return []
    const value = object.attributes?.[key]
    return typeof value === 'string' && value !== '' ? [{ key, value }] : []
  })

  const header = (
    <header className="flex flex-col gap-4 border-b pb-5">
      <Button
        render={<Link href={base} />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="-ml-2.5 w-fit text-muted-foreground"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        목록으로
      </Button>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {badges.map((badge) => (
            <Badge key={badge.key} variant="outline" className="h-6 shrink-0 px-2.5">
              {badge.value}
            </Badge>
          ))}
        </div>
        {/* 운영자가 백엔드 로그·다른 도구와 맞춰 볼 수 있는 유일한 값이다 -
            목록 그리드에는 id 열이 없다. */}
        <p className="font-mono text-xs break-all text-muted-foreground">{id}</p>
      </div>
    </header>
  )

  if (!resource.writable) {
    return (
      <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {header}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>저장된 값</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {hasRelationships ? (
              <RelationshipBadges resource={resource} object={object} index={index} />
            ) : null}
            <AttributeTable
              resource={resource}
              object={object}
              keys={Object.keys(resource.attributes)}
              {...(hasRelationships ? { className: 'border-t pt-4' } : {})}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      {header}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>내용 수정</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceForm
              resource={resource}
              action={updateResourceAction.bind(null, resource.slug, id)}
              options={outcome.options}
              initialValues={initialFormValues(resource, object)}
            />
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>지금 저장된 값</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {hasRelationships ? (
                <RelationshipBadges resource={resource} object={object} index={index} />
              ) : null}
              <AttributeTable
                resource={resource}
                object={object}
                keys={readOnlyAttributes(resource).map(([key]) => key)}
                {...(hasRelationships ? { className: 'border-t pt-4' } : {})}
              />
            </CardContent>
          </Card>

          <Card className="ring-destructive/25">
            <CardHeader className="border-b">
              <CardTitle className="text-destructive">위험 구역</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {/* `break-keep`(word-break: keep-all) - 없으면 한국어가 단어
                  가운데서 잘린다(실측: 좁은 카드에서 "사라집니|다"로 끊겼다). */}
              <p className="text-sm break-keep text-muted-foreground">
                삭제하면 이 항목이 목록에서 사라집니다. 되돌리는 엔드포인트는 없습니다.
              </p>
              <ConfirmedDeleteForm action={deleteResourceAction.bind(null, resource.slug, id)} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
```

`app/(admin)/[slug]/[id]/loading.tsx`:

```tsx
'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, readOnlyAttributes, resourceBySlug } from '@/lib/resources'

/**
 * 상세 화면의 스켈레톤 - `page.tsx` 와 같은 레이아웃(폭 산수는 그 파일
 * 머리말). `useParams` 로 읽은 slug 의 선언에서 필드 수·관계 수·값 수를
 * 센다(`'use client'` 인 이유와 안전성은 `../loading.tsx` 머리말). `writable`
 * 이면 두 열, 아니면 카드 하나 - 본문과 같은 모양이라 로딩에서 본문으로
 * 넘어갈 때 내용이 뛰지 않는다. 텍스트는 두지 않는다.
 */
export default function Loading() {
  const { slug } = useParams<{ slug: string }>()
  const resource = resourceBySlug(slug)
  const relationshipCount = resource === undefined ? 0 : Object.keys(resource.relationships).length
  const fieldCount = resource === undefined ? 0 : formAttributes(resource).length + relationshipCount
  const readOnlyCount = resource === undefined ? 0 : readOnlyAttributes(resource).length
  const attributeCount = resource === undefined ? 0 : Object.keys(resource.attributes).length

  const header = (
    <div className="flex flex-col gap-4 border-b pb-5">
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-52" />
      </div>
    </div>
  )

  const relationshipRows = (
    <div className="flex flex-col gap-3">
      {Array.from({ length: relationshipCount }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  )

  if (resource === undefined || !resource.writable) {
    return (
      <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {header}
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {relationshipCount > 0 ? relationshipRows : null}
            <div className="flex flex-col gap-2">
              {Array.from({ length: attributeCount }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[55.5rem] flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      {header}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,34rem)_minmax(0,17rem)]">
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-5">
            {Array.from({ length: fieldCount }, (_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {relationshipCount > 0 ? relationshipRows : null}
              <div className="flex flex-col gap-2 border-t pt-4">
                {Array.from({ length: readOnlyCount }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: 옛 폴더를 지우고 남은 참조를 잇는다**

```bash
git rm -r "app/(admin)/examples"
```

지워지는 것: `page.tsx` · `loading.tsx` · `actions.ts` · `new/page.tsx` · `new/loading.tsx` · `[id]/page.tsx` · `[id]/loading.tsx`(Step 2 에서 옮긴 다섯은 이미 없다). 남은 파일이 있으면 무엇인지 보고 멈춘다 - 이 목록 밖의 파일이 있다면 이 계획이 모르는 것이다.

`app/(admin)/page.tsx` 의 `import { toSearchParams } from './examples/list'` 를 `import { toSearchParams } from './[slug]/list'` 로 바꾼다.

`app/not-found.tsx` 머리말의 첫 문단을 다음으로 바꾼다:

```
 * `notFound()` 를 부르는 자리는 셋이다 - 선언에 없는 slug(`app/(admin)/[slug]/
 * resource.ts` 의 `resourceFromSlug`), 읽기 전용 자원의 생성 경로
 * (`[slug]/new/page.tsx`), 그리고 없는 id 의 상세(`[slug]/[id]/page.tsx` -
 * RESOURCE_NOT_FOUND 또는 200 인데 `data: null`). 셋 다 이 파일이 받는다 -
 * `(admin)` 셸 밖에서 뜬다(루트 `AGENTS.md` 규칙 2). "찾을 수 없다"는 사실
 * 자체는 라우터·백엔드가 이미 확정했으므로, 이 화면은 문구를 새로 만들지
 * 않고 다음 행동(홈으로)만 제공한다 - error.tsx 와 달리 이건 프론트가 자기
 * 문구를 갖는 예외가 아니다.
```

- [ ] **Step 11: 옮긴 테스트의 import 를 잇는다**

`test/unit/slug/` 넷의 import 경로를 바꾼다:

- `write.test.ts`: `from '@/app/(admin)/examples/write'` → `from '@/app/(admin)/[slug]/write'`. 머리말의 "네 쓰기 Action(`createExampleAction`·`updateExampleAction`·`deleteExampleAction`·`bulkDeleteExampleAction`, `actions.ts`)" 을 "네 쓰기 Action(`createResourceAction`·`updateResourceAction`·`deleteResourceAction`·`bulkDeleteResourceAction`, `actions.ts`)" 로 바꾼다. `deleteRequest` describe 안의 "deleteExampleAction 과 bulkDeleteExampleAction 둘 다" → "deleteResourceAction 과 bulkDeleteResourceAction 둘 다".
- `list.test.ts`: `from '@/app/(admin)/examples/list'` → `from '@/app/(admin)/[slug]/list'`.
- `detail.test.ts`: `from '@/app/(admin)/examples/[id]/detail'` → `from '@/app/(admin)/[slug]/[id]/detail'`.
- `bulk-outcome.test.ts`: `from '@/app/(admin)/examples/bulk-outcome'` → `from '@/app/(admin)/[slug]/bulk-outcome'`. 주석 "단건 삭제(app/(admin)/examples/actions.ts 의 deleteExampleAction)" → "단건 삭제(app/(admin)/[slug]/actions.ts 의 deleteResourceAction)".

`options.test.ts` 는 Step 4 에서 이미 새 경로다.

- [ ] **Step 12: 옛 이름이 코드에 남지 않았는지 기계적으로 확인한다**

Run:

```bash
grep -rnE "createExampleAction|updateExampleAction|deleteExampleAction|bulkDeleteExampleAction|examples/list'|examples/options'|examples/write'|examples/actions'|examples/bulk-outcome'|examples/\[id\]/detail'|test/unit/examples" app components lib test proxy.ts scripts
```

Expected: 0줄. 남는 줄이 있으면 그 자리를 새 이름으로 고친다. 주석 속 옛 **경로** 언급(`app/(admin)/examples/page.tsx` 등)은 이 과업의 대상이 아니다 - Task 6 이 한 번에 정리한다.

- [ ] **Step 13: 단위 게이트를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `typecheck` 가 `TS2307`(지운 `examples/*` 를 찾는다)로 죽으면 `rm -rf .next` 후 다시 돈다 - **그 일이 실제로 일어났는지를 보고에 적는다**(스펙 11장 5번, Task 6 이 그 사실을 루트 `AGENTS.md` 규칙 4 에 옮겨 적는다).

- [ ] **Step 14: 빌드로 라우트 목록을 확인한다**

Run: `pnpm build`
Expected: 성공. 출력의 라우트 목록에 `ƒ /[slug]` · `ƒ /[slug]/new` · `ƒ /[slug]/[id]` 가 있고 `/examples` 계열은 없다. 그 목록 세 줄을 보고에 그대로 적는다.

- [ ] **Step 15: 커밋**

```bash
git add -A "app/(admin)" app/not-found.tsx lib/resources test/unit/slug test/unit/resources/define.test.ts
git commit -F - <<'EOF'
feat: serve every declared resource from one [slug] route set

`app/(admin)/[slug]/` 한 벌이 목록·생성·상세를 그린다 - 첫 줄이
`resourceFromSlug` 고 선언에 없으면 404 다. Server Action 넷은 slug 를 첫
인자로 받아 `writableResource` 로 쓰기 가능 여부를 확인한다. 읽기 전용
자원은 선택 열·"새로 만들기"·폼·위험 구역 없이 목록과 값 카드만 갖고,
생성 경로는 404 다. 목록의 관계 필터 보기 목록은 관계 필터마다 병행
조회하고 실패는 접는다. 로딩 셋은 `useParams` 로 slug 를 읽어 선언에서
칸 수를 센다. 손으로 쓴 `examples/` 라우트를 지우고 조립 파일과 테스트를
옮긴다. URL 은 그대로다.
EOF
```

---
### Task 3: 셸 - 사이드바 · 헤더 제목 · 대시보드 카드

**Files:**
- Create: `components/nav-items.ts`
- Modify: `components/app-sidebar.tsx` · `components/site-header-title.ts` · `components/section-cards.tsx` · `app/(admin)/page.tsx`
- Test: `test/unit/components/sidebar.test.ts` · `test/unit/components/site-header-title.test.ts`

**Interfaces:**
- Consumes: `RESOURCES` · `resourceBySlug`(lib/resources), `countRequest` · `readTotal`(app/(admin)/count.ts), `toSearchParams` 의 새 자리(Task 2).
- Produces: `DASHBOARD_NAV_ITEM: NavItem` · `resourceNavItems(): readonly NavItem[]`(`components/nav-items.ts`), `titleFor(pathname)` 의 slug 규칙, `SectionCards({ counts, health })` 와 `ResourceCount { label, href, count, writable }`.

- [ ] **Step 1: 사이드바 항목의 테스트를 먼저 쓴다**

`test/unit/components/sidebar.test.ts` 의 import 아래에 더한다:

```ts
import { DASHBOARD_NAV_ITEM, resourceNavItems } from '@/components/nav-items'
import { RESOURCES } from '@/lib/resources'
```

파일 끝에 붙인다:

```ts
describe('사이드바 항목', () => {
  it('대시보드 항목은 루트를 가리킨다', () => {
    expect(DASHBOARD_NAV_ITEM).toEqual({ title: '대시보드', url: '/' })
  })

  it('자원 항목은 RESOURCES 와 개수·순서가 같고 라벨과 slug 를 그대로 쓴다', () => {
    const items = resourceNavItems()
    expect(items).toHaveLength(RESOURCES.length)
    expect(items.map((item) => item.title)).toEqual(RESOURCES.map((r) => r.label))
    expect(items.map((item) => item.url)).toEqual(RESOURCES.map((r) => `/${r.slug}`))
  })

  it('읽기 전용 자원도 항목에 있다 - 선언된 자원은 전부 화면을 갖는다', () => {
    const readOnly = RESOURCES.filter((r) => !r.writable)
    expect(readOnly.length).toBeGreaterThan(0)
    const urls = new Set(resourceNavItems().map((item) => item.url))
    for (const resource of readOnly) expect(urls.has(`/${resource.slug}`)).toBe(true)
  })
})
```

`test/unit/components/site-header-title.test.ts` 전체:

```ts
import { describe, expect, it } from 'vitest'
import { titleFor } from '@/components/site-header-title'
import { RESOURCES, resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!
const CATEGORIES = resourceByType('exampleCategories')!

describe('titleFor', () => {
  it('/ 는 대시보드다', () => {
    expect(titleFor('/')).toBe('대시보드')
  })

  it('/<slug> 는 자원 라벨을 그대로 쓴다 - 사이드바·표와 같은 자리를 읽는다', () => {
    expect(titleFor(`/${EXAMPLES.slug}`)).toBe(EXAMPLES.label)
    expect(titleFor(`/${CATEGORIES.slug}`)).toBe(CATEGORIES.label)
  })

  it('/<slug>/new 는 "<라벨> 만들기"다 - E2E 가 "예제 만들기"를 찾는다', () => {
    expect(titleFor('/examples/new')).toBe('예제 만들기')
    expect(titleFor(`/${CATEGORIES.slug}/new`)).toBe(`${CATEGORIES.label} 만들기`)
  })

  it('/<slug>/<id> 는 "<라벨> 상세"다', () => {
    expect(titleFor('/examples/abc')).toBe('예제 상세')
    expect(titleFor(`/${CATEGORIES.slug}/11110000-0000-4000-8000-000000000001`)).toBe(
      `${CATEGORIES.label} 상세`,
    )
  })

  it('선언에 없는 slug 는 빈 문자열이다 - 문구를 지어내지 않는다', () => {
    expect(titleFor('/nope')).toBe('')
    expect(titleFor('/nope/new')).toBe('')
    expect(titleFor('/login')).toBe('')
  })

  it('모든 자원의 세 경로가 빈 문자열이 아니다', () => {
    for (const resource of RESOURCES) {
      expect(titleFor(`/${resource.slug}`)).not.toBe('')
      expect(titleFor(`/${resource.slug}/new`)).not.toBe('')
      expect(titleFor(`/${resource.slug}/x`)).not.toBe('')
    }
  })
})
```

Run: `pnpm vitest run test/unit/components/sidebar.test.ts test/unit/components/site-header-title.test.ts`
Expected: FAIL - `nav-items` 모듈이 없고, `/nope` 가 `예제 상세` 로 나온다.

- [ ] **Step 2: `nav-items.ts` 와 사이드바**

`components/nav-items.ts`:

```ts
import { RESOURCES } from '@/lib/resources'

/**
 * 사이드바 항목의 재료. `app-sidebar.tsx`(`'use client'`)가 아니라 여기 두는
 * 이유는 `site-header-title.ts` 와 같다 - 순수 함수라 지시어가 필요 없고,
 * 지시어 있는 파일에서 export 하면 단위 테스트는 되지만 서버 컴포넌트가
 * 값으로 부르는 날 죽는다(루트 `AGENTS.md` 규칙 6). 아이콘은 여기 없다 -
 * 선언은 JSX 를 갖지 않고(스펙 4.5) 이 파일도 갖지 않는다. 사이드바가
 * 자원 전부에 같은 아이콘 하나를 붙인다.
 */
export interface NavItem {
  readonly title: string
  readonly url: string
}

export const DASHBOARD_NAV_ITEM: NavItem = { title: '대시보드', url: '/' }

/**
 * 선언된 자원 전부, `RESOURCES` 순서대로. 읽기 전용 자원도 든다 - 선언된
 * 자원은 전부 목록·상세 화면을 갖는다(스펙 3장 둘째 결정). 라벨은 선언의
 * `label` 이라 표·필터·헤더 제목과 같은 문구다.
 */
export function resourceNavItems(): readonly NavItem[] {
  return RESOURCES.map((resource) => ({ title: resource.label, url: `/${resource.slug}` }))
}
```

`components/app-sidebar.tsx` 에서 `import { resourceByType } from '@/lib/resources'` 를 `import { DASHBOARD_NAV_ITEM, resourceNavItems } from '@/components/nav-items'` 로 바꾸고, `NAV_MAIN_ITEMS` 선언과 그 머리말을 다음으로 바꾼다:

```tsx
/**
 * 항목은 대시보드 + 선언된 자원 전부(`RESOURCES` 순서)다 - 재료는
 * `components/nav-items.ts` 가 만들고 여기서는 아이콘만 붙인다. 자원 아이콘은
 * 전부 `ListIcon` 하나다 - 선언에 아이콘을 두지 않는다(스펙 4.5). 새 자원은
 * 선언 파일과 `lib/resources/index.ts` 한 줄로 이 목록에 들어온다 - 이
 * 파일을 고칠 일이 없다.
 *
 * 상세·작성·로그인은 사이드바에 올릴 목적지가 아니다(상세·작성은 목록
 * 안에서 이동하고, 로그인은 이미 들어온 사람에게 보일 이유가 없다).
 * 블록이 남긴 `navClouds`·`navSecondary`·`documents`(전부 `url: '#'`)는
 * 지웠다 - 대체할 화면이 없다.
 */
const NAV_MAIN_ITEMS = [
  { ...DASHBOARD_NAV_ITEM, icon: <LayoutDashboardIcon /> },
  ...resourceNavItems().map((item) => ({ ...item, icon: <ListIcon /> })),
]
```

- [ ] **Step 3: 헤더 제목**

`components/site-header-title.ts` 전체:

```ts
import { resourceBySlug } from '@/lib/resources'

/**
 * `site-header.tsx`(`'use client'`)가 아니라 여기 두는 이유 - RSC 경계.
 * `components/grid/format.ts`와 같은 판단이다: 이 함수가 순수 함수라
 * `'use client'` 파일에 있을 이유가 없고, 그 파일에 그대로 있으면 나중에
 * 서버 컴포넌트가 값으로 직접 호출할 때 "클라이언트 함수를 서버에서
 * 호출했다"로 죽는 자리가 된다(그 파일 머리말이 실측을 남긴 바로 그 사고).
 *
 * 경로의 첫 세그먼트로 선언을 찾는다(`resourceBySlug`) - `/<slug>` 는
 * `label`, `/<slug>/new` 는 `<label> 만들기`, `/<slug>/<id>` 는 `<label> 상세`,
 * `/` 는 "대시보드". 못 찾으면 빈 문자열이다 - "예제 상세" 처럼 다른
 * 자원의 문구를 그리거나 문구를 지어내지 않는다(그 자리는 곧 404 다).
 * 예전에는 `/examples` 네 경로를 손으로 분기했고, 이 목록에 없는 라우트가
 * 생기면 조용히 "예제 상세"로 그려졌다 - 이제 새 자원은 선언 하나로 제
 * 제목을 갖는다.
 *
 * 문구 규칙(`만들기`·`상세`)은 그대로다 - E2E 가 `예제 만들기` 제목을 찾는다
 * (`test/e2e/auth.spec.ts`·`examples.spec.ts`).
 */
export function titleFor(pathname: string): string {
  if (pathname === '/') return '대시보드'
  const [slug, second] = pathname.split('/').filter((segment) => segment !== '')
  const resource = slug === undefined ? undefined : resourceBySlug(slug)
  if (resource === undefined) return ''
  if (second === undefined) return resource.label
  if (second === 'new') return `${resource.label} 만들기`
  return `${resource.label} 상세`
}
```

Run: `pnpm vitest run test/unit/components/sidebar.test.ts test/unit/components/site-header-title.test.ts`
Expected: PASS.

- [ ] **Step 4: 대시보드 카드**

`components/section-cards.tsx` 전체:

```tsx
import Link from 'next/link'
import { healthLabel, type HealthStatus } from '@/app/(admin)/health'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * 대시보드 카드 - 선언된 자원마다 총합 하나, 그리고 백엔드 상태 하나
 * (`/health/ready` 도 계약에 있는 표면이고 운영자가 가장 먼저 묻는 것이다).
 *
 * 순수 렌더링이다 - 카운트 목록과 헬스 상태를 모두 props 로 받는다. 이
 * 컴포넌트 자신은 아무 것도 fetch 하지 않는다 - `app/(admin)/page.tsx` 가
 * `RESOURCES` 마다 `countRequest` 를 병행하고 `headers()` 를 부르는 자리를
 * 화면 하나로 유지한다. 예전에는 `exampleCount`·`categoryCount`·`tagCount`
 * 세 prop 을 받았다 - 자원이 늘면 이 파일을 고쳐야 했고, 그것이 스펙 2.1
 * 이 "손으로 쓴다"에 세어 둔 자리다.
 *
 * `health` 는 불리언이 아니라 `HealthStatus`(healthy/down/unexpected) 다 -
 * `app/(admin)/health.ts` 의 `classifyHealth` 가 "다운"과 "우리가 잘못
 * 물었다(예: 잘못된 경로)"를 구별해서 건네준다.
 *
 * 블록 원본의 추세 배지와 추세 문장은 지웠다 - 우리 계약에 과거 데이터도
 * 지표 엔드포인트도 없어 그 숫자를 계산할 방법이 없다. 카드의 레이아웃과
 * 타이포그래피는 블록이 쓰던 것 그대로다.
 *
 * 읽기 전용 자원 카드에는 `CardFooter` 에 "읽기 전용"을 적는다 - 그 자원은
 * 목록·상세는 있지만 만들기·수정·삭제가 없다(선언의 `writable`). 쓰기
 * 가능 자원·헬스 카드에는 적을 말이 없어 `CardFooter` 자체를 두지 않는다.
 * 카드 제목은 그 자원의 목록으로 가는 링크다 - 사이드바와 같은 목적지다.
 */
export interface ResourceCount {
  readonly label: string
  readonly href: string
  readonly count: number
  readonly writable: boolean
}

export interface SectionCardsProps {
  readonly counts: readonly ResourceCount[]
  readonly health: HealthStatus
}

export function SectionCards({ counts, health }: SectionCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {counts.map((item) => (
        <Card key={item.href} className="@container/card">
          <CardHeader>
            <CardDescription>
              <Link href={item.href} className="hover:underline">
                {item.label} 총합
              </Link>
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.count}
            </CardTitle>
          </CardHeader>
          {item.writable ? null : (
            <CardFooter className="text-sm text-muted-foreground">읽기 전용</CardFooter>
          )}
        </Card>
      ))}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>백엔드 상태</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {healthLabel(health)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
```

`app/(admin)/page.tsx` 전체:

```tsx
import { headers } from 'next/headers'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { DataTable } from '@/components/data-table'
import { describeSort, resolveSort } from '@/components/data-table-query'
import { FormBanner } from '@/components/form/form-banner'
import { SectionCards, type ResourceCount } from '@/components/section-cards'
import { request, type JsonApiResult } from '@/lib/jsonapi/client'
import type { CollectionDocument } from '@/lib/jsonapi/document'
import { RESOURCES, resourceByType } from '@/lib/resources'
import { countRequest, readTotal } from './count'
import { classifyHealth, healthRequest } from './health'
import { toSearchParams } from './[slug]/list'
import { messageForReadFailure } from './read-result'
import { buildRecentRows, recentExamplesRequest } from './recent'

/**
 * 카운트 요청들과 최근 목록 공통의 "성공했고 본문이 있다" 를 한 곳에서
 * 확인한다 - `app/(admin)/[slug]/page.tsx` 의 두 단계 던지기(ok 확인 →
 * document 확인)와 같은 판단을 자원 수만큼 반복하지 않는다. 헬스 확인은
 * 이 함수를 거치지 않는다 - 그 확인은 실패 자체가 카드가 보여줄 유효한
 * 상태이지, `error.tsx` 로 이 화면 전체를 끌고 내려갈 예외가 아니다
 * (`classifyHealth` 가 그 실패를 더 갈라 "다운"과 "우리가 잘못 물었다"를
 * 구별한다 - ./health.ts).
 *
 * `!result.ok` 는 여기서 무조건 던지지 않는다 - 호출부(`Page`)가
 * `messageForReadFailure` 로 먼저 걸러(transport 는 던져 error.tsx 로, 그 외
 * 백엔드가 실제로 낸 오류는 배너로) 이 함수에 닿는 시점에는 `result.ok`
 * 라고 가정할 수 있다. 그래도 타입 단언(`!`)은 쓰지 않는다.
 */
function unwrap(result: JsonApiResult<CollectionDocument>): CollectionDocument {
  if (!result.ok) {
    throw new Error('내부 오류: 실패한 결과가 unwrap 에 도달했습니다(호출부가 먼저 걸렀어야 한다).')
  }
  if (result.document === null) {
    throw new Error('응답에 본문이 없습니다.')
  }
  return result.document
}

/**
 * 대시보드 - 자원마다 카운트 하나 + 헬스 확인 + 최근 목록을 한 화면에서
 * 모은다. `headers()` 를 부르는 자리를 하나로 유지한다. 서로 의존하지
 * 않으므로 `Promise.all` 로 함께 보낸다.
 *
 * 카운트 카드는 `RESOURCES` 를 돈다 - 새 자원은 선언 하나로 카드를 얻는다.
 * **최근 표는 `examples` 에 묶여 있다** - `RecentRow`(./recent.ts)가
 * `title`·`status`·`score`·`updatedAt` 을 알고 그 표는 블록의 드래그 부품과
 * 함께 온 것이다. 차트와 같은 층위의 표본으로 남긴다(루트 `AGENTS.md` 의
 * "화면에는 보이지 않는 계약" 절) - `examples` 선언을 지우면 이 화면은 그
 * 자리에서 깨진다. 이 파일이 자원 이름을 코드로 아는 유일한 이유다.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const examples = resourceByType('examples')!
  const lang = (await headers()).get('accept-language')
  const params = toSearchParams(await searchParams)

  const [countResults, healthResult, recentResult] = await Promise.all([
    Promise.all(
      RESOURCES.map((resource) => request<CollectionDocument>(...countRequest(resource, lang))),
    ),
    request<Record<string, unknown>>(...healthRequest(lang)),
    request<CollectionDocument>(...recentExamplesRequest(examples, params, lang)),
  ])

  // 헬스는 뺀다(classifyHealth 가 실패 자체를 유효한 카드 상태로 다룬다 -
  // 위 unwrap 주석 참고). 나머지 중 하나라도 transport 면 messageForReadFailure
  // 가 여기서 던진다(error.tsx 로 간다). 그 외의 실패(백엔드가 실제로 낸
  // 오류)는 던지지 않고 문구를 돌려주므로, 화면 전체를 그 배너 하나로
  // 대체한다 - 카드별로 쪼개 그리지 않는 이유는 전부가 한 화면의 서로 다른
  // 조각일 뿐 사용자가 일부만 보고 판단할 수 있는 화면이 아니기 때문이다.
  for (const result of [...countResults, recentResult]) {
    if (result.ok) continue
    const message = messageForReadFailure(result.errors, '요청을 처리하지 못했습니다.')
    return (
      <div className="p-4 lg:p-6">
        <FormBanner messages={[message]} />
      </div>
    )
  }

  const counts: ResourceCount[] = RESOURCES.map((resource, position) => {
    const result = countResults[position]
    if (result === undefined) throw new Error('내부 오류: 자원 수와 카운트 결과 수가 다릅니다.')
    return {
      label: resource.label,
      href: `/${resource.slug}`,
      count: readTotal(unwrap(result)),
      writable: resource.writable,
    }
  })

  const recentDocument = unwrap(recentResult)
  const rows = buildRecentRows(recentDocument)
  const rowCount = readTotal(recentDocument)
  const sortLabel = describeSort(examples, resolveSort(params))

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <SectionCards counts={counts} health={classifyHealth(healthResult)} />
          <div className="px-4 lg:px-6">
            <ChartAreaInteractive />
          </div>
          <DataTable data={rows} rowCount={rowCount} />
          {/* 스펙: 변경한 사람 열은 두지 않는다(감사로그 계약이 없다) - 대신
              실제로 적용된 정렬을 한 줄로 밝힌다. resolveSort/describeSort 를
              recentExamplesRequest 와 같이 써서 - 기본값이 여기와 질의 조립에
              따로 있으면 한쪽만 바뀌었을 때 이 문장이 거짓말을 하게 된다. */}
          <p className="px-4 text-sm text-muted-foreground lg:px-6">
            {sortLabel}으로 정렬되어 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 단위 게이트를 확인한다**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록. `test/e2e/auth.spec.ts` 가 헬스 카드를 `[data-slot="card"]` + 텍스트 `백엔드 상태` 로 찾고 `[data-slot="card-title"]` 에서 "정상"을 읽는다 - 그 마크업은 그대로다(E2E 는 Task 6 이 돈다).

- [ ] **Step 6: 커밋**

```bash
git add components/nav-items.ts components/app-sidebar.tsx components/site-header-title.ts components/section-cards.tsx "app/(admin)/page.tsx" test/unit/components/sidebar.test.ts test/unit/components/site-header-title.test.ts
git commit -F - <<'EOF'
feat: derive the sidebar, header title and count cards from RESOURCES

사이드바 항목은 대시보드 + 선언된 자원 전부(`nav-items.ts`), 헤더 제목은
경로의 첫 세그먼트로 찾은 선언의 라벨(`만들기`·`상세` 규칙은 그대로,
못 찾으면 빈 문자열), 대시보드 카드는 `RESOURCES` 마다 카운트 하나다.
읽기 전용 자원 카드의 "읽기 전용" 꼬리와 헬스 카드는 그대로다. 최근
표는 `examples` 표본으로 남는다.
EOF
```

---
### Task 4: E2E - 읽기 전용 자원 · 없는 슬러그 · "새로 만들기" · 빈 정수, 그리고 스펙 11장의 실측

**Files:**
- Create: `test/e2e/reference.spec.ts`
- Modify: `test/e2e/examples.spec.ts` · `test/AGENTS.md` · `.github/workflows/ci.yml`(주석 한 줄)
- Modify(실측 기록): `app/(admin)/[slug]/resource.ts` · `app/(admin)/[slug]/loading.tsx` · `app/(admin)/[slug]/actions.ts` 의 머리말
- 던져 버릴 파일(만들고 지운다): `app/(admin)/examples/page.tsx` · `test/e2e/override-probe.spec.ts`

**Interfaces:**
- Consumes: Task 1~3 전부. 씨앗(`test/e2e/seed/examples.sql`·`examples.rails.sql`)의 분류 이름 `프로브 분류 하나`·`프로브 분류 둘` 과 id `11110000-0000-4000-8000-000000000001`(두 파일에서 같은 값인지 Step 1 에서 확인한다).
- Produces: 시나리오 열다섯(기존 열둘 + 셋). `app/AGENTS.md` 에 옮겨 적을 실측 문장 넷(Task 6 이 쓴다) - 보고 파일에 그대로 남긴다.

이 과업은 Docker 가 필요하다(`pnpm test:e2e` 가 정본 FastAPI 스택을 띄운다). Docker 가 없는 환경이면 Step 1~4 까지 쓰고 Step 5 이후는 돌리지 못했다고 **그대로** 보고한다 - 돌린 것처럼 적지 않는다.

- [ ] **Step 1: 씨앗 값을 두 파일에서 확인한다**

Run:

```bash
grep -n "프로브 분류" test/e2e/seed/examples.sql test/e2e/seed/examples.rails.sql
```

Expected: 두 파일 모두 `프로브 분류 하나`(id `11110000-0000-4000-8000-000000000001`)·`프로브 분류 둘`(`…0002`)이 있다. 다르면 멈추고 보고한다 - 아래 스펙 파일의 상수가 세 백엔드에서 같아야 한다.

- [ ] **Step 2: 읽기 전용 자원 시나리오를 쓴다**

`test/e2e/reference.spec.ts`:

```ts
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
```

- [ ] **Step 3: `examples.spec.ts` 를 고친다 - 진입점과 빈 정수**

`test.describe('생성 폼', …)` 의 시나리오에서 `await page.goto('/examples/new')` 한 줄을 다음으로 바꾼다:

```ts
    // 목록의 "새로 만들기"로 들어간다 - 예전에는 이 경로로 가는 링크가 화면
    // 어디에도 없어 주소를 직접 쳐야 했다. 링크지만 button 역할로 찾는다 -
    // base UI Button 이 `nativeButton={false}` 인 <a> 에 role="button" 을
    // 얹는다(app/not-found.tsx 의 실측).
    await page.goto('/examples')
    await page.getByRole('button', { name: '새로 만들기' }).click()
    await expect(page).toHaveURL(/\/examples\/new$/)
```

같은 시나리오의 주석 세 줄(`// \`items\` prop 뿐이다(resource-form.tsx 의 \`OneField\` 가 만드는 \`items\`).` · `// 그것이 없던` · `// 동안 이 자리에 UUID 가 그려졌고, 위 요약 카드만 보는 단언으로는`)을 다음 둘로 바꾼다:

```ts
    // `items` prop 뿐이다(resource-form.tsx 의 `OneField` 가 만드는 `items`).
    // 그것이 없던 동안 이 자리에 UUID 가 그려졌고, 위 요약 카드만 보는 단언으로는
```

파일 끝에 describe 를 하나 더한다:

```ts
test.describe('필수 정수', () => {
  /**
   * 빈 `int` 는 `0` 이 아니라 **키를 빼서** 보낸다(`lib/form/write.ts`) -
   * 그러면 백엔드가 "필수 속성이 없다"를 그 필드 아래(`/data/attributes/score`)
   * 오류로 돌려주고, 폼이 점수 입력 아래에 그린다는 것이 스펙 7.2 가 기대는
   * 사실이다. 세 백엔드가 실제로 그렇게 답하는지는 이 시나리오가 CI
   * 매트릭스에서 잰다 - 갈리는 백엔드가 있으면 `matrix.ts` 의
   * `KNOWN_DIVERGENCES` 절차를 따른다.
   */
  test('점수를 비우고 만들면 점수 입력 아래에 오류가 뜨고 만들어지지 않는다', async ({ page }) => {
    await provisionAndSignIn(page, uniqueEmail('score'), PASSWORD)
    await page.goto('/examples/new')

    await page.getByLabel('제목').fill(uniqueTitle('score'))
    // 점수는 비워 둔다 - 새 폼의 기본값이 이미 빈 문자열이다.
    await page.getByRole('button', { name: '만들기' }).click()

    await expect(page.getByLabel('점수')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/examples\/new$/)
  })
})
```

`test/AGENTS.md`:

- "파일별 역할" 표의 마지막 행 `| \`auth.spec.ts\`·\`bulk.spec.ts\`·\`examples.spec.ts\` | 세 시나리오 스위트 - …` 을 `| \`auth.spec.ts\`·\`bulk.spec.ts\`·\`examples.spec.ts\`·\`reference.spec.ts\` | 네 시나리오 스위트 - 아래 "새 시나리오를 쓸 때" 참고. \`reference.spec.ts\` 는 읽기 전용 자원(분류)의 목록·상세와 선언에 없는 슬러그를 잰다 - 행을 만들지 않고 씨앗 분류 이름의 접두사 \`프로브\` 로 좁힌다. |` 로 바꾼다.
- 규칙 3 의 접두사 목록 문장 끝 "`bulk.spec.ts`의 `BULK_PREFIX = 'probe-bulk'`)" 뒤에 ", `reference.spec.ts`의 `SEED_NAME_PREFIX = '프로브'`(행을 만들지 않아 씨앗 이름의 접두사를 그대로 쓴다)" 를 더한다.
- "세 파일 다 이 셋을 공통 규칙으로" → "네 파일 다 이 셋을 공통 규칙으로".
- 머리 `<!-- Generated: … | Updated: 2026-09-12 -->` 의 Updated 를 `2026-09-14` 로.

`.github/workflows/ci.yml` 의 주석 "브라우저로 세 스펙 파일을" → "브라우저로 네 스펙 파일을".

- [ ] **Step 4: 정적 검사**

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록(E2E 는 아직).

- [ ] **Step 5: 스펙 11장 1번·2번의 실측 - 던져 버릴 파일 둘로 잰다**

`app/(admin)/examples/page.tsx`(던져 버릴 정적 덮어쓰기):

```tsx
/** 실측용 - 정적 폴더가 `[slug]` 를 이기는지 잰다. 재고 나면 지운다. */
export default function StaticOverrideProbe() {
  return <p data-probe="static-override">정적 덮어쓰기 프로브</p>
}
```

`app/(admin)/[slug]/page.tsx` 의 `const resource = resourceFromSlug(slug)` 바로 다음 줄에 임시로 더한다(로딩 스켈레톤이 보일 시간을 만든다):

```ts
  await new Promise((resolve) => setTimeout(resolve, 3000)) // 실측용 임시 지연 - 지운다
```

`test/e2e/override-probe.spec.ts`(던져 버릴 스펙):

```ts
import { expect, provisionAndSignIn, test } from './fixtures'
import { probeEmail } from './probe-email'

const PASSWORD = 'probe-operator-password'

test('정적 폴더가 [slug] 를 이기고, 로딩 스켈레톤이 slug 의 칸 수를 그리고, 없는 슬러그의 상태 코드를 찍는다', async ({
  page,
  consoleGuard,
}) => {
  await provisionAndSignIn(page, probeEmail('probe-e2e-override'), PASSWORD)

  // 1. 정적 덮어쓰기 - /examples 는 프로브, /categories 는 제네릭 목록
  await page.goto('/examples')
  await expect(page.locator('[data-probe="static-override"]')).toBeVisible()
  await page.goto('/categories')
  await expect(page.locator('[data-probe="static-override"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('분류')

  // 2. 로딩 스켈레톤 - 표 머리의 스켈레톤 칸 수가 선언에서 센 값과 같다
  //    (분류: 열 1, 선택 열 없음 → 1). 임시 지연 3초 동안 보인다.
  await page.goto('/tags', { waitUntil: 'commit' })
  await expect(page.locator('div.bg-muted > [data-slot="skeleton"]')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('라벨')

  // 3. 없는 슬러그의 HTTP 상태
  consoleGuard.expectHttpFailure(/\/nope(\?|$)/)
  const response = await page.goto('/nope')
  console.log(`[probe] /nope status = ${response?.status()}`)
})
```

`[data-slot="skeleton"]` 이 실제로 있는지 먼저 확인한다: `grep -n 'data-slot="skeleton"' components/ui/skeleton.tsx`. 없으면 그 파일이 붙이는 속성·클래스로 선택자를 바꾼다(스켈레톤 선택자만 바뀌고 재는 것은 같다).

Run: `E2E_KEEP_STACK=1 pnpm exec playwright test test/e2e/override-probe.spec.ts`
Expected: PASS. 출력의 `[probe] /nope status = …` 줄을 보고에 적는다. 스택은 남아 있다(`E2E_KEEP_STACK=1`) - 다음 스텝이 그 백엔드를 쓴다.

또 `pnpm build` 를 한 번 돌려 라우트 목록에 `/examples`(정적 폴더)와 `ƒ /[slug]` 가 **나란히** 있는지 보고 그 두 줄을 보고에 적는다.

- [ ] **Step 6: 같은 실측을 `next dev` 에서 한다 - curl 로**

남아 있는 스택의 백엔드(`http://127.0.0.1:4100`)를 상대로 dev 서버를 다른 포트에 띄운다:

```bash
BACKEND_URL=http://127.0.0.1:4100 pnpm dev -p 3100
```

(백그라운드로 두고 "Ready" 가 찍힐 때까지 기다린다.) 프로브 운영자를 만들고 로그인 토큰을 받아 세션 쿠키를 손으로 만든다 - 쿠키 형식은 `lib/auth/session.ts` 의 `encodeAccessCookieValue`(`<만료 epoch ms>:<accessToken>`, 와이어에서는 콜론이 `%3A`)와 `session_refresh=<refreshToken>` 이다:

```bash
API=http://127.0.0.1:4100
EMAIL="probe-e2e-dev-override-$(date +%s)@probe.example"
JSONAPI='application/vnd.api+json'
curl -s -o /dev/null -X POST "$API/api/v1/auth/register" -H "accept: $JSONAPI" -H "content-type: $JSONAPI" \
  -d "{\"data\":{\"type\":\"users\",\"attributes\":{\"email\":\"$EMAIL\",\"password\":\"probe-operator-password\"}}}"
TOKENS=$(curl -s -X POST "$API/api/v1/auth/login" -H "accept: $JSONAPI" -H "content-type: $JSONAPI" \
  -d "{\"data\":{\"type\":\"authCredentials\",\"attributes\":{\"email\":\"$EMAIL\",\"password\":\"probe-operator-password\"}}}")
ACCESS=$(printf '%s' "$TOKENS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.attributes.accessToken))')
REFRESH=$(printf '%s' "$TOKENS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.attributes.refreshToken))')
EXPIRES=$(( $(date +%s) * 1000 + 600000 ))
COOKIE="session_access=${EXPIRES}%3A${ACCESS}; session_refresh=${REFRESH}"
curl -s -b "$COOKIE" http://127.0.0.1:3100/examples | grep -c 'static-override'
curl -s -b "$COOKIE" http://127.0.0.1:3100/categories | grep -c 'static-override'
```

Expected: 첫 grep 이 `1` 이상(정적 프로브가 그려졌다), 둘째가 `0`(제네릭 목록이다). 두 숫자를 보고에 적는다. 그 뒤 dev 서버를 끄고 스택을 내린다:

```bash
COMPOSE_PROFILES=fastapi docker compose -f docker-compose.e2e.yml down -v --remove-orphans
```

- [ ] **Step 7: 던져 버릴 것을 지우고 사실을 적는다**

```bash
git rm -q --cached "app/(admin)/examples/page.tsx" 2>/dev/null; rm -rf "app/(admin)/examples"
rm test/e2e/override-probe.spec.ts
```

`app/(admin)/[slug]/page.tsx` 의 임시 지연 한 줄을 지운다. `git status` 에 `app/(admin)/examples/` 와 `override-probe.spec.ts` 가 **없는지** 확인한다 - 남으면 스펙 6.6 위반이다(덮어쓰기 예시를 커밋하지 않는다).

실측을 세 머리말에 사실 문장으로 적는다(수치는 위에서 실제로 본 값으로):

1. `app/(admin)/[slug]/resource.ts` 머리말 끝에:

```
 *
 * 실측(2026-09-14, 정본 FastAPI 스택의 프로덕션 빌드): 선언에 없는 슬러그
 * `/nope` 의 응답 상태는 <위에서 본 값> 이고 루트 `app/not-found.tsx` 가
 * 그려졌다. Next 문서(`not-found.md`)대로 스트리밍 응답이면 200 이 온다 -
 * `app/loading.tsx`·`[slug]/loading.tsx` 가 Suspense 경계를 만들어 이 앱의
 * 응답은 스트리밍이다. E2E(`test/e2e/reference.spec.ts`)는 그래서 상태
 * 코드가 아니라 화면을 단언한다.
```

2. `app/(admin)/[slug]/loading.tsx` 머리말 끝에:

```
 *
 * 실측(2026-09-14, 프로덕션 빌드 + 3초 임시 지연): `/tags` 로 이동하는
 * 동안 표 머리에 스켈레톤 칸 1개(열 하나, 선택 열 없음)가 그려졌다 -
 * `useParams` 가 Suspense 대체 UI 안에서 slug 를 실제로 읽는다.
```

3. `app/(admin)/[slug]/actions.ts` 머리말의 "bind 된 인자는 문자열이라 직렬화에 문제가 없다(스펙 7.4)" 뒤에 " - 실측(2026-09-14): `test/e2e/examples.spec.ts` 의 생성 시나리오가 `createResourceAction.bind(null, 'examples')` 를 `useActionState` 로 제출해 201 을 받았다" 를 더한다(이 문장은 Step 8 의 E2E 가 초록인 뒤에 적는다).

`app/AGENTS.md` 에 옮겨 적을 문장 넷(Task 6 이 쓴다)을 보고 파일에 그대로 남긴다: (a) 프로덕션 빌드에서 정적 `/examples` 가 프로브를, `/categories` 가 제네릭 목록을 그렸다, (b) `next dev` 에서 curl 로 같은 결과(숫자 둘), (c) `pnpm build` 라우트 목록의 두 줄, (d) `/nope` 의 상태 코드.

- [ ] **Step 8: E2E 전체를 돈다**

Run: `pnpm test:e2e`
Expected: 열다섯 시나리오 전부 초록 - `auth` 여섯, `bulk` 둘, `examples` 다섯(정렬·필터·생성·다국어·빈 정수), `reference` 둘. 총 개수와 파일별 개수를 보고에 적는다.

`필수 정수` 시나리오가 빨간 색이면 - 정본 FastAPI 가 빈 `score` 에 `/data/attributes/score` 포인터를 주지 않는 것이다. 그 응답(상태·`errors[]`)을 브라우저 트레이스(`test-results/`)나 curl(`POST /api/v1/examples` 에 `score` 없는 문서)로 캡처해 보고에 적고, 단언을 실제 동작(예: 배너의 문서 오류)에 맞춘 뒤 `lib/form/write.ts` 머리말의 "키를 빼면 백엔드가 '필수 속성이 없다'를 그 필드 아래 오류로 돌려준다" 문장을 실측대로 고친다 - 이것이 스펙 11장 3번의 실측 자체다.

- [ ] **Step 9: 커밋**

```bash
git add test/e2e/reference.spec.ts test/e2e/examples.spec.ts test/AGENTS.md .github/workflows/ci.yml "app/(admin)/[slug]"
git commit -F - <<'EOF'
test: cover read-only resources, unknown slugs and the empty-integer path end to end

`reference.spec.ts` 가 분류 목록(쓰기 UI 없음)·상세(폼 없음)·선언에 없는
슬러그의 찾을 수 없음 화면을 잰다. 생성 시나리오는 목록의 "새로 만들기"로
들어가고, 빈 점수 시나리오가 "빈 int 는 키를 뺀다"가 기대는 백엔드 동작을
잰다. 정적 폴더가 `[slug]` 를 이기는 것, `useParams` 스켈레톤, 없는
슬러그의 응답 상태를 프로덕션 빌드와 dev 양쪽에서 실측해 머리말에 적었다.
EOF
```

---
### Task 5: 첫째 계획의 리뷰가 이연한 작은 것들

**Files:**
- Modify: `lib/resources/define.ts` · `lib/form/write.ts` · `lib/form/values.ts`
- Test: `test/unit/resources/define.test.ts` · `test/unit/components/field-control.test.ts`

**Interfaces:**
- Consumes: 없음(독립)
- Produces: 없음 - 동작은 그대로다. 종류(`kind`)를 더할 때 컴파일이 빠진 갈래를 잡게 된다.

이 과업의 항목은 첫째 계획의 최종 리뷰가 Minor 로 이연한 것들이다. 한 과업으로 묶는다 - 파일이 서로 다르고 각각 한두 줄이다. `headingLabel` 의 자리(`lib/form/values.ts`)는 옮기지 않는다 - 옮길 후보였던 `lib/jsonapi/normalize.ts` 는 복사해 온 코어라 손대지 않는다(`lib/AGENTS.md` 의 "복사해 온 코어" 절). 그 판단을 `lib/form/AGENTS.md` 에 한 줄로 적는다.

- [ ] **Step 1: 실패하는 테스트 둘**

`test/unit/resources/define.test.ts` 의 `describe('defineResource - 유도', …)` 안, "enum 이 아닌 필터는 options 키 자체가 없다" 테스트 다음에 더한다:

```ts
  it('선언에 없는 필터 키는 던지지 않고 키 이름을 라벨로, options 없이 떨어진다 - 불변식 테스트가 잡을 자리다', () => {
    const odd = defineResource({
      ...SAMPLE_INPUT,
      filters: [{ key: 'ghost', operators: ['exact'], uiOperator: 'exact' }],
    })
    expect(odd.filters[0]).toEqual({
      key: 'ghost',
      label: 'ghost',
      operators: ['exact'],
      uiOperator: 'exact',
    })
    expect(odd.filters[0]).not.toHaveProperty('options')
  })
```

(`SAMPLE_INPUT` 이 그 파일에 이미 import 돼 있지 않으면 `'../../fixtures/resources'` 에서 더한다.)

`test/unit/components/field-control.test.ts` 의 `describe('defaultAttributeValue', …)` 안, "나머지 종류는 빈 값이다" 테스트의 세 단언 뒤에 한 줄을 더한다:

```ts
    expect(defaultAttributeValue(ATTRIBUTES.createdAt!)).toBe('')
```

Run: `pnpm vitest run test/unit/resources/define.test.ts test/unit/components/field-control.test.ts`
Expected: 첫 테스트는 이미 통과할 수 있다(유도가 던지지 않는다) - 그래도 둔다, 리뷰가 "그 갈래를 재는 테스트가 없다"고 적었다. 둘째도 통과한다. 둘 다 초록이면 그대로 Step 2 로 간다.

- [ ] **Step 2: `kind` 분기 셋을 exhaustive 로**

`lib/resources/define.ts` 의 `columnKindOf` 를 다음으로 바꾼다:

```ts
/**
 * 속성 종류 → 열의 표현. 종류를 더하면 `default` 갈래의 `never` 대입이
 * 컴파일을 깨뜨린다 - 새 종류가 조용히 `text` 로 떨어지는 대신 여기서
 * 드러난다.
 */
function attributeColumnKind(attribute: AttributeDef): ColumnKind {
  switch (attribute.kind) {
    case 'string':
    case 'text':
      return 'text'
    case 'int':
      return 'number'
    case 'enum':
      return 'badge'
    case 'datetime':
      return 'datetime'
    default: {
      const exhaustive: never = attribute
      return exhaustive
    }
  }
}

/**
 * 열의 표현 - 속성이 관계보다 먼저다. 둘 다 아니면 text 로 떨어진다(불변식
 * 테스트가 잡는다).
 */
function columnKindOf(
  attribute: AttributeDef | undefined,
  relationship: RelationshipDef | undefined,
): ColumnKind {
  if (attribute !== undefined) return attributeColumnKind(attribute)
  if (relationship !== undefined) return relationship.cardinality === 'one' ? 'badge' : 'badges'
  return 'text'
}
```

같은 파일 `AttributeKind` 의 주석 "종류를 더하면 이 유니온과, `kind` 로 분기하는 두 곳(`components/resource/field-control.ts`·`lib/form/write.ts`)에 갈래를 하나씩 더한다." 를 "종류를 더하면 이 유니온과, `kind` 로 분기하는 세 곳(이 파일의 `attributeColumnKind`·`components/resource/field-control.ts` 의 `attributeControlFor`·`lib/form/write.ts` 의 `attributeOutcome`)에 갈래를 하나씩 더한다 - 셋 다 빠진 갈래를 컴파일이 잡는다." 로 바꾼다.

`lib/form/write.ts` 의 `attributeOutcome` 을 다음으로 바꾼다:

```ts
function attributeOutcome(attribute: AttributeDef, raw: string): AttributeOutcome {
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (attribute.nullable) return { present: true, value: null }
    return attribute.kind === 'int' ? { present: false } : { present: true, value: '' }
  }
  switch (attribute.kind) {
    case 'int': {
      const parsed = Number(trimmed)
      return {
        present: true,
        value: INTEGER.test(trimmed) && Number.isSafeInteger(parsed) ? parsed : raw,
      }
    }
    case 'string':
    case 'text':
    case 'enum':
    case 'datetime':
      return { present: true, value: raw }
    default: {
      const exhaustive: never = attribute
      return exhaustive
    }
  }
}
```

`components/resource/field-control.ts` 의 `attributeControlFor` 는 모든 갈래가 값을 돌려주는 `switch` 라 이미 갈래가 빠지면 "Function lacks ending return statement" 로 컴파일이 깨진다 - 손대지 않는다(그 사실을 함수 주석 한 줄로 적는다: "갈래가 빠지면 반환 타입 검사가 컴파일을 깨뜨린다 - `default` 가 필요 없다").

`lib/form/values.ts` 의 `attributeText` 위에 주석을 더한다:

```ts
/**
 * 문자열·숫자만 폼 값이 된다. `null`·누락·그 밖의 타입(불리언·객체)은 전부
 * `''` 다 - 선언의 다섯 종류가 문자열 아니면 정수뿐이라 그 밖의 값은
 * 계약 위반이고, 그때 폼에 무엇을 채워 넣어도 거짓이다. 빈 값이면 저장할
 * 때 `writeDocument` 의 빈 값 규칙이 적용된다.
 */
```

`lib/form/AGENTS.md` 의 "주요 파일" 표 아래에 한 문단을 더한다:

```
`headingLabel` 은 `values.ts` 에 둔다 - `lib/jsonapi/normalize.ts` 옆이 더
자연스러워 보이지만 그 디렉터리는 복사해 온 코어라 손대지 않는다
(`lib/AGENTS.md` 의 "복사해 온 코어" 절). 그리드(`components/grid/format.ts`)와
폼 선택 목록(`options.ts`)이 여기 하나를 쓴다.
```

Run: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: 전부 초록 - 동작은 바뀌지 않았다.

- [ ] **Step 3: 커밋**

```bash
git add lib/resources/define.ts lib/form/write.ts lib/form/values.ts lib/form/AGENTS.md components/resource/field-control.ts test/unit/resources/define.test.ts test/unit/components/field-control.test.ts
git commit -F - <<'EOF'
refactor: make the attribute kind branches exhaustive

`columnKindOf`·`attributeOutcome` 이 `never` 대입으로 빠진 갈래를 컴파일에서
잡는다. 선언에 없는 필터 키의 유도와 datetime 기본값을 재는 테스트를
더한다. `attributeText` 의 빈 값 규칙과 `headingLabel` 의 자리를 적는다.
EOF
```

---

### Task 6: 문서 · 옛 경로 정리 · 스펙 정정 · 게이트 전체

**Files:**
- Modify: `README.md` · 루트 `AGENTS.md` · `app/AGENTS.md` · `lib/resources/AGENTS.md` · `components/AGENTS.md` · `lib/AGENTS.md` · `lib/bulk/AGENTS.md` · `docs/AGENTS.md` · `docs/superpowers/specs/2026-09-14-declarative-resources-design.md`
- Modify(주석만): 옛 경로 `app/(admin)/examples/…` 와 옛 Action 이름을 언급하는 파일 전부(Step 1 의 grep 이 목록을 낸다)

**Interfaces:**
- Consumes: Task 2 의 보고(`TS2307` 이 실제로 났는가, `pnpm build` 라우트 목록), Task 4 의 보고(실측 문장 넷, E2E 시나리오 수).
- Produces: 없음 - 마지막 과업이다.

- [ ] **Step 1: 옛 경로·옛 이름을 주석에서 정리한다**

Run:

```bash
grep -rnE "\(admin\)/examples|examples/page\.tsx|examples/new/page|examples/\[id\]/page|examples/list|examples/options|examples/write|examples/bulk-outcome|examples/actions|examples/\[id\]/detail|examples/loading|test/unit/examples|ExampleAction\b|deleteExampleAction|createExampleAction|updateExampleAction|bulkDeleteExampleAction" app components lib test proxy.ts scripts README.md AGENTS.md docs/AGENTS.md .github
```

줄마다 판단한다 - **지금의 위치를 가리키는 문장**이면 아래 표대로 바꾸고, **예전 상태를 설명하는 문장**("예전에는 …", "옛 …", "… 가 있던 시절")이면 그대로 둔다.

| 옛 표현 | 새 표현 |
| --- | --- |
| `app/(admin)/examples/page.tsx` · `examples/page.tsx` | `app/(admin)/[slug]/page.tsx` · `[slug]/page.tsx` |
| `examples/new/page.tsx` · `examples/[id]/page.tsx` | `[slug]/new/page.tsx` · `[slug]/[id]/page.tsx` |
| `app/(admin)/examples/list.ts` · `options.ts` · `write.ts` · `bulk-outcome.ts` · `actions.ts` · `[id]/detail.ts` · `loading.tsx` | `app/(admin)/[slug]/…` 같은 이름 |
| `test/unit/examples/` | `test/unit/slug/` |
| `createExampleAction` · `updateExampleAction` · `deleteExampleAction` · `bulkDeleteExampleAction` | `createResourceAction` · `updateResourceAction` · `deleteResourceAction` · `bulkDeleteResourceAction` |
| `examples` 화면 넷 / 서버 컴포넌트 넷 (`app/(admin)/page.tsx`·`examples/page.tsx`·`examples/new/page.tsx`·`examples/[id]/page.tsx`) | 서버 컴포넌트 넷(`app/(admin)/page.tsx`·`[slug]/page.tsx`·`[slug]/new/page.tsx`·`[slug]/[id]/page.tsx`) |

`app/error.tsx` 머리말의 "**`app/(admin)/examples/actions.ts`의 `deleteExampleAction`은 아직 예전 방식이다**" 문단은 이름·경로를 바꾸되 뜻은 그대로 둔다(단건 삭제의 비-404 실패가 여전히 던져 이 화면이 뜬다는 알려진 한계). `test/unit/proxy.test.ts` 의 `/examples/new` 같은 **URL 리터럴**은 경로가 아니라 주소라 그대로 둔다(URL 은 바뀌지 않았다).

다시 돌려 남는 줄이 전부 "예전" 서술과 URL 리터럴뿐인지 확인한다.

- [ ] **Step 2: README**

"들어 있는 것"의 `lib/resources/`·`lib/grid/`·`lib/bulk/` 항목을 다음으로 바꾼다:

```
- `lib/resources/`·`lib/grid/`·`lib/bulk/`·`lib/form/` - 이 저장소가 새로 설계한 계층.
  자원 선언, URL ↔ 질의 변환(TanStack Table v9를 서버 구동으로), 일괄 실행기,
  폼 ↔ JSON:API 쓰기 문서 변환.
- `components/grid/`·`components/resource/` - 선언을 읽어 그리는 획일 그리드·폼·상세
  부품. 자원 이름을 모른다.
- `app/(admin)/[slug]/` - 선언된 자원 전부의 목록·생성·상세 화면 한 벌. 자원마다
  라우트 파일을 만들지 않는다(아래 "새 자원 더하기").
```

"화면" 표를 다음으로 바꾼다(그 위 문장 "경로의 정본은 `app/`의 파일 배치이고" 는 그대로):

```
| 경로            | 인증 | 내용                                                                                      |
| --------------- | ---- | ----------------------------------------------------------------------------------------- |
| `/`             | 필요 | 대시보드 - 자원마다 카운트 카드·헬스 상태·최근 목록(표본 차트 하나 제외 전부 실제 배선)     |
| `/[slug]`       | 필요 | 선언된 자원의 목록 - 열 구성·필터 뷰. `writable` 이면 다중 선택·일괄 삭제·새로 만들기      |
| `/[slug]/new`   | 필요 | 생성. `writable` 이 아니면 404                                                             |
| `/[slug]/[id]`  | 필요 | 상세. `writable` 이면 인라인 편집·삭제, 아니면 저장된 값만                                  |
| `/login`        | 공개 | 로그인                                                                                    |

`slug` 는 선언의 것이다 - 오늘은 `examples`·`categories`·`tags` 셋
(`lib/resources/index.ts`). 선언에 없는 슬러그는 404 다.
```

"**공개 표면은 `/login` 하나뿐이다** - 나머지 넷은" 의 "넷" 을 "전부" 로 바꾼다.

"첫 운영자 만들기" 절 앞에 새 절을 넣는다:

````
## 새 자원 더하기

두 단계다. `app/` 에는 아무것도 만들지 않는다.

1. `lib/resources/<이름>.ts` 에 선언을 적는다 - `lib/resources/example.ts`
   가 본이다. 열·필터·정렬·include 는 백엔드 소스에서 실측해 옮겨 적는다.
2. `lib/resources/index.ts` 의 `RESOURCES` 배열에 한 줄 더한다.

그러면 `/<slug>` 목록, `/<slug>/new` 생성, `/<slug>/<id>` 상세와 사이드바
항목·대시보드 카드가 생긴다. 읽기 전용 자원(`writable: false`)도 목록·상세를
갖고 쓰기 UI 만 빠진다. 아래는 **예시**다 - `notes` 라는 자원은 세 백엔드에
없다:

```ts
// lib/resources/note.ts
import { defineResource, type ResourceDef } from './define'

export const notesResource: ResourceDef = defineResource({
  type: 'notes',
  slug: 'notes',
  path: '/api/v1/notes',
  label: '메모',
  heading: 'subject',
  writable: true,
  attributes: {
    subject: { kind: 'string', label: '제목', nullable: false, readOnly: false },
    body: { kind: 'text', label: '본문', nullable: true, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
  },
  relationships: {},
  columns: [
    { key: 'subject', sortable: true },
    { key: 'createdAt', sortable: true },
  ],
  filters: [{ key: 'subject', operators: ['exact', 'contains'], uiOperator: 'contains' }],
  sorts: ['subject', 'createdAt'],
  includes: [],
})
```

```ts
// lib/resources/index.ts
export const RESOURCES: readonly ResourceDef[] = Object.freeze([
  examplesResource,
  exampleCategoriesResource,
  exampleTagsResource,
  notesResource, // ← 이 한 줄
])
```

선언의 자기 정합성(slug 유일, `heading` 이 속성 안에 있음, 열·필터 키가
선언 안에 있음 등 아홉)은 `test/unit/resources/index.test.ts` 가 모든
자원에 대해 잰다 - 잘못 적으면 `pnpm test` 에서 드러난다.

특정 자원의 화면을 다르게 그리고 싶으면 `app/(admin)/<slug>/` 정적 폴더를
만든다 - 정적 세그먼트가 `[slug]` 를 이긴다(`app/AGENTS.md` 의 실측). 그
폴더는 자기 `loading.tsx` 도 스스로 가져야 한다.
````

"3-백엔드 검증 결과" 절을 다음으로 바꾼다 - `<N>` 은 Task 4 가 센 시나리오 수(열다섯), 커밋은 실제 값:

```
## 3-백엔드 검증 결과

CI 매트릭스(`.github/workflows/ci.yml`)가 push·PR 마다 세 백엔드 각각에
`pnpm test:e2e` 를 돈다 - 현재 결과는 그 워크플로의 최근 실행이 정본이다.
아래는 사람이 손으로 돌려 확인한 마지막 결과다(각 행의 날짜 기준. 시나리오
수는 그 뒤로 늘었다 - 2026-09-14 현재 <N>개).

| 백엔드          | 확인일     | 커밋(`main`) | 통과      | 알려진 계약 드리프트 |
| --------------- | ---------- | ------------ | --------- | -------------------- |
| `fastapi`(정본) | 2026-09-14 | `<커밋>`     | <N>/<N>   | 0건                  |
| `nestjs`        | 2026-09-12 | `4d49f3a`    | 11/11     | 0건                  |
| `rails`         | 2026-09-12 | `231576e`    | 11/11     | 0건                  |

알려진 드리프트 목록의 정본은 `test/e2e/matrix.ts`의 `KNOWN_DIVERGENCES`다 -
비어 있어도 매 실행이 "0건"을 로그로 남긴다(침묵은 "안 돌았다"와
구별되지 않는다). 새 드리프트가 생기면 그 파일의 머리말이 절차를 적어 둔다.
```

`fastapi` 행의 커밋은 이번 게이트가 띄운 이미지의 정본 커밋이다 - `docker compose -f docker-compose.e2e.yml --profile fastapi images` 로는 알 수 없으므로, 게이트 실행 직후 `git ls-remote https://github.com/builder-shin/template-python-fastapi.git main` 의 앞 일곱 자리를 적는다(compose 가 `#main` 을 빌드하므로 실행 시점의 main 이다). `nestjs`·`rails` 행은 Step 8 에서 그 스택도 돌렸으면 같은 방법으로 갱신하고, 돌리지 않았으면 그대로 둔다 - 돌린 것처럼 적지 않는다.

- [ ] **Step 3: 루트 `AGENTS.md`**

계층 소유권 표의 `components/resource/` 행 다음에 더한다:

```
| `app/(admin)/[slug]/`  | 선언된 자원 전부의 세 화면 한 벌, Server Action 넷, 요청 조립 튜플            | `fetch`, 쿼리 조립      |
```

"지킬 것 여섯" 4번을 다음으로 바꾼다(Task 2 의 보고대로 - 실제로 났으면 "났다", 안 났으면 "이번에는 나지 않았다"):

```
4. **라우트 파일을 옮기거나 지운 뒤 게이트가 `TS2307`로 죽으면 `rm -rf .next`
   부터 한다.** `.next/dev`만 지워서는 안 되고, `pnpm build`만 돌려서는 안
   보이고 `[1/9] typecheck`에서만 드러난다 - 캐시된 라우트 타입이 남기
   때문이다. 실측(2026-09-14, `app/(admin)/examples/` 를 지우고
   `app/(admin)/[slug]/` 를 만들 때): <Task 2 보고대로 - "`TS2307` 이 실제로
   났고 `rm -rf .next` 뒤 초록이 됐다" 또는 "이번에는 나지 않았다">.
```

규칙 6 의 둘째 예시 "`app/(admin)/examples/write.ts` - `actions.ts`(`'use server'`)에 있던" 을 "`app/(admin)/[slug]/write.ts` - `actions.ts`(`'use server'`)에 있던" 으로 바꾼다.

"화면에는 보이지 않는 계약 둘" 절의 제목을 "화면에는 보이지 않는 계약 셋" 으로 바꾸고, 차트 문단 뒤에 문단을 더한다:

```
**`/`(대시보드)의 최근 표는 `examples` 에 묶여 있다.** 카운트 카드는
`RESOURCES` 를 돌아 새 자원이 선언 하나로 카드를 얻지만, 최근 표의 행
(`app/(admin)/recent.ts` 의 `RecentRow`)은 `title`·`status`·`score`·`updatedAt`
을 알고 `app/(admin)/page.tsx` 가 `resourceByType('examples')` 로 그 자원을
직접 든다 - 그 표는 블록의 드래그 부품과 함께 온 것이라 차트와 같은
층위의 표본으로 남겼다. **`examples` 선언을 지우거나 그 속성을 바꾸면
대시보드가 그 자리에서 깨진다** - 그때는 그 표를 지우거나 그 자원에 맞춰
다시 쓴다. 이 자리가 `app/` 에서 자원 이름을 코드로 아는 유일한 곳이다.
```

- [ ] **Step 4: `app/AGENTS.md`**

"화면 파일에는 `fetch`와 JSX만 둔다" 절의 첫 문장 "`app/(admin)/examples/page.tsx` 머리말이" → "`app/(admin)/[slug]/page.tsx` 머리말이". 조립 표를 다음으로 바꾼다:

```
| 파일                             | 조립하는 것                                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(admin)/[slug]/list.ts`         | 목록 요청(`listRequest`) - 경로·`gridQuery`·언어                                                                                                                                                                                                                                       |
| `(admin)/[slug]/[id]/detail.ts`  | 상세 요청(`detailRequest`) - `list.ts`와 같은 모양, `resource.includes`를 싣는다                                                                                                                                                                                                       |
| `(admin)/[slug]/options.ts`      | 관계 보기 목록 요청(`optionsRequest`) - `listRequest`를 재사용하지 않는다(include 정책이 다르다). 생성·상세용 `relationshipOptionRequests`·`optionsByRelationship`(하나라도 실패하면 배너)과 목록용 `relationshipFilterRequests`·`filterOptionsFromResults`(실패는 접는다)가 여기 있다 |
| `(admin)/[slug]/write.ts`        | 쓰기 요청 셋(`createRequest`·`updateRequest`·`deleteRequest`) - 본문은 `lib/form/write.ts` 의 `writeDocument`                                                                                                                                                                          |
| `(admin)/[slug]/resource.ts`     | 조립은 아니다 - slug → 선언(`resourceFromSlug`, 없으면 `notFound()`)과 쓰기 Action 의 문지기(`writableResource`, 없거나 읽기 전용이면 던진다)                                                                                                                                         |
| `(admin)/count.ts`               | 대시보드 카드의 자원 총합 요청(`countRequest`) - `page[size]=1`+`page[totals]=true`                                                                                                                                                                                                    |
| `(admin)/health.ts`              | 대시보드 상태 카드의 헬스 요청과 판정                                                                                                                                                                                                                                                  |
```

"지시어 경계로 나뉜 파일" 절 앞에 새 절 둘을 넣는다:

```
## `[slug]` 한 벌 - 자원마다 라우트를 만들지 않는다

`app/(admin)/[slug]/` 아래 `page.tsx`(목록) · `new/page.tsx`(생성) ·
`[id]/page.tsx`(상세)와 각자의 `loading.tsx` 가 선언된 자원 전부를 그린다.
세 화면의 첫 줄이 `resourceFromSlug(slug)` 다(`resource.ts`) - 선언에 없는
slug 는 `notFound()` 로 루트 `app/not-found.tsx` 에 간다. Server Action 넷
(`actions.ts`)은 `slug` 를 첫 인자로 받고 첫 줄에서 `writableResource(slug)`
로 쓰기 가능 여부를 확인한다 - 화면은 `action.bind(null, resource.slug)` 로
넘긴다(실측: bind 된 문자열 인자가 `useActionState` 를 거쳐 서버에 그대로
돌아온다 - `test/e2e/examples.spec.ts` 의 생성 시나리오).

`writable` 이 화면을 가른다 - 목록은 `writable` 일 때만 `bulkDeleteAction`·
`newHref` 를 그리드에 넘기고(그리드는 그 유무로 선택 열과 "새로 만들기"를
그린다), 생성은 `writable` 이 아니면 `notFound()`, 상세는 `writable` 이면
두 열(폼·저장된 값·위험 구역) 아니면 저장된 값 카드 하나다. 이 판단은
전부 화면이 선언을 읽어 한다 - 그리드·폼·상세 부품은 자원 이름을 모른다.

`loading.tsx` 셋은 `'use client'` 다 - `useParams` 로 slug 를 읽어 열 수·
필터 수·필드 수를 선언에서 센다(`[slug]/loading.tsx` 머리말의 실측).

이 디렉터리 아래에는 실제 자원 이름·필드 이름 리터럴이 코드로 하나도 없다 -
`app/` 는 자원 이름을 알아도 되지만, 이 한 벌이 특정 자원을 알기 시작하면
"선언 하나로 전부"가 거짓이 된다. 자원 이름을 코드로 아는 자리는
대시보드의 최근 표뿐이다(루트 `AGENTS.md` 의 "화면에는 보이지 않는
계약").

## 덮어쓰기 - 정적 폴더가 `[slug]` 를 이긴다

특정 자원의 화면을 다르게 그리려면 `app/(admin)/<slug>/` 정적 폴더를
만든다. 장치는 Next 의 라우트 정렬 하나다 - 같은 층위에서 정적 자식을
이름순으로 먼저 내고 그 다음 `[slug]` 를 낸다(`node_modules/next/dist/shared/
lib/router/utils/sorted-routes.js` 의 `_smoosh`). 실측(2026-09-14, 던져 버릴
`app/(admin)/examples/page.tsx` 하나로): <Task 4 보고의 (a)·(b)·(c) 를 사실
문장으로 - 프로덕션 빌드에서 `/examples` 는 정적 페이지를, `/categories` 는
제네릭 목록을 그렸다; `next dev` 에서 같은 두 경로를 curl 로 받아 같은
결과였다; `pnpm build` 의 라우트 목록에 `/examples` 와 `ƒ /[slug]` 가 나란히
있었다>. 그 파일은 재고 지웠다 - 남기면 제네릭 화면이 정작 `examples` 에서
검증되지 않는다.

덮어쓰는 폴더는 자기 `loading.tsx` 도 스스로 가져야 한다 - `[slug]/loading.tsx`
는 형제 세그먼트에 적용되지 않는다. 그 밖의 덮어쓰기 장치(필드 단위 커스텀
컴포넌트 등)는 두지 않는다.

선언에 없는 슬러그의 응답 상태: <Task 4 보고의 (d)> - `app/loading.tsx` 와
`[slug]/loading.tsx` 가 Suspense 경계를 만들어 응답이 스트리밍이면 Next 는
200 을 낸다(`not-found.md`). E2E 는 그래서 상태 코드가 아니라 화면을
단언한다(`test/e2e/reference.spec.ts`).
```

"지시어 경계로 나뉜 파일" 절의 첫 항목 "`(admin)/examples/write.ts`" → "`(admin)/[slug]/write.ts`", 그 항목 끝에 " `resource.ts` 도 같은 이유로 지시어 없이 따로 있다 - `writableResource` 는 동기 함수다." 를 더한다. "클라이언트 컴포넌트에 `proxy.ts`를 값으로 넘기지 않는다" 문단의 "(`(admin)/examples/page.tsx`)" → "(`(admin)/[slug]/page.tsx`)".

"검증" 절의 "`test/unit/examples/`가 직접 부른다" → "`test/unit/slug/`가 직접 부른다". 머리의 Updated 를 `2026-09-14` 로.

- [ ] **Step 5: 나머지 `AGENTS.md` 넷과 `docs/AGENTS.md`**

`lib/resources/AGENTS.md`:

- "## 새 자원을 더하는 절차 - 세 단계, 전부 손으로" 절을 다음으로 바꾼다:

```
## 새 자원을 더하는 절차 - 두 단계

1. 선언 파일을 만든다(`example.ts`가 본이다). 열·필터·정렬·include는 백엔드
   소스에서 실측해 옮겨 적는다 - 기억으로 채우지 않는다. 연산자 이름은
   백엔드의 `FilterField` 정책이 정한다 - 화면이 바라는 이름을 지어내면 그
   선언은 이 디렉터리의 테스트에서만 통과하고 실제 백엔드에서 거절당한다.
2. `index.ts`의 `RESOURCES` 배열에 손으로 더한다.

그러면 `/<slug>` 목록·`/<slug>/new` 생성·`/<slug>/<id>` 상세와 사이드바
항목·대시보드 카드가 생긴다(`app/(admin)/[slug]/`, `components/nav-items.ts`,
`app/(admin)/page.tsx`). `app/` 에 그 자원의 파일을 만들지 않는다 - 예전에는
셋째 단계 "`app/`에 그 자원의 라우트를 손으로 만든다"가 있었다. 화면을
다르게 그리고 싶을 때만 `app/(admin)/<slug>/` 정적 폴더를 만든다
(`app/AGENTS.md` 의 "덮어쓰기").
```

- "검증과 의존성" 의 소비자 문장에 `components/nav-items.ts`·`components/site-header-title.ts` 를 더한다. Updated 를 `2026-09-14` 로.

`components/AGENTS.md`:

- "하위 구성" 표의 "그 밖의 최상위 `.tsx`" 행 뒤에 행을 더한다: `| \`components/nav-items.ts\` · \`site-header-title.ts\` | 사이드바 항목·헤더 제목의 재료. 지시어 없음 - \`RESOURCES\`·\`resourceBySlug\` 만 읽는 순수 함수라 단위 테스트가 부른다 |`
- "사이드바 부품 다섯 중 셋만 호출된다" 문단 끝에 "항목 자체는 `nav-items.ts` 가 `RESOURCES` 에서 만든다 - 새 자원은 선언 하나로 사이드바에 들어온다." 를 더한다.
- "지시어 없는 예외" 표의 `form-banner.tsx` 행 경로를 Step 1 표대로 바꾼다.
- "검증" 절에 "사이드바 항목(`nav-items.ts`)과 헤더 제목(`site-header-title.ts`)은 `test/unit/components/sidebar.test.ts`·`site-header-title.test.ts` 가 지킨다." 를 더한다. Updated 를 `2026-09-14` 로.

`lib/AGENTS.md`: "복사해 온 코어" 절의 "(`app/(admin)/examples/list.ts`·`app/(admin)/recent.ts` 가 부른다)" → "(`app/(admin)/[slug]/list.ts`·`app/(admin)/recent.ts` 가 부른다)".

`lib/bulk/AGENTS.md`: Step 1 의 grep 이 낸 줄을 표대로 바꾼다.

`docs/AGENTS.md` "주요 파일" 표의 계획 행 다음에 둘을 더한다:

```
| `superpowers/plans/2026-09-14-declarative-resources-part-1.md`  | 선언 확장·`lib/form/`·`components/resource/` - 둘째 스펙의 첫째 계획. |
| `superpowers/plans/2026-09-14-declarative-resources-part-2.md`  | `app/(admin)/[slug]/` 라우트·셸·E2E·실측 - 둘째 스펙의 둘째 계획. |
```

- [ ] **Step 6: 스펙에 정정 註를 단다**

`docs/superpowers/specs/2026-09-14-declarative-resources-design.md` 에 구현과 어긋난 문장마다 `> **정정(2026-09-14, 구현 뒤):** …` 인용 문단을 그 문장 바로 아래에 단다(원문은 지우지 않는다 - 그 문서는 그 시점의 결정 기록이다):

1. 6.1 "세 화면의 첫 줄이 `resourceFromParams(params)` 다" 아래: "Next 16 의 `params` 가 Promise 라 화면이 먼저 `await` 하고 문자열을 넘긴다 - 실제 이름은 `resourceFromSlug(slug)` 다. 쓰기 Action 의 문지기 `writableResource(slug)` 도 같은 파일(`[slug]/resource.ts`)에 있다."
2. 6.5 "`counts: { label, href, count }[]` 하나를 받고" 아래: "읽기 전용 카드의 '읽기 전용' 꼬리를 그리려고 `writable` 을 더한 `{ label, href, count, writable }` 이다."
3. 7.1 "`Select` 에는 반드시 `items` 를 넘긴다" 아래: "관계 `Select` 에만 해당한다 - enum 의 값과 라벨은 같은 문자열이라 `items` 가 필요 없다(`components/resource/resource-form.tsx` 의 `AttributeField`)."
4. 7.2 표의 `int` 행 아래: "정규식은 앞뒤 공백을 지운 값에 적용하고, `^-?\d+$` 에 맞아도 `Number.isSafeInteger` 를 넘으면 원문 문자열 그대로 보낸다."
5. 9장 표의 `components/resource/resource-detail.tsx` 행 아래: "그 실측은 `[id]/page.tsx` 머리말이 아니라 `resource-detail.tsx` 머리말에 있다 - `useRenderElement` 가 ref 병합 훅 호출을 `typeof document !== 'undefined'` 로 감싼다."
6. 10.1 표의 `test/unit/slug/` 행 아래: "`resource.test` 는 '없으면 undefined' 가 아니라 '없으면 `notFound()` 로 던진다' 를 잰다 - `notFound()` 가 요청 스코프 없이 던지므로 단위에서 그대로 부른다. `write.test` 는 옛 `actions.test` 다."
7. 10.2 아래: "`examples.spec.ts` 도 바뀌었다 - 생성 시나리오가 목록의 '새로 만들기'로 진입하고, 빈 점수 시나리오(11장 3번의 실측)가 늘었다. 시나리오는 열다섯이다."
8. 11장 다섯 항목 각각 아래에 실측 결과 한 줄씩(Task 2·4 의 보고대로): 1번 정적 덮어쓰기 결과, 2번 스켈레톤 칸 수, 3번 세 백엔드 중 로컬에서 잰 FastAPI 결과(nestjs·rails 는 CI 매트릭스가 잰다고 적는다 - Step 8 에서 돌렸으면 그 결과), 4번 bind 직렬화, 5번 `TS2307` 여부.

- [ ] **Step 7: 인용 검사와 단위 게이트**

Run: `./scripts/check-citations.sh && pnpm format && pnpm typecheck && pnpm lint && pnpm test`
Expected: "인용 위반 0건" 과 전부 초록.

- [ ] **Step 8: 게이트 전체를 돈다**

Run: `./scripts/check.sh`
Expected: 아홉 단계 전부 초록. `[9/9] e2e` 는 정본 FastAPI 로 열다섯 시나리오를 돈다. 통과 수·파일별 수·`[matrix] fastapi: 알려진 계약 드리프트 없음` 줄을 보고에 적는다.

시간이 허락하면 나머지 둘도 돌린다(각각 백엔드 이미지를 git 컨텍스트에서 빌드하므로 몇 분씩 걸린다):

```bash
BACKEND_KIND=nestjs pnpm test:e2e
BACKEND_KIND=rails pnpm test:e2e
```

돌렸으면 결과(통과 수·드리프트 줄)를 README 표와 스펙 11장 3번에 적는다. 빨간 시나리오가 있으면 `test/e2e/matrix.ts` 머리말의 절차대로 `KNOWN_DIVERGENCES` 에 적고 그 테스트를 `test.fail` 로 물린다(`test.skip` 이 아니다). 돌리지 않았으면 README 표를 Step 2 의 모양대로 두고 보고에 "돌리지 않았다"고 적는다.

`[8/9]`·`[9/9]` 를 돌릴 Docker 가 없는 환경이면 `[1/9]`~`[7/9]` 까지의 초록을 보고하고 E2E 는 돌리지 못했다고 **그대로** 적는다 - 돌린 것처럼 적지 않는다.

- [ ] **Step 9: 커밋**

```bash
git add -A README.md AGENTS.md app components lib test docs .github/workflows/ci.yml
git commit -F - <<'EOF'
docs: describe the two-step resource procedure and the [slug] route set

README 에 "새 자원 더하기"(선언 파일 + index 한 줄)와 slug 기준 화면 표,
루트·app·lib/resources·components 의 AGENTS.md 에 `[slug]` 한 벌·덮어쓰기
실측·최근 표의 `examples` 고정을 적는다. 주석의 옛 `examples/` 경로와
옛 Action 이름을 새 자리로 옮기고, 스펙에 구현과 어긋난 문장의 정정 註와
11장 실측 결과를 단다.
EOF
```

---

## 실행 순서와 의존

| 과업 | 의존 | 끝난 뒤 상태 |
| --- | --- | --- |
| 1 그리드 | 없음 | 선택 열·"새로 만들기"가 prop 으로 갈린다. 옛 examples 화면 그대로 초록 |
| 2 `[slug]` 한 벌 | 1 | 라우트가 제네릭이다. 사이드바·헤더는 옛 코드(URL 이 같아 동작) |
| 3 셸 | 2 | 사이드바에 분류·라벨이 뜨고, 헤더·카드가 선언에서 나온다 |
| 4 E2E · 실측 | 1 · 2 · 3 | 시나리오 열다섯, 실측 문장이 머리말에 있다 |
| 5 이연 항목 | 없음(2 뒤에 두는 이유는 `define.ts` 를 두 과업이 만지지 않게 하기 위해서다) | 동작 그대로, exhaustive 가드 |
| 6 문서 · 게이트 | 2 · 3 · 4 · 5 | 문서가 새 구조를 말하고, 게이트 아홉 단계 초록 |

1 → 2 → 3 → 4 → 5 → 6 순서로 돈다. 병렬로 돌리지 않는다 - 2·3·4·6 이 같은 파일(`app/(admin)/*`·`AGENTS.md`)을 차례로 만진다. Task 4 와 6 은 Docker 가 필요하다.
