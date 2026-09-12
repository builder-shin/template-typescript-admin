# TypeScript 어드민 템플릿 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FastAPI · NestJS · Rails 세 백엔드가 공유하는 JSON:API 1.1 계약을 `BACKEND_URL` 하나로 소비하는 운영자용 어드민 템플릿을, shadcn `dashboard-01` 블록 위에 세운다.

**Architecture:** 코어(`lib/jsonapi` · `lib/auth` · `lib/config` · `proxy.ts`)는 `template-typescript-nextjs`에서 **복사**해 독립시킨다. UI 셸과 부품은 shadcn 레지스트리에서 받는다. 출처가 둘이고 이유가 다르다. 정렬·필터·페이지는 백엔드가 소유하고 TanStack Table 은 불러온 쪽만 그린다. 일괄 작업은 벌크 엔드포인트가 없으므로 요청 N 회의 순차 실행이고 부분 실패가 1급 결과다.

**Tech Stack:** Next.js 16.3.4 App Router · React 19.2.8 · TypeScript 6.0.3 (strict · `noUncheckedIndexedAccess` · `exactOptionalPropertyTypes`) · Tailwind 4.3.3 (CSS 우선, config 파일 없음) · shadcn 4.21.0 (`base-nova`) · @base-ui/react 1.8.0 · lucide-react 1.41.0 · @tanstack/react-table · vitest 5.0.0 · Playwright 1.63.0 · pnpm 11.22.0

**Spec:** `docs/superpowers/specs/2026-09-12-admin-template-design.md`

## Global Constraints

- **필수 환경 변수에 코드상의 암묵적 기본값을 두지 않는다.** `BACKEND_URL` 이 없으면 `BACKEND_URL is required` 로 **시작에 실패**한다. (스펙 7.4)
- **앱이 읽는 변수는 둘뿐이다** — `BACKEND_URL`, `SESSION_COOKIE_SECURE`(기본 `NODE_ENV === 'production'`, `true`/`false` 만). E2E 전용 다섯(`E2E_WEB_PORT`=3000 · `E2E_API_PORT`=4100 · `BACKEND_KIND`=fastapi · `E2E_KEEP_STACK` · `CI`)은 **앱이 하나도 모른다.** (스펙 7.4)
- **로딩 상태에 텍스트를 쓰지 않는다.** 스켈레톤 또는 스피너(`Loader2`) 하나만 둔다. 열 수는 선언에서 가져오고 박지 않는다. (스펙 5.3)
- **계층 위반의 정의** (스펙 4장): `lib/jsonapi/`·`lib/grid/`·`lib/bulk/` 에 이 저장소의 실제 자원 이름 문자열 리터럴이 **코드로** 나타나면 위반. `lib/resources/*.ts`·`lib/grid/*.ts`·`lib/bulk/*.ts` 에 JSX 가 있으면 위반. `app/` 에서 `fetch` 직접 호출은 위반. `components/grid/*` 에 자원 이름 분기는 위반.
- **`lib/resources/index.ts` 의 `RESOURCES` 는 손으로 채운다.** 자동 탐색(glob · `import.meta.glob` · 동적 `import`)을 쓰면 계약이 사라진다. (스펙 4장)
- **정렬·필터·페이지는 백엔드가 소유한다.** 설치된 `@tanstack/react-table@9.2.4` 에서 그 방법은 `manualPagination: true` + `rowCount` 를 주고, `sortedRowModel`·`filteredRowModel` 을 **등록하지 않는 것**이다. `manualSorting`·`manualFiltering` 은 v9 에 없다(실측 0건). (스펙 4.2)
- **일괄 작업 상한은 50 건, 동시성 1(순차)이며 선언된 자리 하나에 있다.** 화면이 그 값을 읽어 누르기 전에 알린다. (스펙 6.2)
- **오류 문구의 정본은 백엔드다.** 프론트엔드가 실패 이유 문장을 만들지 않는다. 요청 스코프의 모든 백엔드 호출이 그 요청의 `Accept-Language` 를 전달한다. (스펙 6.3)
- **사라질 자리를 인용하지 않는다.** 계획 문서·세션 스크래치패드를 코드·문서 주석에서 인용하면 게이트 `[5/9]` 가 죽인다. 근거는 사실 문장으로 적는다.
- **넣지 않는 것** (스펙 10장): 역할·권한 UI · 감사로그 · 사용자 관리 화면 · `/register` 화면 · 계약 실험실 `(lab)` · 제네릭 화면 생성기 · 일괄 작업 보상 트랜잭션 · 백엔드 어댑터 계층.
- **앞 인용은 목표가 도착할 때 다시 확인한다.** 복사해 온 주석 중 "뒤 과업이 만들 파일"을 가리키는 것은 남겨 두기로 했다. 그러면 **그 파일을 만드는 과업이 그 인용들이 참이 됐는지 확인할 책임을 진다.** 실측 사례: `lib/jsonapi/query.ts` 가 `lib/resources/define.ts` 의 `resourcePath` 를 가리켰고, Task 6 이 그 파일을 만들면서 그 함수는 넣지 않아 앞 인용이 거짓으로 귀결됐다. 새 디렉터리나 모듈을 만들었으면 `grep -rn '<그 경로>' lib/ app/ test/ proxy.ts` 로 자기를 가리키는 인용을 찾아 하나씩 확인한다.
- **커밋 메시지에 AI 관련 태그를 넣지 않는다.**

## File Structure

| 위치 | 책임 | 출처 |
| --- | --- | --- |
| `lib/config/settings.ts` | 환경 변수 해석의 정본, 필수 변수 시작 실패 | 복사 |
| `lib/jsonapi/{client,document,errors,normalize,query}.ts` | 문서 파싱 · `included` 정규화 · 쿼리 직렬화 · 오류 분류 · HTTP 협상 | 복사 |
| `lib/auth/{credentials,flow,form-state,guard,logout,rotation,session,tokens}.ts` | 쿠키 세션 · 만료 판정 · 토큰 회전 · 가드 | 복사 |
| `proxy.ts` | 보호 경로 목록 · 경로 가드 · 토큰 회전 | 복사 후 목록 교체 |
| `lib/resources/{define,example,category,tag,index}.ts` | 자원 타입 · 필터 · 정렬 · 폼 스키마 · 표시 라벨 | 신규 |
| `lib/grid/{state,query}.ts` | URL ↔ JSON:API 질의 변환, URL 직렬화 | 신규 |
| `lib/bulk/executor.ts` | 순차 실행 · 상한 · 부분 실패 집계 · 취소 | 신규 |
| `components/ui/*` | shadcn 부품 | `shadcn add` |
| `components/grid/*` | 선언을 읽는 획일 그리드 UI | 신규 |
| `components/form/submit-button.tsx` | 제출 중 스피너 하나 | 신규 |
| `app/(admin)/*` | 사이드바 셸 · 대시보드 · 자원 화면 | 블록 + 신규 |
| `app/(auth)/login/*` | 로그인 | 신규 |
| `scripts/{check.sh,check-citations.sh,check-provenance.sh,seed-operator.ts}` | 단일 게이트 · 인용 검사 · 출처 검사 · 첫 운영자 시드 | 신규 |
| `docs/provenance/copied-core.json` | 복사 출처 커밋의 기계 검사 가능한 기록 | 신규 |
| `test/unit/**` | 순수 함수 | 복사 + 신규 |
| `test/e2e/**` | 실제 백엔드 브라우저 시나리오 | 신규 |

---

### Task 1: 앱 골격과 정적 게이트

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.secretlintrc.json`, `.gitignore`, `.gitattributes`, `.npmrc`, `.env.example`
- Create: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Create: `scripts/check.sh`, `scripts/check-citations.sh`
- Test: `test/unit/scripts/check-citations.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: 없음 (첫 과업)
- Produces: `pnpm check` 게이트 진입점. `@/*` → 저장소 루트 별칭. `app/globals.css` 의 토큰 이름(`--background` · `--foreground` · `--primary` · `--secondary` · `--muted` · `--accent` · `--destructive` · `--border` · `--input` · `--ring` · `--radius` · `--sidebar*` · `--chart-1..5`)

- [ ] **Step 1: pnpm 프로젝트를 만들고 의존성을 고정한다**

`package.json` 을 만든다. 버전은 `template-typescript-nextjs@34d0b10` 과 **정확히 같게** 둔다 — 복사해 올 코어가 그 버전에서 컴파일되던 코드다.

```json
{
  "name": "template-typescript-admin",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.11.0" },
  "packageManager": "pnpm@11.22.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "secretlint": "secretlint --secretlintignore .gitignore \"**/*\"",
    "check": "./scripts/check.sh"
  },
  "dependencies": {
    "@base-ui/react": "1.8.0",
    "class-variance-authority": "0.7.1",
    "cn": "0.2.5",
    "lucide-react": "1.41.0",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@secretlint/secretlint-rule-preset-recommend": "13.0.5",
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "24.13.3",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "eslint": "10.10.0",
    "eslint-config-prettier": "10.1.8",
    "postcss": "8.5.28",
    "prettier": "3.9.6",
    "secretlint": "13.0.5",
    "shadcn": "4.21.0",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3",
    "typescript-eslint": "8.68.0",
    "vitest": "5.0.0"
  }
}
```

`cn` 은 별칭이 아니라 **실제 npm 패키지**다(`import { cn } from 'cn'`). 빼면 복사해 온 부품과 `shadcn add` 가 쓴 부품이 함께 깨진다.

`"type": "module"` 도 빼지 마라 — 없으면 vitest 가 매 실행 `configLoader` 경고를 낸다. 종료 코드는 0 이라 게이트는 초록인 채로 지나가고, `[6/9]` 의 출력만 더러워진다. 형제 저장소도 이 둘을 갖는다(실측 2026-09-12).

- [ ] **Step 2: tsconfig 를 만든다**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "allowJs": true,
    "incremental": true,
    "skipLibCheck": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

`.next/types` 와 `.next/dev/types` 를 둘 다 include 하는 것이 의도다. 라우트 파일을 옮기거나 지운 뒤 `[1/9] typecheck` 가 `.next/…/types/validator.ts` 의 `TS2307` 로 죽으면 **`rm -rf .next`** 한다. `.next/dev` 만 지우면 안 된다 — `.next/types` 쪽 오염은 `pnpm build` 가 스스로 재생성해 넘어가므로 빌드만 돌려서는 보이지 않고 typecheck 에서만 드러난다.

- [ ] **Step 3: 디자인 토큰을 `app/globals.css` 에 둔다**

`template-typescript-nextjs` 의 `app/globals.css` 를 그대로 가져온다. Tailwind 4 는 CSS 우선 설정이라 `tailwind.config.js` 가 없고 이 파일이 설정의 자리다. 반드시 함께 오는 것 셋:

1. `@custom-variant dark` 블록 — `.dark` 클래스가 없어도 `dark:` 유틸리티가 시스템 선호를 따르게 한다.
2. `:root` 의 라이트 토큰과 `@media (prefers-color-scheme: dark) { :root:not(.light) }` 의 다크 토큰.
3. `.dark {}` 블록 — 값이 2번과 **같아야 한다**. 팔레트를 바꾸면 두 곳을 함께 고친다.

`--sidebar*` 토큰이 이미 들어 있고 nextjs 는 쓰지 않는다. **어드민이 그 토큰의 첫 소비자다** — shadcn `sidebar` 부품이 그것을 요구한다(스펙 3.4).

- [ ] **Step 4: 루트 레이아웃을 만든다 — 화면 껍데기를 두지 않는다**

```tsx
import type { Metadata } from 'next'
import './globals.css'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'JSON:API 어드민 템플릿',
  description: '세 백엔드 템플릿이 공유하는 JSON:API 1.1 계약을 운영자 관점에서 소비하는 어드민 템플릿',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn('font-sans', geist.variable)}>
      <body>{children}</body>
    </html>
  )
}
```

**세션 바·사이드바 같은 화면 껍데기를 여기 두지 마라.** 이 자리는 `(admin)` 과 `(auth)` 를 모두 덮는다. 세션에 따라 달라지는 것을 여기 두면 모든 라우트가 동적 렌더링이 되고, 로그인한 채 `/login` 을 열면 헤더 높이만큼 세로 스크롤이 생긴다(nextjs 가 실측해 이월한 결함).

`lib/utils.ts` 를 함께 만든다(`cn` 재수출 한 줄).

- [ ] **Step 5: 인용 검사를 만든다 — 게이트 `[5/9]`**

```bash
#!/usr/bin/env bash
# 돌아올 수 없는 자리를 코드·문서 주석에서 인용하는 것을 막는다.
#
# 계획 문서와 세션 스크래치패드는 계획 종료·세션 종료와 함께 사라져 모든
# 인용이 죽은 링크가 된다. 인용을 남긴 쪽은 그것이 죽는 것을 보지 못하고,
# 몇 달 뒤 그 줄을 읽는 사람은 근거를 찾을 수 없다.
#
# 잡는 패턴 둘:
#   1. 선행 점이 붙은 `.superpowers/`  — 장래의 하위 트리까지 덮는다
#   2. 점 없이 쓰인 `superpowers/sdd`
# `docs/superpowers/` 는 앞이 `/` 라 어느 쪽에도 걸리지 않는다 — 그 자리는
# 커밋되므로 인용해도 된다.
#
# 종료 코드: 0 = 위반 없음, 1 = 위반 있음(위반 줄을 찍는다).
# 예외 장치(--exclude · 허용 목록 · 무시 주석)는 하나도 두지 않는다.
set -uo pipefail

TARGETS=(app components lib test proxy.ts)
PATTERN='(^|[^A-Za-z0-9_/-])\.superpowers/|(^|[^./A-Za-z0-9_-])superpowers/sdd'

existing=()
for target in "${TARGETS[@]}"; do
  [ -e "$target" ] && existing+=("$target")
done
if [ ${#existing[@]} -eq 0 ]; then
  echo "검사 대상이 아직 없다"
  exit 0
fi

if grep -rInE "$PATTERN" "${existing[@]}"; then
  echo
  echo "위반: 사라질 자리를 인용했다. 근거는 사실 문장으로 적거나 docs/superpowers/ 를 가리켜라."
  exit 1
fi

echo "인용 위반 0건"
exit 0
```

`chmod +x scripts/check-citations.sh` 를 잊지 마라 — Step 10 이 권한을 박는다.

- [ ] **Step 6: 인용 검사의 테스트를 쓴다 — 실패를 먼저 본다**

검사 대상에 `test/` 가 들어 있어서 **이 테스트 파일 자신이 검사 대상이다.** 그래서 금지 인용을 리터럴로 적으면 `[5/9]` 가 이 파일을 죽인다. 픽스처 문자열을 **조각으로 이어붙인다** — 픽스처 몸통만이 아니라 **검사 이름 · 단언 · 주석까지 전부** 해당된다.

```ts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN_DOT = '.' + 'superpowers/notes/x.md'
const FORBIDDEN_BARE = 'superpowers' + '/sdd'
const ALLOWED = 'docs/superpowers/specs/2026-09-12-admin-template-design.md'

function runCheck(body: string): { code: number } {
  const dir = mkdtempSync(join(tmpdir(), 'cit-'))
  mkdirSync(join(dir, 'lib'))
  writeFileSync(join(dir, 'lib', 'sample.ts'), body, 'utf8')
  try {
    execFileSync('bash', [join(process.cwd(), 'scripts/check-citations.sh')], { cwd: dir })
    return { code: 0 }
  } catch (error) {
    return { code: (error as { status: number }).status }
  }
}

describe('check-citations', () => {
  it('돌아올 수 없는 자리를 가리키면 0 이 아닌 코드로 죽는다', () => {
    expect(runCheck(`// ${FORBIDDEN_DOT}\n`).code).not.toBe(0)
    expect(runCheck(`// ${FORBIDDEN_BARE}\n`).code).not.toBe(0)
  })

  it('커밋되는 자리를 가리키면 통과한다', () => {
    expect(runCheck(`// ${ALLOWED}\n`).code).toBe(0)
  })
})
```

`ALLOWED` 는 **리터럴 그대로** 적는다 — 누가 패턴을 `superpowers` 전체로 넓히면 이 리터럴이 위반이 되어 게이트가 빨개진다. 그게 이 줄의 역할이다.

- [ ] **Step 7: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/scripts/check-citations.test.ts`
Expected: FAIL — `scripts/check-citations.sh` 가 없거나 아직 아무것도 잡지 않는다.

- [ ] **Step 8: 검사를 구현해 테스트를 통과시킨다**

Run: `pnpm vitest run test/unit/scripts/check-citations.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: 단일 게이트를 만든다**

`scripts/check.sh` 를 만든다. 이 시점에는 여섯 단계이고 `[8/9] compose`·`[9/9] e2e` 는 Task 13 이 붙인다.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== [1/9] typecheck ==="; pnpm typecheck
echo "=== [2/9] lint ==="; pnpm lint
echo "=== [3/9] format ==="; pnpm format:check
echo "=== [4/9] secretlint ==="; pnpm secretlint
echo "=== [5/9] 인용 ==="; ./scripts/check-citations.sh
echo "=== [6/9] unit ==="; pnpm test
echo "=== [7/9] build ==="; pnpm build
```

**단계 순서에 근거가 있다** — 분 단위인 `[9/9]` 앞에 2초짜리 정적 검사를 두어, 오타 하나로 도커 스택을 띄우지 않는다. `[5/9]` 가 secretlint 바로 뒤인 것도 같은 규율이다(작업 트리를 훑는 grep 하나라 도구 체인도 빌드도 필요 없다).

- [ ] **Step 10: 실행 권한을 박고 확인한다**

```bash
chmod +x scripts/check.sh scripts/check-citations.sh
git update-index --chmod=+x scripts/check.sh scripts/check-citations.sh
git ls-tree HEAD scripts/
```

Expected: 두 파일이 `100755`.

**이 저장소를 포함해 `core.filemode=false` 인 개발 머신에서는 권한이 빠져도 `git status` 로 드러나지 않는다.** 권한이 죽으면 CI 의 게이트가 실행조차 안 된다.

- [ ] **Step 11: 게이트를 돌려 초록을 확인한다**

Run: `pnpm install --frozen-lockfile && ./scripts/check.sh`
Expected: 일곱 단계 전부 통과.

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: scaffold Next.js app and the single verification gate

Pins every dependency to template-typescript-nextjs@34d0b10 so the core
copied in the next task compiles against the versions it was written for.
Gate step [5/9] enforces the no-dead-citation rule from the start: the
family moved that rule into its gate after it failed three times in human
memory, so the admin starts with it rather than repeating that."
```

---

### Task 2: 코어 복사 1 — `lib/config` · `lib/jsonapi` 와 출처 기록

**Files:**
- Create: `lib/config/settings.ts`, `lib/config/AGENTS.md`
- Create: `lib/jsonapi/{client,document,errors,normalize,query}.ts`, `lib/jsonapi/AGENTS.md`
- Create: `docs/provenance/copied-core.json`, `scripts/check-provenance.sh`
- Create: `.env.example`
- Test: 복사해 온 `test/unit/jsonapi/*.test.ts`, `test/unit/config/*.test.ts`, `test/unit/scripts/check-provenance.test.ts`
- Modify: `scripts/check.sh` (인용 단계 뒤에 출처 검사를 더한다)

**Interfaces:**
- Consumes: Task 1 의 `@/*` 별칭, `pnpm check`
- Produces: `lib/config/settings.ts` 가 `BACKEND_URL`·`SESSION_COOKIE_SECURE` 해석의 정본. `lib/jsonapi/` 의 export 표면 — **Step 4 가 기록한 목록이 정본이고, 뒤 과업은 그 파일을 읽어 시그니처를 확인한다.**

- [ ] **Step 1: 출처 커밋을 고정해 받아 온다**

```bash
git clone --depth 1 https://github.com/builder-shin/template-typescript-nextjs /tmp/ttn
git -C /tmp/ttn rev-parse HEAD
```

Expected: `34d0b1057d65693645e75bec4e9558dcf6838822`. 다르면 **멈추고** 새 SHA 를 Step 3 의 기록과 커밋 메시지에 함께 반영한다 — 기록과 실물이 갈리면 3.3 의 감사 가능성이 사라진다.

- [ ] **Step 2: 파일과 그 단위 테스트를 함께 복사한다**

```bash
cp -r /tmp/ttn/lib/config lib/config
cp -r /tmp/ttn/lib/jsonapi lib/jsonapi
mkdir -p test/unit/jsonapi test/unit/config
cp -r /tmp/ttn/test/unit/jsonapi/. test/unit/jsonapi/
cp /tmp/ttn/.env.example .env.example
```

**테스트를 빼고 코드만 가져오지 마라.** 이 코어의 가치는 938개 단위 테스트가 지켜 온 데서 나온다. `test/unit/config/` 가 원본에 없으면 만들지 않는다.

- [ ] **Step 2b: 복사본에서 남의 출처를 걷어낸다**

복사해 온 주석은 **원본 저장소의 과업 이력**을 인용한다 — `D2 Task 4 재수정` · `D3 Task 1` · `브랜치 리뷰 Important-1` 같은 라벨과, 여기 존재하지 않는 파일·함수·테스트 건수. 이 저장소를 읽는 사람은 그중 무엇도 찾아갈 수 없다. Task 1 이 같은 이유로 설정 파일에서 이것을 걷어냈다.

규칙은 하나다. **기술적 근거는 남기고 남의 출처는 지운다.**

- 과업·리뷰 라벨(`D<숫자> Task`, `브랜치 리뷰 …`)을 지운다.
- **이 저장소에 없는** 파일·함수·테스트 건수 인용을 지운다. 여기 실재하거나 뒤 과업이 만들 파일(`lib/jsonapi/client.ts` 등)을 가리키는 인용은 남긴다.
- 라벨을 걷어낸 뒤 기술적 내용이 남지 않는 주석은 통째로 지운다. **근거를 새로 지어내지 마라.**

```bash
grep -rnE '\(D[0-9]+ Task|브랜치 리뷰' lib/ test/ || echo "남의 출처 0건"
```

Task 1 이 `scripts/check-citations.sh` 에 이 패턴을 넣었으므로 게이트 `[5/9]` 가 남은 것을 잡는다.

- [ ] **Step 3: 출처를 기계가 읽을 수 있게 기록한다**

`docs/provenance/copied-core.json`:

```json
{
  "source": "https://github.com/builder-shin/template-typescript-nextjs",
  "commit": "34d0b1057d65693645e75bec4e9558dcf6838822",
  "copiedAt": "2026-09-12",
  "paths": ["lib/config", "lib/jsonapi", "test/unit/jsonapi"],
  "note": "복사본이다. 원본에서 계약 버그가 고쳐지면 이 커밋과 원본을 비교해 반영 여부를 판단한다."
}
```

`paths` 는 Task 3 이 `lib/auth`·`proxy.ts`·그 테스트를 더한다.

- [ ] **Step 4: export 표면을 기록에 박는다**

```bash
grep -hoE '^export (async )?(function|const|type|interface|class) [A-Za-z_][A-Za-z0-9_]*' \
  lib/jsonapi/*.ts lib/config/*.ts | awk '{print $NF}' | sort -u
```

출력을 `docs/provenance/copied-core.json` 의 `exports` 배열에 넣는다. **뒤 과업은 이 목록으로 무엇이 있는지 알고, 시그니처는 해당 파일을 열어 확인한다.** 계획이 시그니처를 베껴 적으면 그 사본이 드리프트한다.

- [ ] **Step 5: 출처 검사의 테스트를 쓴다**

**검사가 실제로 실패할 수 있다는 것을 증명하는 테스트를 쓴다.** 지금 트리에서 0 으로 끝나는 것만 재면, 스크립트가 항상 0 으로 끝나도록 망가져도 초록이다 — 그때 게이트는 제공하지 않는 보증을 보고한다. Task 1 의 인용 테스트가 세운 기준이 이것이다.

```ts
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import record from '../../../docs/provenance/copied-core.json'

const SCRIPT = join(process.cwd(), 'scripts/check-provenance.sh')

/** 깨진 기록을 담은 임시 트리에서 검사를 돌리고 종료 코드를 돌려준다. */
function runAgainst(body: string | null): number {
  const dir = mkdtempSync(join(tmpdir(), 'prov-'))
  if (body !== null) {
    mkdirSync(join(dir, 'docs', 'provenance'), { recursive: true })
    writeFileSync(join(dir, 'docs/provenance/copied-core.json'), body, 'utf8')
  }
  try {
    execFileSync('bash', [SCRIPT], { cwd: dir })
    return 0
  } catch (error) {
    return (error as { status: number }).status
  }
}

const VALID = {
  source: 'https://github.com/builder-shin/template-typescript-nextjs',
  commit: 'a'.repeat(40),
  paths: ['docs'],
}

describe('copied-core provenance', () => {
  it('지금 기록은 유효하다', () => {
    expect(record.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(record.paths.length).toBeGreaterThan(0)
    expect(() => execFileSync('bash', [SCRIPT])).not.toThrow()
  })

  it('기록 파일이 없으면 죽는다', () => {
    expect(runAgainst(null)).not.toBe(0)
  })

  it('커밋 SHA 가 40자 16진수가 아니면 죽는다', () => {
    expect(runAgainst(JSON.stringify({ ...VALID, commit: 'nope' }))).not.toBe(0)
  })

  it('paths 가 비어 있으면 죽는다', () => {
    expect(runAgainst(JSON.stringify({ ...VALID, paths: [] }))).not.toBe(0)
  })

  it('기록된 경로가 사라졌으면 죽는다', () => {
    expect(runAgainst(JSON.stringify({ ...VALID, paths: ['없는-경로'] }))).not.toBe(0)
  })
})
```

임시 디렉터리에서 돌리려면 스크립트가 **현재 작업 디렉터리 기준**으로 기록을 찾아야 한다. 기본 동작은 그대로 두어 `scripts/check.sh` 를 고칠 필요가 없게 한다.

- [ ] **Step 6: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/scripts/check-provenance.test.ts`
Expected: FAIL — `scripts/check-provenance.sh` 가 없다.

- [ ] **Step 7: `scripts/check-provenance.sh` 를 구현한다**

```bash
#!/usr/bin/env bash
# 복사해 온 코어의 출처 기록이 살아 있는지 확인한다.
#
# 출처가 적히지 않은 사본은 드리프트를 감사할 수 없다 — 몇 달 뒤 "이 버그가
# 원본에서도 고쳐졌나"를 물을 수 있어야 한다. 기록을 사람의 기억에 두면
# 다음 복사에서 갱신되지 않으므로 검사가 확인한다(스펙 3.3).
#
# 종료 코드: 0 = 기록이 유효, 1 = 없거나 깨졌거나 가리키는 경로가 사라졌다.
set -uo pipefail

RECORD=docs/provenance/copied-core.json

if [ ! -f "$RECORD" ]; then
  echo "위반: $RECORD 가 없다. 복사해 온 계층은 출처 커밋을 기록해야 한다."
  exit 1
fi

node --input-type=module -e '
import { readFileSync, existsSync } from "node:fs"
const record = JSON.parse(readFileSync("docs/provenance/copied-core.json", "utf8"))
const fail = (message) => { console.error("위반: " + message); process.exit(1) }

if (!/^[0-9a-f]{40}$/.test(record.commit ?? "")) fail("commit 이 40자 16진수 SHA 가 아니다")
if (!record.source) fail("source 가 비어 있다")
if (!Array.isArray(record.paths) || record.paths.length === 0) fail("paths 가 비어 있다")

const missing = record.paths.filter((path) => !existsSync(path))
if (missing.length > 0) fail("기록된 경로가 사라졌다: " + missing.join(", "))

console.log(`출처 기록 유효 — ${record.commit.slice(0, 7)}, 경로 ${record.paths.length}개`)
'
```

`chmod +x scripts/check-provenance.sh` 와 `git update-index --chmod=+x scripts/check-provenance.sh` 를 함께 한다.

- [ ] **Step 8: 게이트에 단계를 더한다**

`scripts/check.sh` 의 `[5/9] 인용` 바로 뒤에 넣는다.

```bash
echo "=== [5b/9] 출처 ==="; ./scripts/check-provenance.sh
```

- [ ] **Step 9: 게이트를 돌린다**

Run: `./scripts/check.sh`
Expected: 전부 통과. 복사해 온 `test/unit/jsonapi/*` 가 `[6/9]` 에서 함께 돈다.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: copy the JSON:API core and record its provenance

lib/config and lib/jsonapi are copied from
template-typescript-nextjs@34d0b10 with their unit tests. A copy with no
recorded origin cannot be audited, so the commit SHA, the copied paths and
the export surface are written to docs/provenance/copied-core.json and a
gate step verifies the record instead of trusting anyone to remember it."
```

---

### Task 3: 코어 복사 2 — `lib/auth` 와 `proxy.ts`

**Files:**
- Create: `lib/auth/{credentials,flow,form-state,guard,logout,rotation,session,tokens}.ts`, `lib/auth/AGENTS.md`
- Create: `proxy.ts`
- Test: 복사해 온 `test/unit/auth/*.test.ts`, `test/unit/proxy.test.ts`
- Modify: `docs/provenance/copied-core.json`

**Interfaces:**
- Consumes: Task 2 의 `lib/jsonapi`, `lib/config/settings.ts`, 출처 기록
- Produces: `proxy.ts` 의 `PROTECTED_PATH_PATTERNS` — **어드민에서는 `/login` 을 뺀 전부.** `lib/auth/session.ts` 의 세션 읽기(정확한 이름은 Task 2 Step 4 의 `exports` 목록을 본다)

- [ ] **Step 1: 복사한다**

```bash
cp -r /tmp/ttn/lib/auth lib/auth
cp /tmp/ttn/proxy.ts proxy.ts
mkdir -p test/unit/auth
cp -r /tmp/ttn/test/unit/auth/. test/unit/auth/
cp /tmp/ttn/test/unit/proxy.test.ts test/unit/proxy.test.ts

# logout 테스트는 아직 없는 코드를 가져온다 - 아래를 읽어라.
rm test/unit/auth/logout.test.ts
```

**`test/unit/auth/logout.test.ts` 는 여기서 복사하지 않는다.** 그 파일은 `@/app/(auth)/actions` 의 `logoutAction` 을 import 하는데, 그 Server Action 은 **Task 5** 가 만든다(실측 2026-09-12: 복사 대상 아홉 중 이 파일 하나만 `app/` 에 닿는다). 가져오면 `[1/9] typecheck` 가 없는 모듈로 죽는다.

**스텁을 만들어 넘기지 마라.** 스텁은 가짜를 상대로 통과하는 테스트를 만들고, 그때 초록은 아무것도 보증하지 않는다. 테스트는 자기가 검증하는 코드와 함께 와야 하므로 **Task 5 가 `actions.ts` 를 만들 때 이 테스트를 가져온다.**

그동안 `lib/auth/logout.ts` 자체는 복사되지만 단위 테스트가 없는 상태로 남는다 — Task 5 가 닫는다.

복사 직후 **Task 2 Step 2b 와 같은 정리를 한다** — 과업·리뷰 라벨과 이 저장소에 없는 파일·함수 인용을 걷어내고, 기술적 근거만 남긴다. `lib/auth/` 의 주석은 `app/(auth)/` 와 `app/(lab)/` 를 자주 가리키는데, **`(lab)` 은 이 저장소에 영영 생기지 않는다**(계약 실험실은 형제 저장소가 소유한다). 게이트 `[5/9]` 가 남은 라벨을 잡는다.

**`스펙 N.N` 포인터도 함께 걷어낸다.** 복사본의 절 번호는 **형제 저장소 스펙의 것**이라 이 저장소에서는 대부분 다른 절로 떨어진다 — Task 2 에서 실측한 결과 `9.2` 는 여기 아예 없고, `7.2` 는 첫 운영자 문제이며, `3장`·`8.1` 은 코어 조달과 단일 게이트였다. **죽은 인용보다 나쁘다**: 죽은 인용은 아무 데도 안 닿는 것을 독자가 알지만, 이것은 그럴듯하고 틀린 곳에 닿는다.

포인터는 거의 항상 이미 뜻을 담은 문장 뒤의 괄호다 — 괄호만 지우면 손실이 없다. 괄호가 내용을 품고 있으면 그 내용을 문장으로 살리고 번호만 뺀다. **우리 절 번호로 다시 매핑하지 마라** — 손으로 매핑하면 고치는 것보다 틀리는 것이 많다.

**맨 `Task N` 도 잡아야 한다.** `proxy.ts` 에 `"Task 5 와의 새 계약이다"` 라는 주석이 있는데(실측), 그건 **형제의 Task 5** 다. 그런데 **우리 Task 5 도 하필 로그인 과업**이라 우리 계획을 가리키는 것처럼 읽힌다 — 우연이 인용을 더 위험하게 만든 자리다.

이 경우 내용 자체는 우리에게도 참이다(로그인 Server Action 이 `LOGIN_REDIRECT_PARAM` 을 읽어야 복귀가 완성된다). 그러니 **번호만 빼고 무엇과의 계약인지로 다시 쓴다** — 예: "로그인 Server Action 과의 계약이다".

```bash
grep -rnE 'D[0-9]+ Task|Task [0-9]|브랜치 리뷰|\(lab\)|스펙 [0-9]' lib/ test/ proxy.ts || echo "남의 출처 0건"
```

`test/unit/scripts/check-citations.test.ts` 의 `스펙 4.2` 는 **우리 것**이고, 게이트가 우리 스펙 인용을 막지 않는다는 것을 증명하는 픽스처다 — 건드리지 마라.

- [ ] **Step 2: 보호 경로 목록을 어드민의 것으로 바꾸는 테스트를 먼저 쓴다**

nextjs 는 목록·상세가 공개이고 쓰기만 보호된다. **어드민은 읽기조차 운영자만 본다.** 복사해 온 `test/unit/proxy.test.ts` 에 더한다.

복사본은 이미 `isProtectedPath(pathname)` 를 export 한다(`PROTECTED_PATH_PATTERNS.some(...)` 를 감싼 것). **그 판정을 테스트에서 다시 구현하지 마라** — 로직을 베껴 두면 둘이 갈라질 수 있고, 갈라지면 테스트가 제품이 아니라 자기 사본을 검증한다.

```ts
import { describe, expect, it } from 'vitest'
import { isProtectedPath } from '@/proxy'

describe('어드민의 보호 경로', () => {
  it('공개는 /login 하나다', () => {
    expect(isProtectedPath('/login')).toBe(false)
  })

  it.each(['/', '/examples', '/examples/abc', '/examples/new', '/examples/abc/edit'])(
    '%s 는 보호된다',
    (path) => {
      expect(isProtectedPath(path)).toBe(true)
    },
  )

  it('가입 경로는 존재하지 않는다', () => {
    expect(isProtectedPath('/register')).toBe(true)
  })
})
```

복사본의 기본값은 `/examples/new` 와 `/examples/[id]/edit` 둘만 보호한다(실측) — 나머지를 공개로 두는 고객용 앱의 목록이다. 위 테스트는 그 목록으로는 전부 실패한다. 그게 Step 4 가 할 일이다.

마지막 검사가 중요하다 — `/register` 화면을 만들지 않기로 했으므로(스펙 7.1) 그 경로가 **열려 있으면 안 된다.** 없는 화면이 공개로 남으면 나중에 누가 만들 때 보호를 잊는다.

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/proxy.test.ts`
Expected: FAIL — 복사해 온 목록은 `/examples` 를 공개로 둔다.

- [ ] **Step 4: `PROTECTED_PATH_PATTERNS` 를 교체한다**

`/login` 만 빠지는 목록으로 바꾼다. 막힌 요청은 `/login?next=<원래 경로>` 로 보내고 로그인 성공 후 그 경로로 돌아온다 — 그 배선은 복사해 온 코드가 이미 갖고 있다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/proxy.test.ts`
Expected: PASS

- [ ] **Step 6: 출처 기록을 갱신한다**

`docs/provenance/copied-core.json` 의 `paths` 에 `lib/auth` · `proxy.ts` · `test/unit/auth` · `test/unit/proxy.test.ts` 를 더한다. `note` 에 **`proxy.ts` 의 보호 경로 목록은 어드민에서 의도적으로 갈라졌다**는 사실을 적는다 — 적지 않으면 다음 사람이 원본과 비교하며 드리프트로 오해한다.

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `./scripts/check.sh`
Expected: 전부 통과.

```bash
git add -A
git commit -m "feat: copy the auth core and close every path but /login

lib/auth and proxy.ts come from the same pinned commit with their tests.
PROTECTED_PATH_PATTERNS deliberately diverges from the source: the admin has
no public surface, so /login is the only unprotected path and /register is
protected even though no such screen exists, so that adding one later cannot
quietly ship it open. The divergence is recorded in the provenance note."
```

---

### Task 4: shadcn 초기화와 `dashboard-01` 설치

**Files:**
- Create: `components.json`
- Create: `components/ui/*` (레지스트리가 쓴다), `app/(admin)/**` (블록이 쓴다)
- Modify: `package.json` (레지스트리가 의존성을 더한다), `components/ui/table.tsx`, `components/ui/label.tsx`
- Test: `test/unit/components/registry-policy.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `app/globals.css` 토큰(특히 `--sidebar*`), `cn` 패키지
- Produces: `components/ui/` 의 shadcn 부품 19개. `SidebarProvider` · `SidebarInset` · `AppSidebar` · `SiteHeader` · `SectionCards` · `ChartAreaInteractive` · `DataTable` 부품. `@tanstack/react-table` · `@dnd-kit/*` · `zod` 의존성

- [ ] **Step 1: `components.json` 을 만든다**

`template-typescript-nextjs` 의 것과 같은 설정으로 둔다 — `style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"`, `rsc: true`, `tsx: true`, `css: "app/globals.css"`, 별칭 `@/components` · `@/lib/utils` · `@/components/ui` · `@/lib` · `@/hooks`. 스타일이 다르면 블록이 패밀리와 다른 생김새로 온다.

- [ ] **Step 2: 블록을 설치한다**

```bash
npx shadcn@latest add dashboard-01
```

- [ ] **Step 2b: 블록이 주지 않는 부품을 따로 받는다**

```bash
npx shadcn@latest add skeleton
```

**`skeleton` 은 `dashboard-01` 의 레지스트리 의존 19개에 없다**(실측 2026-09-12). 그런데 Step 8b 의 `app/loading.tsx` 와 뒤 과업들의 라우트별 `loading.tsx` 가 전부 그것을 쓴다 — 로딩 상태에 텍스트를 쓰지 않는다는 규칙(스펙 5.3)을 지키는 수단이 스켈레톤이기 때문이다.

- [ ] **Step 3: 받은 것을 확인한다**

```bash
ls components/ui/
git diff --stat package.json
```

Expected — 레지스트리 부품 19개(`sidebar` · `breadcrumb` · `separator` · `label` · `chart` · `card` · `select` · `tabs` · `table` · `toggle-group` · `badge` · `button` · `checkbox` · `dropdown-menu` · `drawer` · `input` · `avatar` · `sheet` · `sonner`)와 의존성 여섯(`@tanstack/react-table` · `@dnd-kit/core` · `@dnd-kit/modifiers` · `@dnd-kit/sortable` · `@dnd-kit/utilities` · `zod`).

빠진 것이 있으면 멈추고 원인을 찾는다. 설치된 `@tanstack/react-table` 의 버전을 적어 둔다 — Task 8 이 그 버전의 옵션 이름을 확인해야 한다.

- [ ] **Step 4: 패밀리의 `'use client'` 정책을 되돌리는 테스트를 쓴다**

**이 단계를 빼면 목록 화면이 조용히 무거워진다.** 레지스트리는 `table.tsx` 와 `label.tsx` 에 `'use client'` 를 붙여 보내는데, 그 여덟 컴포넌트는 훅도 이벤트 핸들러도 브라우저 API 도 없는 순수 마크업이다. 지시어를 남기면 목록이 RSC 인데도 **표 전체가 클라이언트 경계 안으로 들어가 행·칸 마크업이 통째로 번들과 flight 페이로드에 실린다.** nextjs 저장소의 `table.tsx` 주석이 "다시 돌리면 지시어가 되살아난다, 되살아난 것을 보면 다시 빼라"고 경고하는 그 자리다.

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PURE_MARKUP = ['components/ui/table.tsx', 'components/ui/label.tsx']

describe('레지스트리 부품의 use client 정책', () => {
  it.each(PURE_MARKUP)('%s 에 use client 가 없다', (path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(/^\s*['"]use client['"]/m)
  })
})
```

판단 기준은 **훅 · 이벤트 핸들러 · 브라우저 API 가 하나도 없으면 뺀다**다. 다른 부품에도 해당하면 `PURE_MARKUP` 에 더한다 — 다만 실제로 훅을 쓰는 것(`sidebar` · `chart` · `dropdown-menu` · `drawer` · `sheet` · `sonner` · `select` · `tabs` · `toggle-group` · `checkbox`)은 건드리지 않는다.

- [ ] **Step 5: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/components/registry-policy.test.ts`
Expected: FAIL — 방금 설치한 두 파일에 지시어가 있다.

- [ ] **Step 6: 지시어를 빼고 그 이유를 파일에 남긴다**

두 파일에서 `'use client'` 를 지우고, **왜 뺐는지와 `shadcn add` 를 다시 돌리면 되살아난다는 사실**을 주석으로 적는다. 주석이 없으면 다음 사람이 "레지스트리와 다르다"며 되돌린다.

- [ ] **Step 7: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/components/registry-policy.test.ts`
Expected: PASS

- [ ] **Step 8: 블록의 화면을 `(admin)` 그룹으로 옮긴다**

블록이 쓴 `page.tsx` 와 그 `components/` 를 `app/(admin)/` 아래로 옮긴다. 라우트 그룹은 URL 에 세그먼트를 더하지 않으므로 대시보드는 `/` 다.

**import 경로를 확인한다.** 레지스트리 원본은 `@/registry/base-nova/blocks/dashboard-01/components/...` 와 `@/registry/base-nova/ui/sidebar` 를 가리킨다. CLI 가 `components.json` 의 별칭으로 다시 써 주지만, 남아 있으면 해석되지 않는다.

```bash
grep -rn '@/registry/' app/ components/ || echo "레지스트리 경로 잔재 0건"
```

잔재가 있으면 `@/components/ui/...` 와 `@/app/(admin)/components/...` 로 고친다.

`(admin)/layout.tsx` 를 만들어 셸을 그 자리로 내린다 — `SidebarProvider` 와 `SidebarInset` 과 `SiteHeader` 는 `page.tsx` 가 아니라 레이아웃이 갖는다. 그래야 `/examples` 같은 자원 화면이 같은 셸 안에 들어온다.

```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**`(admin)` 안에서 `min-h-svh` 를 쓰지 마라.** 높이는 셸이 갖는다 — 화면이 다시 잡으면 헤더 높이만큼 넘친다.

- [ ] **Step 8b: 그룹 밖 껍데기 셋을 만든다**

`app/` 루트에 `error.tsx` · `not-found.tsx` · `loading.tsx` 를 만든다. 형제 저장소의 같은 파일을 가져와 이 저장소에 맞게 다듬는다(인용 정리는 Task 2·3 과 같은 규칙).

**이건 취향이 아니라 기능 구멍을 메우는 일이다.** 복사해 온 코어의 오류 설계가 이 파일의 존재에 걸려 있다(실측 2026-09-12):

- `lib/jsonapi/errors.ts:49` — 백엔드가 응답조차 주지 못한 `transport` 갈래는 **`app/error.tsx` 가 받는다**. 나머지 넷과 달리 화면이 직접 그리지 않는다.
- `lib/jsonapi/client.ts:18-25` — 읽기 경로에서 던질지 `ok:false` 로 돌려줄지의 판단이 **"`error.tsx` 가 있으니 던져도 흰 페이지가 아니다"** 를 전제로 쓰여 있다.

**즉 이 파일이 없는 동안 그 전제가 거짓이다.** 던지는 읽기 경로는 Next 기본 오류 화면으로 떨어지고, `transport` 갈래는 받을 곳이 없다. Task 2 의 주석 다섯 자리가 이 파일을 가리키는 이유가 그것이고, 이 단계가 생기면 그 인용들은 **앞을 가리키는 올바른 인용**이 된다.

형제의 `app/error.tsx` 는 `@/components/ui/button` 을 쓴다 — 이 과업이 `shadcn add` 로 이미 들여온 뒤라 그대로 온다. `min-h-svh` 도 쓰는데, **이 셋은 그룹 밖이라 셸이 없으므로 여기서는 옳다**(금지되는 것은 `(admin)` 안이다).

가져온 뒤 `스펙 9.2` 같은 형제 스펙 포인터와 과업 라벨(`D3 Task 2` · `D2 Task 7`)을 Task 2·3 과 같은 규칙으로 걷어낸다. **다만 `not-found.tsx` 의 긴 주석은 조심해서 읽어라** — 그 안의 `nativeButton={false}` 실측(기본값은 `<a type="button">` + 콘솔 error, 이 prop 을 주면 `<a role="button">` + 경고 없음)은 **지어낸 것이 아니라 마크업을 직접 읽어 잰 기술적 근거다.** 라벨만 떼고 그 측정은 남긴다. `test/e2e/fixtures.ts` 를 가리키는 부분은 Task 13 이 만들 파일이므로 앞을 가리키는 올바른 인용이다.

`loading.tsx` 의 주석은 라우트 세그먼트별 `loading.tsx` 가 자원별 모양을 갖는다고 적는다 — 그건 Task 8·10 이 실제로 하는 일이라 그대로 참이다.

`app/` 루트의 셋은 **라우트 그룹 밖이라 셸을 두르지 않는다.** 즉 `(admin)` 안의 화면이 `notFound()` 를 불러도 사이드바는 사라진다. 그게 의도다.

`loading.tsx` 는 **텍스트를 하나도 쓰지 않는다** — 스켈레톤 또는 스피너만(스펙 5.3).

- [ ] **Step 9: 게이트를 돌린다**

Run: `rm -rf .next && ./scripts/check.sh`
Expected: 전부 통과. 라우트 파일을 옮겼으니 `.next` 를 먼저 지운다(Task 1 Step 2 의 함정).

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: install the shadcn dashboard-01 block as the admin shell

The admin UI is not hand-designed: the block is the design. Style base-nova
matches the family, and the 13 components new to the family are exactly the
parts the admin needed and the family lacked, which is also why globals.css
already defines unused --sidebar-* tokens.

The registry ships table.tsx and label.tsx with 'use client', which the
family deliberately removes: those files are pure markup, and leaving the
directive pulls the whole table into the client boundary on a list screen
that renders on the server. A unit test now holds that policy, so running
shadcn add again cannot quietly undo it."
```

---

### Task 5: 로그인 화면과 첫 운영자 시드

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/actions.ts`, `app/(auth)/credentials-form.tsx`
- Create: `components/form/submit-button.tsx`, `components/form/field-error.tsx`, `components/form/form-banner.tsx`
- Create: `scripts/seed-operator.ts`, `lib/auth/provision.ts`
- Test: `test/unit/auth/provision.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `lib/auth`, Task 2 의 `lib/config/settings.ts`
- Produces: `provisionOperator({ backendUrl, email, password }): Promise<{ id: string }>` — `POST /auth/register` 를 한 번 호출한다. **Task 13 의 E2E 프로비저닝이 같은 함수를 쓴다.**

- [ ] **Step 1: 프로비저닝 함수의 테스트를 쓴다**

```ts
import { describe, expect, it, vi } from 'vitest'
import { provisionOperator } from '@/lib/auth/provision'

describe('provisionOperator', () => {
  it('가입 경로에 JSON:API 미디어 타입으로 POST 한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
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
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/vnd.api+json')
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
```

둘째 검사가 nextjs 가 실측으로 배운 함정이다 — 로컬 파트가 64자를 넘는 픽스처를 **정본과 Rails 만 받아 줘서** NestJS 갈래의 첫 실행에서 E2E 아홉이 죽었다. 두 백엔드가 우연히 너그러운 동안만 참이던 픽스처다. **도커를 띄우기 전에 던지게 한다.**

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/auth/provision.test.ts`
Expected: FAIL — `lib/auth/provision.ts` 가 없다.

- [ ] **Step 3: `lib/auth/provision.ts` 를 구현한다**

`fetch` 를 둘째 인자로 받아 주입 가능하게 둔다(테스트가 그렇게 쓴다). 64자 상한을 백엔드 호출 **전에** 검사한다. 오류 본문은 그대로 올려 보낸다 — 문구를 만들지 않는다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/auth/provision.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 시드 스크립트를 만든다**

`scripts/seed-operator.ts` 는 `BACKEND_URL` 과 인자로 받은 이메일·비밀번호로 `provisionOperator` 를 한 번 부른다. 성공하면 만들어진 id 를 찍고, 409 면 "이미 있다"로 0 으로 끝난다(재실행이 안전해야 한다).

`package.json` 에 `"seed:operator": "node --experimental-strip-types scripts/seed-operator.ts"` 를 더한다.

- [ ] **Step 6: 제출 버튼을 만든다 — 텍스트 없이 스피너 하나**

```tsx
'use client'

import { Loader2 } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : label}
    </Button>
  )
}
```

**제출 중에 "로그인 중..." 같은 문구를 쓰지 않는다.** pending 동안 버튼 안에는 스피너 하나만 남는다(전역 규칙, 스펙 5.3).

- [ ] **Step 6b: Task 3 이 미뤄 둔 로그아웃 테스트를 가져온다**

`app/(auth)/actions.ts` 를 만든 뒤, Task 3 이 복사하지 않고 남겨 둔 테스트를 가져온다.

```bash
cp /tmp/ttn/test/unit/auth/logout.test.ts test/unit/auth/logout.test.ts
```

그 파일은 `@/app/(auth)/actions` 의 `logoutAction` 을 import 한다 — Task 3 시점에는 그 모듈이 없어서 `[1/9]` 가 죽었다. 이제 존재하므로 함께 온다. **복사 직후 Task 3 과 같은 인용 정리를 한다**(과업·리뷰 라벨, 이 저장소에 없는 파일 인용, `스펙 N.N` 포인터).

`logoutAction` 의 시그니처가 복사본이 기대하는 것과 다르면 **테스트를 고치지 말고** 이 과업의 `actions.ts` 를 원본에 맞춘다 — 그 테스트가 계약의 정본이다.

`docs/provenance/copied-core.json` 의 `paths` 에 이 파일을 더한다.

**`lib/auth/logout.ts` 의 주석 셋도 확인한다.** Task 3 이 이 테스트를 지운 동안 `logout.ts:62,91,207` 은 여전히 "`logout.test.ts` 가 고정한다"고 적어 두었다 — 그 두 과업 사이에서는 거짓이었고, 이제 파일이 돌아오면 **다시 참이 된다.** 세 자리를 읽어 실제로 참인지 확인하고, 테스트가 고정하는 내용이 달라졌으면 문장을 맞춘다. 스스로 닫히는 문제라 Task 3 에서는 보류했다.

**`test/unit/auth/AGENTS.md` 의 파일 표도 함께 고친다.** Task 3 이 이 파일을 지울 때 그 표의 행을 "뒤 과업이 가져온다"로 바꿔 뒀다 — 이제 실재하므로 그 행을 다시 현재 상태로 고친다. 인용 게이트는 이것을 잡지 못한다(금지 패턴이 없다). **디렉터리 문서가 없는 파일을 있다고 적거나 있는 파일을 없다고 적으면, 읽는 사람은 디렉터리가 아니라 그 표를 믿는다.**

- [ ] **Step 7: `(auth)` 그룹과 로그인 화면을 만든다**

`app/(auth)/layout.tsx` 는 **헤더 없는 뷰포트 전체**다. `login/page.tsx` 는 이메일·비밀번호와 `SubmitButton`, 실패 배너(`form-banner.tsx`)를 그린다. 실패 문구는 백엔드가 준 것을 쓴다.

화면에 **가입 링크를 두지 않는다.** 대신 "첫 운영자 계정은 시드 스크립트로 만든다"는 안내와 `README` 를 가리키는 한 줄을 둔다 — 클론한 사람이 읽을 자리다.

**로고나 아이콘이 필요하면 인라인 SVG 로 그린다. `public/` 에 파일을 두지 마라.** Task 3 이 보호 경로를 전부 매치로 바꿨고, `proxy.ts` 의 `config.matcher` 는 `_next/static` · `_next/image` · `favicon.ico` 만 제외한다. 즉 **`public/` 에서 서빙되는 첫 파일은 `/login` 으로 리다이렉트된다** — 하필 로그인 화면이 그 파일을 참조하면 그 이미지가 깨진다. Task 3 이 그 사실을 `config.matcher` 주석과 `isProtectedPath('/logo.png')` 가 참임을 고정하는 테스트로 크게 만들어 뒀다.

자산이 정말 필요하면 세 가지를 함께 한다: `config.matcher` 의 예외를 넓히고, 그 고정 테스트를 새 동작에 맞게 고치고, **왜 넓혔는지를 주석에 적는다.** 조용히 넓히면 다음 사람이 보호 구멍으로 읽는다.

- [ ] **Step 8: 실제 백엔드로 손으로 확인한다**

**미리 빌드된 백엔드 이미지는 없다**(실측: 세 저장소의 ghcr 패키지가 존재하지 않는다). 그리고 FastAPI 는 Postgres 를 요구하므로 `docker run` 하나로는 뜨지 않는다.

**백엔드가 자기 스택을 소유한다** — 우리 저장소에 개발용 compose 파일을 만들지 마라. 형제 저장소도 그러지 않는다. 백엔드의 `docker-compose.yml` 을 그대로 쓴다(실측: `db`(postgres:18-alpine) · `redis` · `migrate`(alembic) · `api`(`4000:4000`) · `worker` 가 다 들어 있다).

```bash
git clone --depth 1 https://github.com/builder-shin/template-python-fastapi /tmp/api-fastapi
docker compose -f /tmp/api-fastapi/docker-compose.yml up -d --build db redis migrate api

curl -s -H 'accept: application/vnd.api+json' http://localhost:4000/health   # 뜰 때까지

BACKEND_URL=http://localhost:4000 pnpm seed:operator ops@example.com 'pw-long-enough'
BACKEND_URL=http://localhost:4000 pnpm dev
```

포트는 **4000** 이다. `E2E_API_PORT` 의 기본값 4100 은 Task 13 의 E2E 스택 전용이고, 컨테이너 안의 4000 과 호스트 공개 포트를 헷갈리지 않으려고 일부러 다르게 둔 값이다.

`/` 를 열면 `/login?next=%2F` 로 보내지고, 시드한 계정으로 들어가면 `/` 의 dashboard-01 셸이 보인다.

확인 후 내린다.

```bash
docker compose -f /tmp/api-fastapi/docker-compose.yml down -v
```

**도커가 없거나 빌드가 실패하면 BLOCKED 로 보고하지 말고 그 사실을 보고서에 적고 넘어가라** — 이 단계는 손으로 하는 연기(smoke) 확인이고, 실제 백엔드에 대한 자동 검증은 Task 13 이 소유한다. 이 과업의 게이트는 단위 테스트로 선다.

- [ ] **Step 9: 게이트를 돌리고 커밋**

Run: `./scripts/check.sh`

```bash
git add -A
git commit -m "feat: add the login screen and seed the first operator

Operators do not self-register, so there is no /register screen. The backend
has no admin-side account creation either (users exposes only GET /me), so
the first operator comes from a seed script calling POST /auth/register once.

provisionOperator is shared with the E2E provisioning added later, so the
documented seed path is executed on every E2E run instead of rotting in the
README. It rejects an email whose local part exceeds RFC 5321's 64 characters
before touching the backend: the family lost nine E2E tests to a fixture that
only two of the three backends happened to accept."
```

---

### Task 6: `lib/resources` — 자원 선언

**Files:**
- Create: `lib/resources/define.ts`, `lib/resources/example.ts`, `lib/resources/category.ts`, `lib/resources/tag.ts`, `lib/resources/index.ts`, `lib/resources/AGENTS.md`
- Test: `test/unit/resources/define.test.ts`, `test/unit/resources/index.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 선언 계층)
- Produces:

**연산자 어휘는 백엔드가 정한다.** 실측(2026-09-12, FastAPI `app/schemas/example.py` 의 `FilterField` 정책): `exact` · `contains` · `in` · `gt` · `gte` · `lt` · `lte` · `isNull`. **`eq` 는 존재하지 않는다** — 이름을 지어내면 우리 테스트는 초록이고 실제 백엔드에서만 죽는다.

```ts
export type FilterOperator =
  | 'exact'
  | 'contains'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isNull'

export type ColumnKind = 'text' | 'number' | 'badge' | 'badges' | 'datetime'

export interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly kind: ColumnKind
  readonly sortable: boolean
}

export interface FilterDef {
  /** 백엔드의 필터 키. 관계는 `category.id` 처럼 점을 포함한다. */
  readonly key: string
  readonly label: string
  /** 백엔드가 그 필드에 허용한 연산자 전부. 손으로 베낀 거울이다. */
  readonly operators: readonly FilterOperator[]
  /** 화면이 기본으로 쓰는 연산자. `operators` 안에 있어야 한다. */
  readonly uiOperator: FilterOperator
  readonly options?: readonly string[]
}

export interface ResourceDef {
  readonly type: string
  readonly path: string
  readonly label: string
  readonly writable: boolean
  readonly columns: readonly ColumnDef[]
  readonly filters: readonly FilterDef[]
  readonly sorts: readonly string[]
  readonly includes: readonly string[]
}

export function defineResource(def: ResourceDef): ResourceDef
export const RESOURCES: readonly ResourceDef[]
export function resourceByType(type: string): ResourceDef | undefined
```

- [ ] **Step 1: 선언 계층의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { RESOURCES, resourceByType } from '@/lib/resources'

describe('RESOURCES', () => {
  it('손으로 채운 배열이고 세 자원을 갖는다', () => {
    expect(RESOURCES.map((r) => r.type)).toEqual(['examples', 'exampleCategories', 'exampleTags'])
  })

  it('참조 자원은 쓰기가 불가하다', () => {
    expect(resourceByType('examples')?.writable).toBe(true)
    expect(resourceByType('exampleCategories')?.writable).toBe(false)
    expect(resourceByType('exampleTags')?.writable).toBe(false)
  })

  it('정렬 가능한 열은 sorts 에도 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const column of resource.columns.filter((c) => c.sortable)) {
        expect(resource.sorts).toContain(column.key)
      }
    }
  })

  it('화면 기본 연산자는 백엔드가 허용한 것 안에 있어야 한다', () => {
    for (const resource of RESOURCES) {
      for (const filter of resource.filters) {
        expect(filter.operators).toContain(filter.uiOperator)
      }
    }
  })

  it('examples 의 필터 키와 연산자가 백엔드 정책과 같다', () => {
    const examples = resourceByType('examples')!
    const policy = Object.fromEntries(examples.filters.map((f) => [f.key, [...f.operators].sort()]))
    expect(policy).toEqual({
      title: ['contains', 'exact'],
      status: ['exact', 'in'],
      score: ['exact', 'gt', 'gte', 'in', 'lt', 'lte'],
      'category.id': ['exact', 'in', 'isNull'],
      createdAt: ['exact', 'gt', 'gte', 'lt', 'lte'],
    })
  })

  it('선언이 동결돼 있다', () => {
    expect(Object.isFrozen(RESOURCES)).toBe(true)
    expect(() => {
      ;(RESOURCES[0] as { type: string }).type = 'x'
    }).toThrow()
  })
})
```

셋째 검사가 선언의 자기 정합성을 지킨다 — 열을 정렬 가능으로 표시했는데 백엔드가 그 필드로 정렬을 안 받으면 화면이 500 을 받는다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/resources`
Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: `define.ts` 를 구현한다**

`defineResource` 는 받은 객체를 깊게 동결해 돌려준다. **JSX 를 두지 않는다**(계층 위반). 자원 이름을 아는 것은 이 계층의 일이다.

- [ ] **Step 4: 세 자원을 선언한다**

**아래는 백엔드 소스에서 실측한 계약이다**(2026-09-12, FastAPI `app/models/example.py` + `app/schemas/example.py`). 기억으로 고치지 마라.

`example.ts` — `type: 'examples'`, `path: '/api/v1/examples'`, `writable: true`.

| 열 | kind | sortable |
| --- | --- | --- |
| `title` | text | 예 |
| `description` | text | 아니오 |
| `status` | badge | 예 |
| `score` | number | 예 |
| `category` | badge | 아니오 |
| `tags` | badges | 아니오 |
| `createdAt` | datetime | 예 |
| `updatedAt` | datetime | 예 |

| 필터 키 | 허용 연산자 | 화면 기본 |
| --- | --- | --- |
| `title` | `exact` · `contains` | `contains` |
| `status` | `exact` · `in` | `exact` |
| `score` | `exact` · `gt` · `gte` · `lt` · `lte` · `in` | `gte` |
| `category.id` | `exact` · `in` · `isNull` | `exact` |
| `createdAt` | `exact` · `gt` · `gte` · `lt` · `lte` | `gte` |

`sorts: ['title', 'status', 'score', 'createdAt', 'updatedAt']`, `includes: ['category', 'tags']`.

**`status` 의 와이어 값은 `draft` · `active` · `archived` 다**(`ExampleStatus` StrEnum). 화면 라벨과 혼동하지 마라 — 필터에 실리는 것은 이 값이다.

**관계 필터 키는 `category` 가 아니라 `category.id` 다.** 백엔드가 그렇게 선언했고, `category` 로 보내면 허용 목록에 없는 파라미터가 된다.

백엔드의 기본 정렬은 `createdAt` 내림차순이고 `id` 타이브레이커가 붙는다. 화면이 정렬을 지정하지 않으면 그 순서가 온다.

`category.ts` · `tag.ts` — `writable: false`, 열은 `name` 하나. **질의 정책은 둘이 동일하다**(실측 `app/schemas/example_category.py` · `example_tag.py`):

| | 값 |
| --- | --- |
| 필터 | `name` — `exact` · `contains` (화면 기본 `contains`) |
| 정렬 | `name` · `createdAt` |
| include | 없음 — `includes: []` 가 맞다 |
| 기본 정렬 | **`name` 오름차순** |

기본 정렬이 `examples` 의 `createdAt DESC` 와 다른 것은 의도된 것이다 — 백엔드 주석의 근거를 사실 문장으로 옮기면: **선택기는 알파벳순이 맞다. 참조 데이터를 최신순으로 고르지 않는다.** `createdAt` 은 곧 쓸 일이 없어도 백엔드 허용 목록에 있으므로 우리 선언에도 넣는다.

**같은 자원을 세 가지 이름으로 부른다 — 오타가 아니다**(실측: 형제의 `lib/resources/category.ts`·`tag.ts` 가 이 모양이다).

| | examples | 분류 | 라벨 |
| --- | --- | --- | --- |
| JSON:API `type` | `examples` | `exampleCategories` | `exampleTags` |
| HTTP 경로 | `/api/v1/examples` | `/api/v1/categories` | `/api/v1/tags` |
| SQL 테이블 (E2E 씨앗만 쓴다) | `examples` | `categories` | `tags` |

**맞추지 마라.** `type` 은 `included` 항목이 들고 오는 값이라, 틀리면 관계 해석이 조용히 빈손으로 끝난다 — 배지가 UUID 로 그려지거나 "분류 없음"이 되고, **둘 중 어느 증상이 나오는지는 백엔드마다 다르다.** 그래서 이름 오류가 아니라 일관성 없는 버그처럼 보인다.

- [ ] **Step 5: 살아있는 백엔드는 필요 없다**

Step 4 의 표는 백엔드 소스(`app/models/example.py` · `app/schemas/*.py`)에서 옮긴 것이라 **대조할 대상이 이미 계약 그 자체다.** 도커가 떠 있지 않아도 이 과업은 완결된다.

세 백엔드가 같은지는 Task 13 의 매트릭스가 재확인한다. 그때 다르면 계약 차이로 기록된다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/resources`
Expected: PASS

- [ ] **Step 7: `lib/resources/AGENTS.md` 를 쓰고 커밋**

"선언은 데이터다" 규칙과 새 자원을 더하는 세 단계(선언 파일 만들기 → `RESOURCES` 에 손으로 더하기 → 라우트 손으로 만들기)를 적는다. **자동 탐색을 쓰면 계약이 사라진다**는 사실과 그 이유를 함께 적는다.

```bash
git add -A
git commit -m "feat: declare the examples resource and its two reference resources

RESOURCES is a hand-maintained array: a resource absent from it does not
exist, which mirrors the backends' own explicit route composition. Auto
discovery would erase that contract. Attribute and relationship names were
read off a real response rather than recalled, because a wrong relationship
name renders badges as UUIDs on one backend and silently as 'no category' on
another."
```

---

### Task 7: `lib/grid` — URL ↔ JSON:API 질의 변환

**Files:**
- Create: `lib/grid/state.ts`, `lib/grid/query.ts`, `lib/grid/AGENTS.md`
- Test: `test/unit/grid/state.test.ts`, `test/unit/grid/query.test.ts`

**Interfaces:**
- Consumes: Task 6 의 `ResourceDef`
- Produces:

```ts
export interface GridState {
  readonly filters: Readonly<Record<string, string>>
  readonly sort: string | null
  readonly pageQuery: Readonly<Record<string, string>>
  readonly pageSize: number
  readonly hiddenColumns: readonly string[]
}

export const DEFAULT_PAGE_SIZE = 50
export function readGridState(params: URLSearchParams, resource: ResourceDef): GridState
export function writeGridState(state: GridState): URLSearchParams
export function gridQuery(resource: ResourceDef, state: GridState): Record<string, string>
```

- [ ] **Step 1: URL 읽기·쓰기의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_SIZE, readGridState, writeGridState } from '@/lib/grid/state'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('readGridState', () => {
  it('빈 URL 에서 기본값을 낸다', () => {
    const state = readGridState(new URLSearchParams(), EXAMPLES)
    expect(state).toEqual({
      filters: {},
      sort: null,
      pageQuery: {},
      pageSize: DEFAULT_PAGE_SIZE,
      hiddenColumns: [],
    })
  })

  it('선언에 없는 필터 키를 버린다', () => {
    const state = readGridState(new URLSearchParams('title=abc&bogus=1'), EXAMPLES)
    expect(state.filters).toEqual({ title: 'abc' })
  })

  it('선언에 없는 정렬을 버린다', () => {
    expect(readGridState(new URLSearchParams('sort=-updatedAt'), EXAMPLES).sort).toBe('-updatedAt')
    expect(readGridState(new URLSearchParams('sort=-bogus'), EXAMPLES).sort).toBeNull()
  })

  it('쪽당 건수를 100 으로 제한한다', () => {
    expect(readGridState(new URLSearchParams('pageSize=1000'), EXAMPLES).pageSize).toBe(100)
  })

  it('왕복해도 같은 상태다', () => {
    const params = new URLSearchParams('title=abc&status=active&sort=-updatedAt&hide=tags')
    const state = readGridState(params, EXAMPLES)
    expect(readGridState(writeGridState(state), EXAMPLES)).toEqual(state)
  })
})
```

`page[size]=1000` 을 세 백엔드 모두 최대 100 으로 제한한다 — 그 상한을 클라이언트가 먼저 지켜 두면 화면이 받는 값과 요청한 값이 갈리지 않는다.

- [ ] **Step 2: 질의 조립의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { gridQuery } from '@/lib/grid/query'
import { readGridState } from '@/lib/grid/state'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('gridQuery', () => {
  it('선언된 연산자로 필터를 조립하고 include 를 반드시 싣는다', () => {
    const state = readGridState(
      new URLSearchParams('title=abc&status=active&sort=-updatedAt'),
      EXAMPLES,
    )
    expect(gridQuery(EXAMPLES, state)).toEqual({
      'filter[title][contains]': 'abc',
      'filter[status][exact]': 'active',
      sort: '-updatedAt',
      'page[size]': '50',
      'page[totals]': 'true',
      include: 'category,tags',
    })
  })

  it('총합을 항상 요청한다 - 표가 전체 쪽 수를 계산해야 한다', () => {
    const state = readGridState(new URLSearchParams(), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['page[totals]']).toBe('true')
  })

  it('관계 필터는 점을 포함한 키를 그대로 쓴다', () => {
    const state = readGridState(new URLSearchParams('category.id=7c1f'), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['filter[category.id][exact]']).toBe('7c1f')
  })

  it('커서 질의를 해석하지 않고 그대로 전달한다', () => {
    const state = readGridState(new URLSearchParams('page%5Bafter%5D=opaque-token'), EXAMPLES)
    expect(gridQuery(EXAMPLES, state)['page[after]']).toBe('opaque-token')
  })

  it('숨긴 열은 질의에 영향을 주지 않는다', () => {
    const shown = gridQuery(EXAMPLES, readGridState(new URLSearchParams(), EXAMPLES))
    const hidden = gridQuery(EXAMPLES, readGridState(new URLSearchParams('hide=tags'), EXAMPLES))
    expect(hidden).toEqual(shown)
  })
})
```

첫째 검사의 `include` 가 중요하다 — **선언의 `includes` 는 "무엇을 include 할 수 있는가"이지 "무엇을 요청하는가"가 아니다.** 빼먹으면 백엔드마다 다른 증상이 난다: 정본은 linkage 만 주고 이름은 `included` 에만 있어 배지가 UUID 로 그려지고, NestJS 는 linkage 자체를 주지 않아 조용히 "분류 없음"이 된다.

셋째 검사는 숨긴 열이 **표시 상태일 뿐 질의가 아니라는** 경계를 고정한다.

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/grid`
Expected: FAIL — 모듈이 없다.

- [ ] **Step 4: 구현한다**

`state.ts` 와 `query.ts` 를 쓴다. **`lib/grid/` 에 자원 이름 문자열 리터럴을 두지 않는다**(계층 위반) — 전부 `ResourceDef` 에서 읽는다. **JSX 도 `fetch` 도 두지 않는다.**

**선언에 없는 키를 버리는 것은 스타일이 아니라 정확성이다.** 백엔드는 허용 목록 밖 쿼리 파라미터를 `400 INVALID_QUERY_PARAMETER` 로 거절한다(실측 `app/jsonapi/query.py:152,167`). 즉 URL 에 낯선 파라미터가 하나 섞이면 목록이 **비는 게 아니라 실패한다.** 인식되는 접두사는 `filter` · `sort` · `include` · `page` 넷이고, 우리가 내보내는 것은 그 안에 있다.

커서 값은 백엔드가 발급한 불투명한 값으로 다룬다. 페이지 이동은 응답 링크의 query 를 읽어 `pageQuery` 에 담아 그대로 전달하고, 프런트엔드가 커서 내용을 해석하지 않는다.

**총합은 opt-in 이라 명시적으로 요청해야 한다.** 실측(2026-09-12, `app/controllers/concerns/crud_actions.py:162,179-213`): `meta.totalCount` 와 null 이 아닌 `links.last` 는 **`page[totals]=true` 로만** 온다. 안 보내면 `meta` 에 `totalCount` 가 없고 `links.last` 는 null 이다(`next` 는 프로브 행 하나로 결정되므로 총합 없이도 앞뒤 이동은 된다).

그래서 `gridQuery` 는 목록 질의에 **항상 `page[totals]=true` 를 싣는다.** 표가 전체 쪽 수를 계산해야 하고(Task 8 의 `rowCount`), 화면이 "전체 N건"을 그린다.

**대가를 알고 받는다**: 매 쪽마다 백엔드가 `COUNT` 쿼리를 한 번 더 돈다. 백엔드가 이것을 opt-in 으로 둔 이유가 그 비용이다. 그 비용이 문제가 되는 배포는 이 플래그를 끄면 되고, 그때 잃는 것은 전체 쪽 수와 "전체 N건" 표시다 — 앞뒤 이동은 그대로 동작한다. 이 사실을 `lib/grid/AGENTS.md` 가 적는다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/grid`
Expected: PASS (8 tests)

- [ ] **Step 6: `lib/grid/AGENTS.md` 를 쓰고 커밋**

"자원을 모른다" 규칙과 그 위반의 정의를 적는다. 커서를 해석하지 않는 이유도 적는다.

```bash
git add -A
git commit -m "feat: convert URL state into JSON:API query parameters

lib/grid owns the URL-to-query conversion and nothing else: no JSX, no fetch,
no resource-name literals. Unknown filter keys and sorts are dropped against
the declaration, page size is clamped to the 100 the backends enforce, and
cursor values pass through opaquely.

gridQuery always sends include: the declaration says what may be included,
not what is requested, and omitting it fails differently on each backend —
UUID badges on one, a silent 'no category' on another."
```

---

### Task 8: 그리드를 서버 구동으로 전환한다

**Files:**
- Create: `lib/grid/table.ts`, `components/grid/resource-grid.tsx`
- Create: `app/(admin)/examples/page.tsx`, `app/(admin)/examples/loading.tsx`, `app/(admin)/examples/list.ts`
- Modify: `app/(admin)/components/data-table.tsx` (블록이 쓴 파일)
- Test: `test/unit/grid/table.test.ts`

**Interfaces:**
- Consumes: Task 7 의 `gridQuery`·`readGridState`, Task 6 의 `ResourceDef`, Task 2 의 `lib/jsonapi` 클라이언트
- Produces: `serverDrivenTableOptions(rowCount: number): { manualPagination: true; rowCount: number }`, `listRequest(resource, params, acceptLanguage)` — 화면이 부르는 **조립 함수 하나**

**설치된 것은 `@tanstack/react-table@9.2.4` 다**(실측). v9 에서 서버 사이드를 켜는 방법은 v8 과 다르므로 아래를 그대로 따른다.

| 무엇 | v9 에서의 방법 |
| --- | --- |
| 페이지 | `manualPagination: true` **와 `rowCount`**(서버 총합)를 함께 준다 |
| 정렬 | `sortedRowModel` 을 **등록하지 않는다** |
| 필터 | `filteredRowModel` 을 **등록하지 않는다** |

**`manualSorting` · `manualFiltering` 은 v9 에 없다.** 패키지 전체를 검색해 0건이다 — 주면 인식되지 않고 조용히 무시된다. 그 이름을 쓰면 우리 테스트는 초록이고 표는 계속 불러온 쪽 안에서 정렬한다.

`rowCount` 를 빼면 표가 전체 쪽 수를 계산할 수 없다. 값은 Task 9 가 실측한 메타 총합에서 온다.

패키지가 `node_modules/@tanstack/react-table/skills/with-tanstack-query/SKILL.md` 에 1차 가이드를 담고 있다 — 서버 사이드 표의 정본이니 읽어라. 그 문서가 명시하는 함정 하나: **질의 결과를 별도 state 로 복사하지 마라.** 우리 구조에서는 RSC 가 받은 행을 그대로 `data` 로 넘긴다.

- [ ] **Step 1: 서버 구동 옵션의 테스트를 쓴다**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { serverDrivenTableOptions } from '@/lib/grid/table'

const TABLE = 'app/(admin)/components/data-table.tsx'

describe('serverDrivenTableOptions', () => {
  it('페이지를 서버에 맡기고 총합을 함께 넘긴다', () => {
    expect(serverDrivenTableOptions(1284)).toEqual({ manualPagination: true, rowCount: 1284 })
  })

  it('v9 에 없는 옵션 이름을 만들어 내지 않는다', () => {
    const keys = Object.keys(serverDrivenTableOptions(0))
    expect(keys).not.toContain('manualSorting')
    expect(keys).not.toContain('manualFiltering')
  })
})

describe('DataTable 배선', () => {
  it('표가 serverDrivenTableOptions 를 실제로 펼쳐 넣는다', () => {
    expect(readFileSync(TABLE, 'utf8')).toMatch(/\.\.\.serverDrivenTableOptions\(/)
  })

  it('클라이언트 정렬·필터·페이지 행 모델을 등록하지 않는다', () => {
    const source = readFileSync(TABLE, 'utf8')
    expect(source).not.toMatch(/createSortedRowModel|createFilteredRowModel|createPaginatedRowModel/)
  })
})
```

마지막 둘이 **소스 텍스트를 읽는** 것은 의도다. 단위 테스트가 React 내부 옵션을 관측할 수 없고, **v9 에서는 행 모델을 등록하지 않는 것이 곧 서버 정렬이므로 그 부재가 계약이다.** 이 배선을 지우는 뮤턴트는 화면상 아무 증상을 내지 않는다 — 값이 그려지므로 목록 전체가 정렬된 것처럼 읽힌다. 실제 동작은 Task 13 의 E2E 가 쪽을 넘으며 잡는다.

둘째 검사는 내가 처음 이 계획에 쓴 잘못(`manualSorting`·`manualFiltering` 을 켜라)이 되살아나는 것을 막는다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/grid/table.test.ts`
Expected: FAIL — `lib/grid/table.ts` 가 없고, 블록의 `data-table.tsx` 는 세 행 모델을 등록한 채다.

- [ ] **Step 3: `lib/grid/table.ts` 를 구현한다**

`serverDrivenTableOptions(rowCount)` 하나를 내보낸다 — `{ manualPagination: true, rowCount }`. 다른 키를 더하지 마라. TanStack 소스에서 `manualPagination: true` 는 `createPaginatedRowModel` 등록을 생략한 것과 **같은 분기**로 처리되므로 페이지는 둘 중 어느 쪽으로도 끌 수 있지만, 정렬·필터는 **등록 생략만** 가능하다.

- [ ] **Step 4: 블록의 `data-table.tsx` 를 서버 구동으로 고친다**

`createFilteredRowModel()` · `createSortedRowModel()` · `createPaginatedRowModel()` 등록을 지우고 `...serverDrivenTableOptions(rowCount)` 를 넣는다. `rowCount` 는 서버가 준 총합이다 — 없으면 표가 전체 쪽 수를 계산할 수 없다. 컴포넌트 안의 `pagination` `useState`(`pageSize: 10`)를 지우고 페이지·정렬·필터 상태를 **URL 에서 받는다**. 행 선택과 열 표시/숨김은 TanStack 에 남긴다.

**dnd-kit 드래그 정렬은 손대지 않는다**(스펙 3.4.2). 서버에 순서가 없어 지속되지 않지만, 나중에 백엔드가 순서를 갖추면 배선만 하면 된다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/grid/table.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 목록 화면을 만든다 — 조립을 함수 하나로 모은다**

`app/(admin)/examples/list.ts` 에 `listRequest(resource, params, acceptLanguage)` 를 두고, `page.tsx` 는 그것 하나에 `searchParams` 와 `Accept-Language` 를 넘긴 뒤 결과를 그린다.

`searchParams` 정규화도 `list.ts` 가 갖는다 — 화면에 두면 그만큼이 관측 불가다.

```ts
// app/(admin)/examples/list.ts
export function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) params.append(key, one)
  }
  return params
}
```

```tsx
// app/(admin)/examples/page.tsx
export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resource = resourceByType('examples')!
  const document = await request(
    listRequest(
      resource,
      toSearchParams(await searchParams),
      (await headers()).get('accept-language'),
    ),
  )
  return <ResourceGrid resource={resource} document={document} />
}
```

`toSearchParams` 의 단위 테스트도 함께 쓴다 — 배열 값(`?status=a&status=b`)과 `undefined` 를 어떻게 다루는지가 필터 동작을 바꾼다.

**이 파일에는 fetch 와 JSX 만 둔다.** 판단이 여기 남으면 그만큼이 단위 테스트에서 관측 불가다 — `headers()` 가 요청 스코프를 요구해 vitest(node) 에서 던지고, 이 저장소는 그것을 스텁하지 않는 관례를 갖는다.

**조립을 함수 하나로 모으는 것이 핵심이다 — 다시 쪼개지 마라.** `gridQuery()`·`Accept-Language`·`resource.path` 를 각각 부르는 모양은 nextjs 에서 **그 셋을 지우는 뮤턴트가 전부 게이트 초록으로 살아남은** 자리다. 모아 두면 세 값이 단위의 `toEqual` 하나로 고정되고 화면에 남는 무방비는 한 줄이다.

- [ ] **Step 7: `Accept-Language` 전달을 재는 테스트를 더한다**

`listRequest` 를 직접 불러 조립 결과에 `accept-language` 헤더가 실리는지 단언한다. **화면이 그것을 넘기는가는 단위가 볼 수 없다** — 그 셋째 인자를 `null` 로 바꾸는 뮤턴트는 nextjs 에서 게이트 여덟 단계를 전부 통과했다. 가드는 Task 13 의 E2E 가 로케일 다른 컨텍스트 둘로 세운다.

- [ ] **Step 8: 스켈레톤을 만든다**

`app/(admin)/examples/loading.tsx` — **텍스트를 하나도 쓰지 않는다.** 열 수는 `resource.columns` 에서 가져온다(박으면 선언과 갈라진다).

- [ ] **Step 9: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -m "feat: drive the grid from the server instead of the loaded page

The block ships client-side filtering, sorting and pagination over static
JSON with pageSize in component state. Against a server-paginated list that
sorts only the rows already loaded while looking entirely correct, so the
the three client row models are removed and manualPagination is set with the
server's rowCount. manualSorting and manualFiltering do not exist in the
installed v9 — omitting the row models is what makes sorting server-side.

Unit tests assert the wiring by reading the source: a mutant that drops it
produces no visible symptom, so there is nothing else for a unit to observe.
The list screen holds only fetch and JSX, with query assembly collected into
one function — the split-out shape let three mutants survive the whole gate
in the family's repo."
```

---

### Task 9: 대시보드를 계약에 배선한다

**Files:**
- Modify: `app/(admin)/components/section-cards.tsx`, `app/(admin)/components/chart-area-interactive.tsx`, `app/(admin)/components/site-header.tsx`, `app/(admin)/page.tsx`
- Delete: `app/(admin)/data.json`
- Create: `lib/resources/count.ts`
- Test: `test/unit/resources/count.test.ts`

**Interfaces:**
- Consumes: Task 6 의 `RESOURCES`, Task 2 의 `lib/jsonapi`
- Produces: `countRequest(resource)` · `readTotal(document): number`

- [ ] **Step 1: 총합의 계약을 확인한다 — 이미 실측돼 있다**

백엔드 소스에서 읽은 계약이다(2026-09-12, `app/controllers/concerns/crud_actions.py:162,179-213`). **도커도 살아있는 백엔드도 필요 없다.**

- 키는 **`meta.totalCount`** 다.
- **`page[totals]=true` 를 보내야 온다.** 안 보내면 `meta` 에 없고 `links.last` 도 null 이다.
- `next` 링크는 프로브 행 하나로 결정되므로 총합 없이도 앞뒤 이동은 된다.

세 백엔드가 같은지는 Task 13 의 매트릭스가 재확인한다. 다르면 그때 계약 차이로 기록된다.

- [ ] **Step 2: 카운트 함수의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { countRequest, readTotal } from '@/lib/resources/count'
import { resourceByType } from '@/lib/resources'

const EXAMPLES = resourceByType('examples')!

describe('자원 카운트', () => {
  it('한 건만 받고 총합을 켜서 받는다', () => {
    const query = countRequest(EXAMPLES).query
    expect(query['page[size]']).toBe('1')
    expect(query['page[totals]']).toBe('true')
  })

  it('include 를 싣지 않는다', () => {
    expect(countRequest(EXAMPLES).query.include).toBeUndefined()
  })

  it('meta.totalCount 를 읽는다', () => {
    expect(readTotal({ data: [], meta: { totalCount: 1284 } })).toBe(1284)
  })

  it('총합이 없으면 던진다 - 조용히 0 을 그리지 않는다', () => {
    expect(() => readTotal({ data: [] })).toThrow()
    expect(() => readTotal({ data: [], meta: {} })).toThrow()
  })
})
```

첫째 검사의 `page[totals]` 가 없으면 `readTotal` 이 항상 던진다 — 총합은 opt-in 이다. 둘째 검사는 카운트가 관계까지 끌어오는 낭비를 막는다. 넷째 검사는 **조용히 0 을 그리지 않게** 한다 — `meta` 가 아예 없는 경우와 `meta` 는 있는데 키가 없는 경우를 둘 다 본다.

- [ ] **Step 3: 테스트를 돌려 실패를 확인하고 구현한다**

Run: `pnpm vitest run test/unit/resources/count.test.ts` → FAIL → 구현 → PASS (4 tests)

- [ ] **Step 4: 카드를 자원 카운트로 바꾼다**

`section-cards.tsx` 의 Total Revenue `$1,250.00` · New Customers · Active Accounts · Growth Rate 를 **`examples` · 분류 · 라벨의 실제 총합**으로 바꾼다. 카드 레이아웃과 타이포그래피는 건드리지 않는다. 참조 자원 카드에는 "읽기 전용"을 적는다.

- [ ] **Step 5: 차트를 남기되 표본임을 화면이 말하게 한다**

`chart-area-interactive.tsx` 의 `chartData` 배열은 **그대로 둔다**(스펙 3.4.1). 대신 카드에 **백엔드에 연결되지 않은 표본 데이터**임을 적는다 — 운영자가 이 숫자를 읽고 판단하면 안 된다는 것을 화면에서 알 수 있어야 한다. 이것이 차트를 남기는 조건이다.

- [ ] **Step 6: 표와 헤더를 바꾼다**

`app/(admin)/data.json`(68행 `reviewer: "Eddie Lake"`)을 지우고 대시보드의 표를 `examples` 최근 수정 목록으로 바꾼다. `site-header.tsx` 의 하드코딩된 `Documents` 를 화면 이름으로 바꾼다.

대시보드 표에 **변경한 사람 열을 두지 않는다** — 백엔드에 감사로그 계약이 없어 누가 바꿨는지 알 수 없다(스펙 2.3 · 10장). 수정일 내림차순 정렬이라는 사실을 표 아래에 한 줄로 적는다.

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -m "feat: wire the dashboard to the contract

Cards now read real totals via page[size]=1 and the meta key observed on a
live response rather than recalled; readTotal throws on a missing total so a
renamed key cannot render a silent zero. The block's 68-row reviewer dataset
is replaced by recent examples, and the header stops saying Documents.

The interactive chart keeps the block's own hardcoded array, and the card now
says on screen that it is sample data not connected to the backend — that
labelling is the condition for keeping it. The recent-changes table has no
'changed by' column because no audit log exists to fill one."
```

---

### Task 10: 상세와 생성 화면

**Files:**
- Create: `app/(admin)/examples/[id]/page.tsx`, `app/(admin)/examples/[id]/loading.tsx`, `app/(admin)/examples/[id]/detail.ts`, `app/(admin)/examples/[id]/edit-form.tsx`
- Create: `app/(admin)/examples/new/page.tsx`, `app/(admin)/examples/new/loading.tsx`, `app/(admin)/examples/actions.ts`
- Create: `lib/resources/form.ts`
- Test: `test/unit/resources/form.test.ts`

**Interfaces:**
- Consumes: Task 6 의 `ResourceDef`, Task 2 의 `lib/jsonapi` 오류 분류
- Produces: `fieldErrors(document): Record<string, string>` — JSON:API `errors[].source.pointer` → 필드 이름

- [ ] **Step 1: 필드 오류 매핑의 테스트를 쓴다**

**백엔드가 실제로 내는 포인터 어휘는 실측돼 있다**(2026-09-12). 기억으로 가정하지 마라.

| 출처 | 포인터 |
| --- | --- |
| Pydantic 검증 (`loc` 에서 `body` 를 뗀 것) | `/data/attributes/<필드>` |
| `relationship_resolver` | `/data/relationships/<이름>` · `/data/relationships/<이름>/data/<n>/id` · `.../type` |
| `document_parsing` · `crud_actions` | `/data` · `/data/id` · `/data/type` · `/data/relationships`(맨) |

그래서 **"마지막 세그먼트가 필드"가 아니다.** 규칙은 하나다 — `/data/attributes/…` 또는 `/data/relationships/…` 의 **네 번째 세그먼트**가 필드이고, 그것이 없으면 필드 오류가 아니다.

```ts
import { describe, expect, it } from 'vitest'
import { fieldErrors } from '@/lib/resources/form'

const err = (pointer: string | undefined, detail: string) => ({
  status: '422',
  detail,
  ...(pointer === undefined ? {} : { source: { pointer } }),
})

describe('fieldErrors', () => {
  it('속성 pointer 가 가리키는 필드에 백엔드 문구를 그대로 붙인다', () => {
    expect(
      fieldErrors({
        errors: [
          err('/data/attributes/title', '제목은 200자를 넘을 수 없습니다'),
          err('/data/attributes/status', '선언에 없는 상태 값입니다'),
        ],
      }),
    ).toEqual({
      title: '제목은 200자를 넘을 수 없습니다',
      status: '선언에 없는 상태 값입니다',
    })
  })

  it('관계 pointer 를 읽는다', () => {
    expect(fieldErrors({ errors: [err('/data/relationships/category', '없는 분류입니다')] })).toEqual(
      { category: '없는 분류입니다' },
    )
  })

  it('관계 항목까지 내려간 깊은 pointer 도 그 관계에 붙인다', () => {
    expect(
      fieldErrors({ errors: [err('/data/relationships/tags/data/0/id', '없는 라벨입니다')] }),
    ).toEqual({ tags: '없는 라벨입니다' })
  })

  it.each(['/data', '/data/id', '/data/type', '/data/relationships'])(
    '%s 는 필드 오류가 아니다',
    (pointer) => {
      expect(fieldErrors({ errors: [err(pointer, '문서 오류')] })).toEqual({})
    },
  )

  it('pointer 가 없는 오류는 필드에 붙이지 않는다', () => {
    expect(fieldErrors({ errors: [err(undefined, '서버 오류')] })).toEqual({})
  })

  it('같은 필드에 여럿이면 첫 것을 남긴다', () => {
    expect(
      fieldErrors({
        errors: [
          err('/data/relationships/tags/data/0/id', '첫 번째'),
          err('/data/relationships/tags/data/1/id', '두 번째'),
        ],
      }),
    ).toEqual({ tags: '첫 번째' })
  })
})
```

마지막 검사가 정하는 것: 관계 배열의 여러 항목이 각각 실패하면 같은 필드로 접힌다. **첫 것을 남긴다** — 순서는 백엔드가 정하고, 화면은 필드 하나에 메시지 하나를 붙인다. 전부 보여야 하는 자리가 생기면 그때 `string[]` 로 바꾼다.

`/data/relationships` 가 맨으로 오는 경우가 실제로 있다는 점에 주의한다 — 네 번째 세그먼트가 없으므로 필드 오류가 아니고, 배너로 간다.

**문구를 만들지 않는다** — 오류 문구의 정본은 백엔드이고 `Accept-Language` 로 협상된 것이다(스펙 6.3).

- [ ] **Step 2: 테스트를 돌려 실패를 확인하고 구현한다**

Run: `pnpm vitest run test/unit/resources/form.test.ts` → FAIL → 구현 → PASS (3 tests)

- [ ] **Step 3: 상세 화면을 만든다**

`detail.ts` 에 `detailRequest(resource, id, acceptLanguage)` 를 두고 `page.tsx` 는 그것 하나에 넘긴다(Task 8 과 같은 모양). 속성·관계·메타를 그린다. 관계 이름을 보이려면 `include=category,tags` 가 실려야 한다.

인라인 편집은 **저장이 취소와 다른 일을 하게** 만든다 — 저장은 `PATCH` 요청 하나를 보내고 제출 중에는 스피너만 남긴다.

- [ ] **Step 4: 생성 화면과 Server Action 을 만든다**

`actions.ts` 에 생성·수정·삭제 Server Action 을 둔다. 실패하면 `fieldErrors` 로 필드에 붙이고 배너에 요약을 낸다. 성공하면 만들어진 자원의 상세로 이동한다.

- [ ] **Step 5: 스켈레톤 둘을 만든다**

`[id]/loading.tsx` 와 `new/loading.tsx` — **텍스트 없이** 스켈레톤만.

- [ ] **Step 6: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -m "feat: add the detail and create screens

Field errors come from the backend's JSON:API errors: fieldErrors maps
source.pointer onto attribute and relationship names and attaches the
backend's own detail text. The frontend writes no failure wording, because
the backend negotiates it from Accept-Language.

Save is not wired to the same handler as Cancel — it sends one PATCH and
shows a spinner while it does."
```

---

### Task 11: `lib/bulk` — 순차 실행기

**Files:**
- Create: `lib/bulk/executor.ts`, `lib/bulk/AGENTS.md`
- Test: `test/unit/bulk/executor.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:

```ts
export const MAX_BULK_ITEMS = 50

export interface BulkOutcome {
  readonly id: string
  readonly ok: boolean
  readonly status?: string
  readonly detail?: string
}

export interface BulkReport {
  readonly outcomes: readonly BulkOutcome[]
  readonly cancelled: boolean
}

export async function runBulk(
  ids: readonly string[],
  run: (id: string) => Promise<BulkOutcome>,
  options?: { signal?: AbortSignal; onProgress?: (done: number) => void },
): Promise<BulkReport>
```

- [ ] **Step 1: 실행기의 테스트를 쓴다**

```ts
import { describe, expect, it, vi } from 'vitest'
import { MAX_BULK_ITEMS, runBulk } from '@/lib/bulk/executor'

const ok = (id: string) => ({ id, ok: true })
// 실측된 실패 모양이다: 삭제는 성공하면 204, 그 행이 이미 없으면 404.
// 백엔드는 삭제에 422 를 내지 않는다 - 참조 무결성 거절 경로가 없다.
const gone = (id: string) => ({ id, ok: false, status: '404', detail: '그 자원을 찾을 수 없습니다' })

describe('runBulk', () => {
  it('선언된 순서대로 하나씩 보낸다', async () => {
    const seen: string[] = []
    await runBulk(['a', 'b', 'c'], async (id) => {
      seen.push(id)
      return ok(id)
    })
    expect(seen).toEqual(['a', 'b', 'c'])
  })

  it('동시에 보내지 않는다', async () => {
    let inFlight = 0
    let peak = 0
    await runBulk(['a', 'b', 'c'], async (id) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return ok(id)
    })
    expect(peak).toBe(1)
  })

  it('상한을 넘으면 요청을 하나도 보내지 않고 던진다', async () => {
    const run = vi.fn()
    const tooMany = Array.from({ length: MAX_BULK_ITEMS + 1 }, (_, i) => String(i))
    await expect(runBulk(tooMany, run)).rejects.toThrow(String(MAX_BULK_ITEMS))
    expect(run).not.toHaveBeenCalled()
  })

  it('일부가 실패해도 남은 것을 계속 보내고 행별로 모은다', async () => {
    const report = await runBulk(['a', 'b', 'c'], async (id) =>
      id === 'b' ? gone(id) : ok(id),
    )
    expect(report.outcomes.map((o) => o.ok)).toEqual([true, false, true])
    expect(report.outcomes[1]!.status).toBe('404')
    expect(report.cancelled).toBe(false)
  })

  it('취소하면 남은 요청을 내지 않고, 이미 보낸 결과는 남는다', async () => {
    const controller = new AbortController()
    const run = vi.fn(async (id: string) => {
      if (id === 'b') controller.abort()
      return ok(id)
    })
    const report = await runBulk(['a', 'b', 'c'], run, { signal: controller.signal })
    expect(run).toHaveBeenCalledTimes(2)
    expect(report.cancelled).toBe(true)
    expect(report.outcomes).toHaveLength(2)
  })

  it('진행을 건별로 알린다', async () => {
    const onProgress = vi.fn()
    await runBulk(['a', 'b'], async (id) => ok(id), { onProgress })
    expect(onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2])
  })
})
```

셋째 검사가 스펙 6.2 의 상한을, 넷째가 6.3 의 "부분 실패는 1급 결과"를, 다섯째가 6.4 의 "남은 요청을 내지 않는다 · 되돌리지 않는다"를 고정한다. **보상 트랜잭션을 만들지 않는다** — 백엔드 계약이 없다.

**픽스처의 상태 코드를 지어내지 마라.** 실측된 삭제 계약은 성공 204, 이미 없는 행 404 이고, **422 는 없다**(`example_tags` 가 `ondelete="CASCADE"` 라 참조 때문에 거절되는 경로가 아예 없다). 실행 중 세션이 만료되면 401 도 온다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `pnpm vitest run test/unit/bulk`
Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: 구현한다**

`MAX_BULK_ITEMS = 50` 을 **선언된 자리 하나**에 둔다. `lib/bulk/` 에 JSX 도 자원 이름 분기도 두지 않는다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `pnpm vitest run test/unit/bulk`
Expected: PASS (6 tests)

- [ ] **Step 5: `lib/bulk/AGENTS.md` 를 쓰고 커밋**

벌크 엔드포인트가 없다는 사실과 그것이 정하는 것 셋(순차·상한, 부분 실패가 정상 경로, 취소는 남은 요청만 막는다)을 적는다.

```bash
git add -A
git commit -m "feat: add the sequential bulk executor

No bulk, batch or atomic:operations route exists in the backend contract, so
deleting twelve rows is twelve DELETE requests. The executor sends them one
at a time under a declared cap of 50, keeps going when one fails, and
collects a per-row outcome: three of twelve failing is the normal path, not an
exception. The failure that actually happens is 404 — the row was already gone,
because two operators share one grid and lists go stale. The backend has no
referential refusal on delete, so a 422 fixture would have been invented.

Cancelling stops sending and does not undo what was already sent — there is
no compensating route to call, and pretending otherwise would be a lie in the
UI."
```

---

### Task 12: 일괄 작업 UI

**Files:**
- Create: `components/grid/selection-bar.tsx`, `components/grid/bulk-confirm.tsx`, `components/grid/bulk-result.tsx`
- Modify: `app/(admin)/examples/actions.ts`, `components/grid/resource-grid.tsx`
- Test: `test/unit/components/bulk-result.test.ts`

**Interfaces:**
- Consumes: Task 11 의 `runBulk`·`MAX_BULK_ITEMS`·`BulkReport`, Task 8 의 행 선택 상태
- Produces: 선택 바 · 확인 줄 · 결과 표. `components/grid/*` 에 **자원 이름 분기를 두지 않는다**

- [ ] **Step 1: 결과 표의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from '@/components/grid/bulk-result'

describe('summarize', () => {
  it('성공과 실패를 따로 센다', () => {
    const report = {
      outcomes: [
        { id: 'a', ok: true },
        { id: 'b', ok: false, status: '404', detail: 'x' },
        { id: 'c', ok: true },
      ],
      cancelled: false,
    }
    expect(summarize(report)).toEqual({ ok: 2, failed: 1, retryable: ['b'], cancelled: false })
  })

  it('재시도 대상은 실패한 것만이다', () => {
    const report = {
      outcomes: [
        { id: 'a', ok: true },
        { id: 'b', ok: false, status: '401', detail: 'y' },
      ],
      cancelled: false,
    }
    expect(summarize(report).retryable).toEqual(['b'])
  })

  it('전건 성공이면 재시도 대상이 없다', () => {
    expect(summarize({ outcomes: [{ id: 'a', ok: true }], cancelled: false }).retryable).toEqual([])
  })
})
```

둘째 검사가 "성공한 건은 다시 보내지 않는다"를 고정한다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인하고 `summarize` 를 구현한다**

Run: `pnpm vitest run test/unit/components/bulk-result.test.ts` → FAIL → 구현 → PASS (3 tests)

- [ ] **Step 3: 선택 바를 만든다**

선택이 하나 이상일 때만 나타난다. 선택 건수와 **나갈 요청 수**를 적고, `MAX_BULK_ITEMS` 를 **읽어** 상한을 함께 알린다(값을 박지 않는다).

- [ ] **Step 4: 확인 줄을 만든다**

삭제를 누르면 실행 전에 "벌크 엔드포인트가 없어 DELETE 요청 N 회를 순차로 보낸다 · 일부만 실패할 수 있다 · 이미 보낸 요청은 되돌리지 않는다"를 알린다. **누르기 전에 알리는 것이 스펙 6.2 의 요구다.**

- [ ] **Step 5: 결과 표를 만든다**

**토스트로 뭉개지 않는다.** 행별 성공·실패를 표로 내고, 실패 이유는 백엔드가 준 `status` 와 `detail` 을 그대로 쓴다. 실패한 행만 재시도하는 버튼을 둔다. 진행 중에는 **텍스트 없이** 스피너와 진행률만 둔다(진행 카운트 `7 / 12` 는 데이터이므로 허용).

`sonner` 가 블록과 함께 들어왔지만 **부분 실패에는 쓰지 않는다.**

- [ ] **Step 6: Server Action 을 배선한다**

`actions.ts` 에 일괄 삭제 Action 을 더하고 `runBulk` 로 실행한다. 각 건은 `DELETE /api/v1/examples/{id}` 한 번이다.

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -m "feat: make partial failure a first-class bulk result

The selection bar reads MAX_BULK_ITEMS rather than restating it and says how
many requests a bulk action will send before it is pressed. Failures land in
a per-row result table carrying the backend's own status and detail, with a
retry that resends only the rows that failed.

sonner arrived with the block but is deliberately not used here: a toast
collapses twelve outcomes into one line, and three of twelve failing is the
normal path."
```

---

### Task 13: 실제 백엔드 E2E 와 게이트 완성

**Files:**
- Create: `docker-compose.e2e.yml`, `Dockerfile`, `.dockerignore`, `playwright.config.ts`
- Create: `test/e2e/{stack.ts,matrix.ts,fixtures.ts,probe-email.ts}`, `test/e2e/seed/examples.sql`
- Create: `test/e2e/{auth.spec.ts,examples.spec.ts,bulk.spec.ts}`
- Modify: `scripts/check.sh`, `package.json`
- Test: `test/unit/e2e/matrix.test.ts`, `test/unit/e2e/probe-email.test.ts`

**Interfaces:**
- Consumes: Task 5 의 `provisionOperator`, Task 1 의 게이트
- Produces: `pnpm test:e2e`. 게이트 `[8/9] compose` · `[9/9] e2e`. `reportKnownDivergences()` — 매 실행 건수를 출력한다

- [ ] **Step 1: 백엔드 갈래 검증의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { resolveBackendKind } from '@/test/e2e/matrix'

describe('resolveBackendKind', () => {
  it('셋을 받는다', () => {
    expect(['fastapi', 'nestjs', 'rails'].map(resolveBackendKind)).toEqual([
      'fastapi',
      'nestjs',
      'rails',
    ])
  })

  it('기본은 정본이다', () => {
    expect(resolveBackendKind(undefined)).toBe('fastapi')
  })

  it('셋 밖의 값은 도커를 건드리기 전에 던진다', () => {
    expect(() => resolveBackendKind('fastpai')).toThrow(/fastapi/)
  })
})
```

셋째 검사가 없으면 **오타 하나가 백엔드 없이 뜬 부분 스택 위의 실행을 초록으로 만든다.**

- [ ] **Step 2: 이메일 상한의 테스트를 쓴다**

```ts
import { describe, expect, it } from 'vitest'
import { probeEmail } from '@/test/e2e/probe-email'

describe('probeEmail', () => {
  it('로컬 파트가 64자를 넘지 않는다', () => {
    const email = probeEmail('bulk-partial-failure-scenario-with-a-long-name')
    expect(email.split('@')[0]!.length).toBeLessThanOrEqual(64)
  })

  it('호출마다 다르다', () => {
    expect(probeEmail('x')).not.toBe(probeEmail('x'))
  })
})
```

둘째 검사가 중요하다 — **중복 가입은 409 라 재실행이 조용히 다른 갈래를 탄다.**

- [ ] **Step 3: 테스트를 돌려 실패를 확인하고 둘을 구현한다**

Run: `pnpm vitest run test/unit/e2e` → FAIL → 구현 → PASS (5 tests)

- [ ] **Step 4: compose 스택을 만든다**

Postgres · Redis · 마이그레이션 · 씨앗 데이터 · 백엔드 하나 · 이 앱의 **프로덕션 빌드**를 띄운다.

**정본은 `template-typescript-nextjs@34d0b10` 의 `docker-compose.e2e.yml` 이다**(502행, 근거가 주석에 있다). 그 파일을 읽고 구조를 그대로 미러링한다 — 아래는 반드시 지켜야 하는 계약만 적은 것이다.

**미리 빌드된 이미지는 없다**(실측 2026-09-12: 세 백엔드의 ghcr 패키지가 존재하지 않는다). Docker 가 **git URL 을 build context 로** 받아 백엔드를 직접 빌드한다.

```yaml
# 백엔드마다 migrate-* · api-* · seed-* 세 서비스를 두고 profiles 로 가른다.
# db(postgres:18-alpine) 와 redis(redis:8-alpine) 는 셋이 공유한다.

  api-rails:
    profiles: [rails]
    build:
      context: https://github.com/builder-shin/template-ruby-rails.git#main
      # target 을 지정하지 않으면 Dockerfile 의 마지막 스테이지가 잡힌다.
      target: development
    networks:
      default:
        aliases: [api] # ← 세 api-* 가 모두 이 별칭을 갖는다
    ports:
      - target: 4000
        published: ${E2E_API_PORT:-4100}

  web:
    build:
      context: .
      target: runtime
    environment:
      # 세 갈래에서 이 값이 똑같다 - 갈아끼우면서 고치는 값이 하나도 없다.
      BACKEND_URL: http://api:4000
    ports:
      - target: 3000
        published: ${E2E_WEB_PORT:-3000}
```

지켜야 할 것 넷:

1. **별칭이 셋 다 `api` 인 것이 이 설계의 전부다** — `web` 의 `BACKEND_URL` 이 갈래와 무관하게 같아지고, 그래서 "전환은 `BACKEND_URL` 하나"라는 계약이 E2E 에서도 참이 된다.
2. **`E2E_API_PORT` 기본값은 4000 이 아니라 4100 이다** — 컨테이너 안의 포트 4000(`BACKEND_URL` 이 가리키는 그 포트)과 호스트 공개 포트를 헷갈리지 않게 일부러 다르게 뒀다.
3. **Rails 는 `target: development` 가 필수다.** 정본 파일의 주석이 그 이유를 갖는다.
4. 각 백엔드의 환경 변수·의존 관계·헬스체크는 **정본 파일에서 그대로 옮긴다.** 기억으로 쓰면 갈래마다 다르게 깨진다.

마이그레이션 뒤 `test/e2e/seed/examples.sql` 을 넣는 `seed-*` 서비스도 profile 마다 하나씩 둔다.

- [ ] **Step 5: E2E 픽스처의 가드를 만든다**

`test/e2e/fixtures.ts` — 브라우저 콘솔 오류·경고와 **선언하지 않은** 4xx·5xx 응답을 실패로 만든다. 의도한 실패는 `consoleGuard.expectHttpFailure()` 로 그 테스트 안에 밝힌다.

운영자 프로비저닝은 **Task 5 의 `provisionOperator` 를 부른다.** 어드민에 공개 표면이 없어 어떤 화면에든 닿으려면 운영자가 먼저 있어야 하고, `/register` 화면이 없으므로 백엔드 계약에 직접 만든다. **그래서 시드 절차가 문서에만 있는 죽은 절차가 되지 않는다.**

- [ ] **Step 6: 인증 시나리오를 쓴다**

가입(프로비저닝) · 로그인 · 로그아웃, **보호 경로 복귀**(`/examples` → `/login?next=%2Fexamples` → 로그인 → `/examples`), access 갱신과 쿠키 수명.

**픽스처에 실전 상수와 같은 값을 쓰지 마라** — 복귀 경로로 기본 복귀 경로와 같은 값을 쓰면 복귀가 되든 안 되든 결과가 같다.

- [ ] **Step 7: 목록 시나리오를 쓴다 — 서버 정렬을 실제로 잰다**

Task 8 이 소스 텍스트로만 지킨 것을 여기서 동작으로 잡는다.

- 씨앗 데이터가 **두 쪽 이상**이 되게 넣고, 정렬을 바꾼 뒤 **첫 쪽의 첫 행이 전체의 극값**인지 단언한다. 클라이언트 정렬이면 불러온 쪽 안에서만 바뀌므로 이 단언이 깨진다.
- 쪽을 넘긴 뒤에도 정렬이 유지되는지 본다.

**목록을 재는 시나리오는 자기 것만 보도록 좁힌다** — `filter[title][contains]=<내 접두사>`. 자기 접두사를 쓰고 남의 접두사는 쓰지 않는다. 좁힐 수 없는 자리(필터가 사라졌다를 보이는 테스트)는 행 단언을 자기 접두사로 걸러서 하고 시작 주소에 넉넉한 `page[size]` 를 얹는다.

- [ ] **Step 8: 다국어 오류를 잰다**

로케일이 다른 컨텍스트 둘로 오류 배너를 띄우고 **영어 쪽에 한글이 없는지** 본다. **한국어 쪽만 단언하면 배선을 지워도 통과한다** — 헤더가 빠지면 백엔드가 `ko` 로 떨어진다. 이것이 Task 8 Step 7 이 예고한 가드다.

- [ ] **Step 9: 일괄 작업 시나리오를 쓴다**

행 여럿을 골라 삭제를 실행하고 **행별 결과 표**가 나오는지, 실패가 섞였을 때 **실패한 것만 재시도**되는지, 취소가 남은 요청을 막는지 본다.

**부분 실패를 만드는 방법은 404 다.** 삭제가 422 로 거절되는 상태는 이 백엔드에 존재하지 않는다(실측: `destroy` 는 성공 204, 없는 행 404 이고 `example_tags` 가 CASCADE 다). 대신 **목록을 그린 뒤 그 행 하나를 HTTP 로 직접 지우고** 화면에서 일괄 삭제를 실행한다 — 그러면 그 행만 404 로 죽는다. 이것이 운영에서 실제로 일어나는 모양이기도 하다: 운영자 둘이 같은 그리드를 보고, 목록이 낡는다.

- [ ] **Step 10: 알려진 차이 보고를 만든다**

`reportKnownDivergences()` 가 **매 실행 건수를 출력**한다 — 0 건이어도 출력한다. **침묵은 "안 돌았다"와 구별되지 않는다.** 다음 드리프트를 `test.fail(조건, 이유)` 로 어떻게 무는지를 `matrix.ts` 의 주석에 남긴다: 드리프트가 그대로면 CI 는 초록이고, 백엔드가 고쳐져 테스트가 실제로 통과해 버리면 그 자리에서 죽는다.

- [ ] **Step 11: 게이트를 아홉 단계로 완성한다**

```bash
echo "=== [8/9] compose ==="; pnpm compose:verify
echo "=== [9/9] e2e ==="; pnpm test:e2e
```

`package.json` 에 더한다.

```json
"test:e2e": "playwright test",
"compose:verify": "docker compose --profile fastapi --profile nestjs --profile rails -f docker-compose.e2e.yml config --quiet"
```

**로컬 게이트는 정본 FastAPI 하나로만 돈다** — 매번 세 스택을 띄우면 게이트가 개발 흐름을 막는다. 3-백엔드 매트릭스는 Task 14 의 CI 전용이다.

- [ ] **Step 12: 세 갈래를 손으로 한 번씩 돌린다**

```bash
for kind in fastapi nestjs rails; do
  COMPOSE_PROFILES="$kind" docker compose -f docker-compose.e2e.yml build --pull "api-$kind" "migrate-$kind"
  BACKEND_KIND="$kind" pnpm test:e2e
done
```

`pnpm test:e2e` 는 web 이미지를 매번 빌드하지만 **백엔드 이미지는 이미 있으면 재사용한다** — 그래서 먼저 빌드한다. 남긴 스택을 내릴 때는 **세 프로파일을 다 준다**(띄울 때 쓴 프로파일만 주고 내리면 다른 프로파일의 컨테이너가 남는다).

각 갈래의 통과 건수와 백엔드 커밋을 적어 둔다 — Task 14 의 README 표가 그 값을 쓴다.

- [ ] **Step 13: 게이트를 돌리고 커밋**

Run: `./scripts/check.sh`
Expected: 아홉 단계 전부 통과.

```bash
git add -A
git commit -m "feat: verify against real backends and complete the gate

E2E runs with no mocking against a Compose stack of Postgres, Redis,
migrations, seed data, one backend and this app's production build. All three
api services share the network alias api, so BACKEND_URL is identical across
the three branches and nothing needs editing to switch.

The list scenario measures what Task 8 could only assert by reading source:
with more than one page of seed rows, changing the sort must put the global
extreme in the first row — client-side sorting would only reorder the loaded
page and fail that. The multilingual assertion checks the English context for
absence of Korean, because asserting the Korean side passes even with the
header wiring removed.

Operators are provisioned through the same function the seed script uses, so
the documented procedure runs on every E2E execution. reportKnownDivergences
prints its count even when it is zero: silence is indistinguishable from not
having run."
```

---

### Task 14: 문서와 3-백엔드 CI 매트릭스

**Files:**
- Create: `AGENTS.md`, `README.md`
- Create: `app/AGENTS.md`, `components/AGENTS.md`, `lib/AGENTS.md`, `test/AGENTS.md`, `scripts/AGENTS.md`, `docs/AGENTS.md`, `.github/AGENTS.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 앞의 모든 과업
- Produces: 스펙 8.4 의 성공 기준을 만족하는 저장소

- [ ] **Step 0: 루트 `AGENTS.md` 에 이미 있는 블록을 지우지 마라**

`next dev` 가 `AGENTS.md` 의 `<!-- BEGIN:nextjs-agent-rules -->` ~ `<!-- END:nextjs-agent-rules -->` 블록을 **스스로 쓰고 다시 붙인다**(실측: Task 5 의 연기 확인에서 `next dev` 를 돌리자 루트에 `AGENTS.md` 와 `@AGENTS.md` 한 줄만 담은 `CLAUDE.md` 가 생겼다). 생성 주체는 `node_modules/next/dist/server/lib/generate-agent-files.js` 다.

**지우면 다음 `next dev` 가 다시 만들어 트리가 더러워진다** — 블록 자신이 그렇게 경고한다. 계층 계약은 그 블록 **위에** 쓰고, 블록은 파일 끝에 그대로 남긴다. 형제 저장소의 `AGENTS.md` 도 같은 모양이다.

`CLAUDE.md` 는 그 한 줄(`@AGENTS.md`)만 유지한다 — 내용을 복제하지 마라.

- [ ] **Step 1: 루트 `AGENTS.md` 를 쓴다 — 계층 계약의 정본**

스펙 4장의 소유권 표와 **위반의 정의**를 적는다. 표는 **소유 관계이지 파일 목록이 아니다** — 어떤 위치가 비어 있어도 그 행의 계약은 이미 유효하다. 어느 파일이 실재하는지는 저장소를 보면 되므로 적지 않는다(적어 두면 그 목록이 드리프트하고, 읽는 사람은 표가 아니라 그 목록을 믿는다).

반드시 함께 적을 것 다섯:

1. **사라질 자리를 인용하지 마라** — 게이트 `[5/9]` 가 강제한다. 근거는 사실 문장으로 적고, 문서가 필요하면 `docs/superpowers/` 를 가리킨다.
2. **`(admin)` 안에서 `min-h-svh` 를 쓰지 마라** — 높이는 셸이 갖는다.
3. **화면 껍데기를 `app/layout.tsx` 에 두지 마라** — 그 자리는 모든 그룹을 덮는다.
4. **라우트 파일을 옮기거나 지운 뒤 게이트가 `TS2307` 로 죽으면 `rm -rf .next`** — `.next/dev` 만 지우면 안 되고, 빌드만 돌려서는 안 보이고 `[1/9]` 에서만 드러난다.
5. **`shadcn add` 를 다시 돌리면 `table.tsx`·`label.tsx` 에 `'use client'` 가 되살아난다** — 되살아난 것을 보면 다시 뺀다.

   **판별 기준은 "로컬 훅이 없다"가 아니라 "상호작용 프리미티브에 의존하지 않는다"다.** 실측(2026-09-12)으로 갈린다:

   | 부품 | import | 지시어 |
   | --- | --- | --- |
   | `table` · `label` | `react`(타입) · `cn` 뿐 | **뺀다** |
   | `avatar` · `separator` · `toggle` · `tooltip` | `@base-ui/react/*` 프리미티브 | **남긴다** |

   넷도 파일 자체에는 훅·핸들러·브라우저 API 가 0건이라 "로컬 훅" 기준만 보면 뺄 대상처럼 보인다. 그런데 **프리미티브가 이미 클라이언트 컴포넌트라 import 경로로 경계가 생긴다** — 지시어를 떼도 번들 경계는 그대로이고 레지스트리와만 갈라진다. 이득 없이 드리프트만 늘린다.

- [ ] **Step 2: dnd-kit 의 사실을 적는다**

`AGENTS.md` 에 **드래그로 옮긴 순서는 서버에 남지 않고 새로고침하면 사라진다**는 사실과 그 이유(백엔드에 정렬 수서 필드도 재정렬 엔드포인트도 없다)를 적는다. **적지 않으면 다음 사람이 "드래그가 저장 안 되는 버그"로 읽고 없는 엔드포인트를 찾는다**(스펙 3.4.2).

차트가 표본 데이터라는 사실도 같은 자리에 적는다(스펙 3.4.1).

- [ ] **Step 3: 하위 `AGENTS.md` 를 쓴다**

| 경로 | 소유하는 로컬 계약 |
| --- | --- |
| `lib/jsonapi/AGENTS.md` | "자원을 모른다" 규칙과 그 위반의 정의 |
| `lib/resources/AGENTS.md` | "선언은 데이터다" 규칙과 새 자원을 더하는 절차 (Task 6 이 만들었다) |
| `lib/grid/AGENTS.md` | URL ↔ 질의 경계, 커서를 해석하지 않는 이유 (Task 7 이 만들었다) |
| `lib/bulk/AGENTS.md` | 벌크 엔드포인트가 없다는 사실이 정하는 것 셋 (Task 11 이 만들었다) |
| `app/AGENTS.md` | "`fetch` 를 직접 하지 않는다" 규칙과 조립 함수를 다시 쪼개지 말라는 근거 |
| `components/AGENTS.md` | 자원 이름으로 분기하지 않는다, 레지스트리 부품의 `'use client'` 정책과 **그 판별 기준** |
| `hooks/AGENTS.md` | `shadcn add` 가 넣은 훅의 자리 |
| `test/AGENTS.md` | E2E 가 지키는 자리와 새 시나리오의 규칙 셋(실전 상수 금지 · 고유 이메일 · 자기 접두사로 좁히기) |
| `scripts/AGENTS.md` | 단일 게이트 · 인용 검사 · 출처 검사 |
| `docs/AGENTS.md` | 커밋되는 설계·계획·실측 기록 |
| `.github/AGENTS.md` | CI 워크플로 설정 |

- [ ] **Step 4: `README.md` 를 쓴다**

들어 있는 것 · 시작하기 · **환경 변수 표 둘**(앱이 읽는 둘, E2E 만 읽는 다섯) · 화면 표 · **첫 운영자 시드 절차** · 백엔드 전환 · 검증 · Task 13 Step 12 에서 적은 3-백엔드 검증 결과 표.

**필수 변수에 암묵적 기본값을 두지 않는다**는 계약과 그 이유(첫 요청에서야 드러나는 설정 오류보다 시작 실패가 낫다)를 적는다.

- [ ] **Step 5: CI 매트릭스를 만든다**

`.github/workflows/ci.yml` — 세 갈래를 `fail-fast: false` 로 실행하고, 각 실행에서 **알려진 차이와 이유를 출력**한다. `CI` 환경 변수가 설정되므로 `forbidOnly` 가 켜져 `test.only` 가 남은 실행이 실패한다.

`pnpm exec playwright install chromium` 을 넣는다 — **의존성 설치에 딸려 오지 않는다.**

- [ ] **Step 6: 성공 기준을 하나씩 확인한다**

스펙 8.4 를 순서대로 짚는다.

1. `./scripts/check.sh` 아홉 단계 전부 초록
2. 세 백엔드 각각에서 E2E 통과
3. 알려진 차이 0 건이고 **0 건이 매 실행 출력된다**
4. 화면 다섯이 전부 있고, `/login` 밖의 넷이 익명 접근에서 `/login?next=<원래 경로>` 로 보내진다
5. 일괄 작업이 부분 실패를 행별로 내고 실패한 행만 재시도된다

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -m "docs: write the layer contracts and wire the three-backend CI matrix

AGENTS.md owns the layer ownership table and the definition of a violation.
It also records two things that are invisible in the code: drag reordering
does not persist because the backend has no order column or reorder route,
and the dashboard chart is sample data not connected to the backend. Without
those lines the next person reads the first as a save bug and hunts for an
endpoint that does not exist.

CI runs the three branches with fail-fast disabled and prints the known
divergence count on every run. The local gate stays on the canonical backend:
bringing up three stacks on every check would block development."
```

---

## 실행 순서와 의존

Task 1 → 2 → 3 → 4 → 5 까지는 **순서를 지킨다**(골격 없이 복사할 수 없고, 코어 없이 로그인할 수 없다). Task 6 · 7 은 서로 독립이고 Task 5 뒤 아무 때나 병행할 수 있다. Task 8 은 6 · 7 · 4 를 모두 요구한다. Task 9 는 6 을, Task 10 은 6 을, Task 11 은 독립, Task 12 는 11 과 8 을 요구한다. Task 13 은 8 · 10 · 12 를, Task 14 는 전부를 요구한다.

