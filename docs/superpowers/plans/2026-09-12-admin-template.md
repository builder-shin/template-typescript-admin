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

until curl -fsS -H 'accept: application/vnd.api+json' http://localhost:4000/health/ready; do sleep 2; done

BACKEND_URL=http://localhost:4000 pnpm seed:operator ops@example.com 'pw-long-enough'
BACKEND_URL=http://localhost:4000 pnpm dev
```

건강 판정은 **`/health/ready`** 로 한다. `/health` 는 없어서(404) 어떤 상황에서도 뜨지 않고, `/health/live` 는 Postgres 가 아직 없어도 `ok` 를 되돌려서 기다리는 도구로는 쓸모가 없다. `ready` 는 `SELECT 1` 로 DB 를 확인하고 아직이면 **503** 을 돌려서, `--fail` 이 그것을 실패로 받아 `migrate` 가 끝날 때까지 루프가 계속 돈다.

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
Expected: PASS (10 tests)

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
- Modify: `components/data-table.tsx` (블록이 쓴 파일 — `app/(admin)/` 아래가 아니라 루트 `components/` 에 있다), `app/(admin)/page.tsx`
- Test: `test/unit/grid/table.test.ts`

**Interfaces:**
- Consumes: Task 7 의 `gridQuery`·`readGridState`, Task 6 의 `ResourceDef`, Task 2 의 `lib/jsonapi` 클라이언트
- Produces: `serverDrivenTableOptions(rowCount: number): { manualPagination: true; rowCount: number }`, 그리고 화면이 부르는 **조립 함수 하나**:

```ts
export function listRequest(
  resource: ResourceDef,
  params: URLSearchParams,
  acceptLanguage: string | null,
): [path: string, options: RequestOptions]
```

**튜플을 돌려주는 이유는 복사해 온 클라이언트의 시그니처다**(실측 `lib/jsonapi/client.ts`): `request<T>(path, options)` 는 인자를 **둘** 받고, `RequestOptions.query` 는 평범한 객체가 아니라 **`URLSearchParams`** 이며, `acceptLanguage` 를 얹는 `withAcceptLanguage(options, lang)` 헬퍼가 이미 있다(`null`·`undefined` 면 그대로 돌려준다). 그러니 `listRequest` 는 `[resource.path, withAcceptLanguage({ query: new URLSearchParams(gridQuery(...)) }, acceptLanguage)]` 를 만들고, 화면은 한 번 펼친다 — `await request(...listRequest(...))`.

그러면 경로 · 질의 · 언어 셋이 **한 호출에서 만들어지고** 단위 테스트 하나가 그 셋을 고정한다. 화면에 남는 무방비는 펼침 한 줄이다.

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

const TABLE = 'components/data-table.tsx'

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

**두 자리를 따로 고친다.** 실측한 구조(2026-09-12, `components/data-table.tsx`)는 이렇다.

```ts
// 모듈 수준 (110행 부근) - 행 모델이 feature 와 같은 객체에 들어 있다
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),   // ← 이 셋만 지운다
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

// 컴포넌트 안 (362행 부근)
const table = useTable({
  features,
  data,
  columns,
  state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
  getRowId: (row) => row.id.toString(),
  enableRowSelection: true,
  onRowSelectionChange: setRowSelection,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onColumnVisibilityChange: setColumnVisibility,
  onPaginationChange: setPagination,
})
```

**`tableFeatures()` 에서는 행 모델 세 줄만 지운다. feature 다섯 개는 남긴다** — `rowSortingFeature` 를 함께 지우면 정렬 상태와 API 자체가 사라져 헤더의 정렬 컨트롤이 죽는다. v9 에서 feature 는 "이 기능을 쓴다"이고 행 모델은 "클라이언트가 그 계산을 한다"로, 서버 구동은 앞을 남기고 뒤를 빼는 것이다. 블록 자신의 주석이 등록하지 않은 것은 번들에서 tree-shake 된다고 적는다 — 지우면 번들도 줄어든다.

**`...serverDrivenTableOptions(rowCount)` 는 `useTable({...})` 쪽에 넣는다**(행 모델을 지운 객체가 아니다). `rowCount` 는 서버가 준 총합이다 — 없으면 표가 전체 쪽 수를 계산할 수 없다.

**상태 배선.** `sorting` · `columnFilters` · `pagination` 셋은 이제 URL 이 정본이므로, 해당 `on*Change` 가 로컬 `setState` 대신 URL 을 바꿔야 한다. `columnVisibility` 와 `rowSelection` 은 화면 안의 일이라 로컬에 남는다 — 열 표시와 선택은 백엔드에 보내지 않는다.

**`getFilteredRowModel()` 을 쓰는 자리를 확인하라.** 505행 부근이 "N of M row(s) selected" 를 그리는데, `filteredRowModel` 등록을 지우면 그 호출은 필터 이전(= 불러온 쪽 전체) 행을 돌려준다. 서버 필터에서는 그게 정직한 값이지만 **문구가 전체 결과를 뜻하는 것처럼 읽힌다** — 불러온 쪽 기준임이 드러나게 문구를 고치거나, 총합을 쓰도록 바꾼다. 컴포넌트 안의 `pagination` `useState`(`pageSize: 10`)를 지우고 페이지·정렬·필터 상태를 **URL 에서 받는다**. 행 선택과 열 표시/숨김은 TanStack 에 남긴다.

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
    ...listRequest(
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
sorts only the rows already loaded while looking entirely correct, so
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
- Produces: `countRequest(resource): [path: string, options: RequestOptions]` (Task 8 의 `listRequest` 와 같은 튜플 모양) · `readTotal(document): number`

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
    const [, options] = countRequest(EXAMPLES)
    expect(options.query?.get('page[size]')).toBe('1')
    expect(options.query?.get('page[totals]')).toBe('true')
  })

  it('include 를 싣지 않는다', () => {
    const [, options] = countRequest(EXAMPLES)
    expect(options.query?.get('include')).toBeNull()
  })

  it('경로는 그 자원의 것이다', () => {
    expect(countRequest(EXAMPLES)[0]).toBe(EXAMPLES.path)
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

실측한 구조(`components/section-cards.tsx`, 99행): **동기 컴포넌트**가 `<Card>` 넷을 하드코딩하고, 각 카드는 `CardDescription`(라벨) · `CardTitle`(값) · `CardAction > Badge variant="outline"`(추세 %) · `CardFooter`(추세 문장 둘)로 되어 있다.

세 가지를 정해야 한다.

**1. 카드는 넷인데 자원은 셋이다.** 네 번째는 **백엔드 상태**로 둔다 — 운영자가 가장 먼저 묻는 것이다.

**경로는 `/health/ready` 다.** 실측(2026-09-12): 백엔드가 등록하는 것은 `/health/live` 와 `/health/ready` 둘이고 **`/health` 는 없다**(404). `live` 는 무조건 `{ data: null, meta: { status: "ok" } }` 를 돌려주므로 **Postgres 가 죽어도 정상이라고 말한다**; `ready` 는 `SELECT 1` 을 실행하고 실패하면 **503**(`INTERNAL_SERVER_ERROR`)을 낸다. 카드가 정직해야 할 유일한 순간에 거짓말하지 않으려면 `ready` 여야 한다.

`meta.status` 는 성공 시 백엔드가 항상 보내는 고정 리터럴이다 — 읽어도 되지만 상태 코드 이상의 정보를 담지 않으므로 독립된 근거처럼 제시하지 마라.

**실패를 한 덩어리로 뭉개지 마라.** 이 카드는 다운을 보여 주려고 있으니 던지지 않는 것이 맞지만, 404 나 503 아닌 500 은 **장애가 아니라 설정 오류다.** 전부 "다운"으로 접으면 잘못된 경로를 물어본 것이 영원히 장애로 보인다 — 실제로 그렇게 한 번 났다. 넷은 `examples` 총합 · 분류 총합 · 라벨 총합 · `/health` 가 된다. 참조 자원 카드에는 "읽기 전용"을 적는다.

**2. 추세 배지와 `CardFooter` 의 추세 문장은 지운다.** 우리 계약에 과거 데이터가 없고 지표 엔드포인트도 없어서 `+12.5%` 를 만들 방법이 **없다.** 숫자를 지어내는 대신 없애는 것이다 — 디자인을 단순화하는 게 아니라 **날조를 거부하는 것**이다. 카드 레이아웃과 타이포그래피(`text-2xl` · `tabular-nums` · `@[250px]/card:text-3xl` · `@container/card`)는 그대로 둔다.

`CardAction` 자리가 비면 그 요소를 지운다. 빈 배지를 남기지 마라.

**3. 카운트는 비동기다.** 이 컴포넌트는 동기이고 카운트 셋은 요청 셋을 요구한다. **카운트를 props 로 받게 바꾸고** `app/(admin)/page.tsx` 가 세 요청을 해서 넘긴다 — 그러면 카드는 순수 렌더링이 되어 단위 테스트가 가능하고, `headers()` 를 부르는 자리가 화면 하나로 유지된다(Task 8 과 같은 이유).

- [ ] **Step 5: 차트를 남기되 표본임을 화면이 말하게 한다**

`chart-area-interactive.tsx` 의 `chartData` 배열은 **그대로 둔다**(스펙 3.4.1). 대신 카드에 **백엔드에 연결되지 않은 표본 데이터**임을 적는다 — 운영자가 이 숫자를 읽고 판단하면 안 된다는 것을 화면에서 알 수 있어야 한다. 이것이 차트를 남기는 조건이다.

실측한 구조: `CardHeader` 안에 `CardTitle`("Total Visitors") · `CardDescription` · `CardAction`(시간 범위 `ToggleGroup`/`Select`)이 있다. **라벨은 `CardDescription` 에 넣는다** — 이미 부제가 있는 자리다.

`CardAction` 의 시간 범위 컨트롤은 **무력한 것이 아니라 그 박힌 배열 위에서 실제로 동작한다**(3개월·30일·7일로 걸러낸다). 지어낸 데이터를 거르는 셈이지만, 표본이라고 적어 두면 일관된다 — 그러니 컨트롤을 없애지 마라.

- [ ] **Step 6: 표와 헤더를 바꾼다**

`app/(admin)/data.json`(68행 `reviewer: "Eddie Lake"`)을 지우고 대시보드의 표를 `examples` 최근 수정 목록으로 바꾼다. `site-header.tsx` 의 하드코딩된 `Documents` 를 화면 이름으로 바꾼다.

**Task 8 이 남긴 한 과업짜리 창을 여기서 닫는다.** Task 8 이 `components/data-table.tsx` 의 클라이언트 행 모델을 지웠지만 대시보드는 아직 정적 `data.json` 을 넘기고 있어서, **그 표의 정렬·필터·페이지 컨트롤이 지금 아무것도 하지 않는다.** 표를 `examples` 로 바꾼 뒤 **그 컨트롤들이 서버에 대해 실제로 동작하는지 확인하라** — 값이 그려지는 것만으로는 알 수 없다. 정렬을 바꿨을 때 첫 행이 실제로 바뀌는지 보는 것이 최소 확인이다.

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
- Create: `app/(admin)/examples/new/page.tsx`, `app/(admin)/examples/new/loading.tsx`
- Create: `app/(admin)/examples/actions.ts`, `app/(admin)/examples/form-state.ts`
- Modify: `test/unit/jsonapi/errors.test.ts` — 실측된 문서 pointer 셋을 고정한다
- Test: `test/unit/examples/form-state.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `groupErrors`·`actionForErrors`·`FieldErrors`(`lib/jsonapi/errors.ts`), Task 6 의 `ResourceDef`, Task 8 의 `listRequest`(`app/(admin)/examples/list.ts`)
- Produces: `detailRequest(resource, id, acceptLanguage): [path: string, options: RequestOptions]` · `examplesFormState(errors: readonly ErrorObject[]): ExamplesFormState` — `{ attributeErrors, relationshipErrors, documentErrors, unusable }`. **auth 와 달리 `context` 인자가 없다** — auth 는 제산된 이메일과 `accountCreated` 를 되돌려줄 필요가 있었지만, 이 폼은 제출된 값을 `FormData` 로 다시 얻어 화면이 지닌다. Step 3 의 테스트가 인자 하나로 부르는 것이 정본이다.

- [ ] **Step 1: 이미 있는 것을 읽는다 — 필드 오류 매핑을 새로 쓰지 마라**

**이 Task 의 첫 번째 일은 코드를 쓰는 것이 아니라 `lib/jsonapi/errors.ts` 와 `lib/auth/flow.ts` 를 읽는 것이다.** 이 계획의 이전 판은 `lib/resources/form.ts` 에 `fieldErrors(document): Record<string, string>` 를 새로 쓰라고 했다. 그 지시는 삭제됐다. 이유가 셋이다.

1. **이미 있다.** `lib/jsonapi/errors.ts` 의 `placeError` 가 pointer 를 정확히 같은 규칙으로 가른다 — `segments[1] !== 'data'` 면 문서 오류, `segments[2]` 가 통(`attributes`·`relationships`), `segments[3]` 이 필드, 없으면 문서 오류. **게다가 RFC 6901 이스케이프(`~1`→`/`, `~0`→`~`)를 풀어 주는데 이전 판의 명세에는 그 얘기가 아예 없었다.** `groupErrors` 가 그것을 `{ attributes, relationships, document }` 로 묶는다. `test/unit/jsonapi/errors.test.ts` 에 이미 30개가 붙어 있고 `a~1b`·`a~01`·`/data/attributes/`(뒤가 빈 것)까지 고정돼 있다.
2. **자리가 틀렸다.** `lib/resources/AGENTS.md` 는 그 디렉터리가 **아무 내부 모듈도 import 하지 않는 순수 선언 계층**이라고 못 박는다. 오류 문서 파싱은 자원과 무관하므로 애초에 `lib/jsonapi/` 의 일이다. Task 9 에서 `lib/resources/count.ts` 가 정확히 이 규칙을 깨서 `app/(admin)/count.ts` 로 옮겼다 — 같은 실수를 다음 Task 에 또 심을 이유가 없다.
3. **계약이 더 나빴다.** 이전 판의 `Record<string, string>` 은 필드당 문구 하나이고 **속성과 관계를 한 이름 공간에 납작하게 눌러** `category` 속성 오류와 `category` 관계 오류가 서로를 덮는다. `groupErrors` 는 셋을 분리하고 필드당 `string[]` 을 준다. 이전 판이 "전부 보여야 하는 자리가 생기면 그때 `string[]` 로 바꾼다"고 적어 둔 그 자리가 **바로 이 Task** 다.

**읽어야 하는 정본은 `lib/auth/flow.ts` 의 `authFormStateFromErrors` 다.** 그것이 이 Task 가 필요한 모양을 이미 다 갖고 있다 — `actionForErrors(errors) === 'transport'` 먼저 걸러내고, `groupErrors` 로 묶고, 문구가 하나도 없으면(`isEmpty`) "쓸 수 없는 응답"으로 떨어뜨린다. 산문으로 옮겨 적지 않는 이유는 그 사본이 드리프트하기 때문이다.

- [ ] **Step 2: 실측된 문서 pointer 셋을 기존 테스트에 고정한다**

`placeError` 의 로직은 이미 이 셋을 옳게 다룬다. 그래도 고정하는 이유는 **이 셋이 백엔드가 실제로 내는 값**이라서다(실측 2026-09-12, `document_parsing`·`crud_actions`). 로직이 맞다는 것과 그 입력이 실물이라는 것은 다른 사실이고, 뒤에 오는 사람은 후자를 알 방법이 없다.

`test/unit/jsonapi/errors.test.ts` 의 `describe('placeError')` 안에 덧붙인다.

```ts
  it.each(['/data/id', '/data/type', '/data/relationships'])(
    '%s 는 문서 오류다 - 백엔드가 실제로 내는 pointer 다',
    (pointer) => {
      // 실측: document_parsing·crud_actions 가 이 셋을 낸다. 네 번째
      // 세그먼트가 없으므로 붙일 필드가 없고, 배너로 가야 한다.
      expect(placeError({ source: { pointer } })).toEqual({ kind: 'document' })
    },
  )
```

Run: `pnpm vitest run test/unit/jsonapi/errors.test.ts` → 33 passed (30 + 3). **구현을 고칠 일은 없다** — 이것은 회귀 고정이지 새 동작이 아니다. 만약 이 셋 중 하나라도 실패하면 그때는 `placeError` 가 틀린 것이니 멈추고 보고하라.

- [ ] **Step 3: 폼 상태의 테스트를 쓴다 — auth 와 다른 점은 단 하나다**

`examples` 폼은 auth 폼과 **관계 입력이 있다는 점에서만** 다르다. `flow.ts` 는 그 차이를 이미 이름 붙여 놨다: "인증 폼에는 관계 입력이 없다. 그런데 `groupErrors` 는 세 갈래를 다 돌려주므로 relationships 를 안 읽으면 그 문구가 **소리 없이 사라진다**. 그릴 자리가 없으면 배너가 옳다."

**이 Task 에는 그릴 자리가 있다.** 그래서 `examplesFormState` 는 `grouped.relationships` 를 배너로 접지 않고 관계 입력에 붙인다. 그것이 auth 와의 유일한 실질 차이다.

```ts
import { describe, expect, it } from 'vitest'
import { examplesFormState } from '@/app/(admin)/examples/form-state'

describe('examplesFormState', () => {
  it('속성 오류는 속성 입력에, 관계 오류는 관계 입력에 붙인다', () => {
    const state = examplesFormState([
      { code: 'VALIDATION_ERROR', detail: '제목이 너무 깁니다', source: { pointer: '/data/attributes/title' } },
      { code: 'VALIDATION_ERROR', detail: '없는 분류입니다', source: { pointer: '/data/relationships/category' } },
    ])
    expect(state.attributeErrors).toEqual({ title: ['제목이 너무 깁니다'] })
    expect(state.relationshipErrors).toEqual({ category: ['없는 분류입니다'] })
    expect(state.documentErrors).toEqual([])
  })

  it('관계 배열의 항목별 실패는 그 관계 하나로 접힌다 - 둘 다 남긴다', () => {
    // 실측: relationship_resolver 가 `/data/relationships/tags/data/<n>/id` 를 낸다.
    // placeError 가 네 번째 세그먼트(tags)를 필드로 쓰므로 같은 키로 모인다.
    const state = examplesFormState([
      { code: 'VALIDATION_ERROR', detail: '첫 번째', source: { pointer: '/data/relationships/tags/data/0/id' } },
      { code: 'VALIDATION_ERROR', detail: '두 번째', source: { pointer: '/data/relationships/tags/data/1/id' } },
    ])
    expect(state.relationshipErrors).toEqual({ tags: ['첫 번째', '두 번째'] })
  })

  it('pointer 없는 VALIDATION_ERROR 는 배너로 간다 - 실측된 경로다', () => {
    // 실측(exception_handlers.py): 본문이 깨진 JSON 이면 `json_invalid` 라
    // _validation_source 가 아무 출처도 못 만들고, 백엔드는 pointer 없는
    // VALIDATION_ERROR 를 낸다. actionForErrors 는 그래도 'fieldErrors' 를
    // 돌려주므로, 붙일 필드가 없다는 사실을 화면이 스스로 알아야 한다.
    const state = examplesFormState([{ code: 'VALIDATION_ERROR', detail: '본문을 해석할 수 없습니다' }])
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
```

**`transport` 판정은 `code` 문자열로 하지 마라.** `isSyntheticError` 가 보는 표시가 무엇인지는 `lib/jsonapi/client.ts` 를 읽어 확인하고, 판정은 `actionForErrors` 에 맡긴다 — 위 테스트의 마지막 케이스가 그것을 고정한다. 합성 오류의 정확한 모양을 `client.ts` 에서 확인해 그 케이스를 맞춰 써라.

- [ ] **Step 4: 테스트를 돌려 실패를 확인하고 구현한다**

Run: `pnpm vitest run test/unit/examples/form-state.test.ts` → FAIL → 구현 → PASS (5 tests)

**문구를 만들지 않는다** — 오류 문구의 정본은 백엔드이고 `Accept-Language` 로 협상된 것이다(스펙 6.3). `flow.ts` 가 401·409 를 두고 적어 둔 경고가 그대로 적용된다: 코드 문자열 → 필드 이름 카탈로그를 프론트에 두 벌째 만들지 마라.

- [ ] **Step 5: 상세 화면을 만든다**

`detail.ts` 에 `detailRequest(resource, id, acceptLanguage)` 를 두고 `page.tsx` 는 그것 하나에 넘긴다.

**모양은 `app/(admin)/examples/list.ts` 를 읽어서 맞춘다** — Task 8 이 이미 만든 `listRequest` 가 정본이다. 산문으로 옮겨 적지 않는 이유는 그 사본이 드리프트하기 때문이다. 지금 그것은 `[path, options]` 튜플을 돌려주고 화면이 `request(...detailRequest(...))` 로 펼친다. `RequestOptions.query` 가 `URLSearchParams` 라는 점과 `withAcceptLanguage(options, lang)` 헬퍼가 있다는 점도 그 파일에서 확인된다.

**`include=category,tags` 를 반드시 싣는다.** 빼먹으면 배지가 UUID 로 그려지거나 조용히 "분류 없음"이 된다. 실측으로 두 사실이 확인됐다(2026-09-12):

| 무엇 | 실측 |
| --- | --- |
| examples 의 `include` 허용 | `EXAMPLE_QUERY_POLICY.includes = frozenset({"category", "tags"})` |
| 상세가 그것을 반영하나 | `crud_actions.show` 가 `parse_include_query` 로 읽어 문서에 넣는다 — 목록 전용이 아니다 |
| categories·tags 의 `include` 허용 | **빈 집합이다**(`includes=frozenset()`) — 역참조가 순환을 만들어서 의도적으로 비웠다 |

마지막 줄이 Step 6 에 걸린다: **생성 폼의 선택 목록을 받을 때 `include` 를 실으면 거절된다.** 분류·라벨 목록은 `include` 없이 받아라.

속성·관계·메타를 그린다. 인라인 편집은 **저장이 취소와 다른 일을 하게** 만든다 — 저장은 `PATCH` 요청 하나를 보내고 제출 중에는 스피너만 남긴다.

- [ ] **Step 6: 생성 화면과 Server Action 을 만든다**

`actions.ts` 에 생성·수정·삭제 Server Action 을 둔다. 실패하면 `examplesFormState` 로 필드에 붙이고 배너에 요약을 낸다. 성공하면 만들어진 자원의 상세로 이동한다.

**쓰기 계약은 실측돼 있다**(`route_registrar.py`, 2026-09-12). 기억으로 가정하지 마라.

| 무엇 | 실측 | 화면이 해야 하는 것 |
| --- | --- | --- |
| 생성 | `POST /api/v1/examples` → **201** | 만들어진 자원의 상세로 보낸다 |
| 수정 | `PATCH /api/v1/examples/{id}` → 200 | 상세를 갱신한다 |
| 삭제 | `DELETE /api/v1/examples/{id}` → **204, 본문 없음** | 목록으로 보낸다 |
| **쓰지 마라** | `PUT /api/v1/examples/{id}` | 업서트다(`enable_upsert = True`) — **201 로 자원을 새로 만들 수 있다.** 편집 폼이 부를 것이 아니다 |

**204 를 `status` 로 좁히지 마라.** `lib/jsonapi/client.ts` 의 `JsonApiResult<T>` 는 204 갈래를 `status: 204` 리터럴로, 나머지를 `status: number` 로 선언한다 — 판별자가 섞여 있어서 TypeScript 는 `status` 비교로 멤버를 배제하지 않는다. 좁히려면 **`document` 자체로** 좁혀라(`if (result.document !== null)`). 그 파일이 이 함정을 주석으로 크게 적어 뒀으니 삭제 액션을 쓰기 전에 읽어라.

- [ ] **Step 7: 스켈레톤 둘을 만든다**

`[id]/loading.tsx` 와 `new/loading.tsx` — **텍스트 없이** 스켈레톤만.

- [ ] **Step 8: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -F - <<'MSG'
feat: add the detail and create screens

Field errors come from the backend's JSON:API errors. This task adds no
pointer parser: lib/jsonapi/errors.ts already maps source.pointer onto
attribute and relationship names, unescapes RFC 6901 segments, and keeps
every message per field. The screen's only job is placement, and the one
way it differs from the auth form is that this form has relationship
inputs, so relationship errors land on them instead of the banner.

The frontend writes no failure wording, because the backend negotiates it
from Accept-Language.

Save is not wired to the same handler as Cancel — it sends one PATCH and
shows a spinner while it does. PATCH, not PUT: PUT is an upsert here and
can create a resource.
MSG
```

---


### Task 11: `lib/bulk` — 순차 실행기

**Files:**
- Create: `lib/bulk/executor.ts`, `lib/bulk/AGENTS.md`
- Test: `test/unit/bulk/executor.test.ts`

**Interfaces:**
- Consumes: `lib/jsonapi/document.ts` 의 `ErrorObject` **타입만**(`import type`) — 실행기는 여전히 순수 함수다
- Produces:

```ts
export const MAX_BULK_ITEMS = 50

export interface BulkOutcome {
  readonly id: string
  readonly ok: boolean
  /**
   * 실패하면 백엔드가 낸 오류 배열을 **그대로** 들고 간다. `status`·`detail` 만
   * 뽑아 복사하지 않는 이유는 `code` 가 버려지기 때문이다 — `code` 는
   * `lib/jsonapi/errors.ts` 의 오류 라우팅 전부가 키로 쓰는 유일한 필드이고,
   * 그것을 버리면 Task 12 가 HTTP 상태 문자열로 정책을 다시 판단하게 되어
   * 이미 있는 결정을 둘로 나눈다(F44 와 같은 부류의 실수).
   *
   * `exactOptionalPropertyTypes: true` 이므로, 굳이 뽑아 복사하려 들면
   * `{ status: error.status }` 는 `string | undefined` 를 `status?: string` 에 넣으려 해
   * **컴파일되지 않는다.** 오류 객체를 그대로 들고 가면 그 벽이 생기지 않는다.
   */
  readonly errors?: readonly ErrorObject[]
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
// 실증된 실패 모양이다: 삭제는 성공하면 204, 그 행이 이미 없으면 404.
// 백엔드는 삭제에 422 를 내지 않는다 - 참조 무결성 거절 경로가 없다.
// code 를 같이 싣는다 - Task 12 가 이걸 보고 재시도 가능 여부를 가른다.
const gone = (id: string) => ({
  id,
  ok: false,
  errors: [{ status: '404', code: 'RESOURCE_NOT_FOUND', detail: '그 자원을 찾을 수 없습니다' }],
})

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
    expect(report.outcomes[1]!.errors?.[0]?.code).toBe('RESOURCE_NOT_FOUND')
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
- Modify: `app/(admin)/examples/actions.ts`, `components/grid/resource-grid.tsx`, `app/(admin)/examples/page.tsx`(그리드를 그리는 화면 - 일괄 Action 을 여기서 넘긴다), **`app/(admin)/examples/[id]/page.tsx`** — Task 10 이 남긴 확인 없는 단건 삭제가 거기 있다(Step 4)
- Test: `test/unit/components/bulk-result.test.ts`

**Interfaces:**
- Consumes: Task 11 의 `runBulk`·`MAX_BULK_ITEMS`·`BulkReport`, Task 8 의 행 선택 상태
- Produces: 선택 바 · 확인 줄 · 결과 표. `components/grid/*` 에 **자원 이름 분기를 두지 않는다**

- [ ] **Step 1: 결과 표의 테스트를 쓴다**

**재시도 가능 여부를 HTTP 상태 문자열로 판단하지 마라.** `BulkOutcome.errors` 가 백엔드 오류 객체를 그대로 들고 오므로, 그 판정은 `lib/jsonapi/errors.ts` 의 `actionForErrors` 가 이미 하고 있다. `summarize` 는 그 답을 읽어 쓰기만 한다 — 코드 문자열 목록을 여기 두 벌째 만들면 백엔드가 코드를 바꿀 때 조용히 썩는다(F44 와 같은 부리의 실수).

**실측으로 확인된 것**(2026-09-12): 일괄 삭제가 만나는 실패는 셋이고 **그중 둘은 재시도하면 안 된다.**

| 실패 | 코드 | 왜 |
| --- | --- | --- |
| 그 행이 이미 없다 | `404 RESOURCE_NOT_FOUND` | **운영자의 의도는 이미 달성됐다.** 다시 DELETE 를 보내도 영원히 같은 404 다. 스펙 6.3 이 꼽은 **최빈 실패**다(두 운영자가 한 그리드를 보고, 목록은 낡는다) |
| 세션이 만료됐다 | `401` + `AUTHENTICATION_REQUIRED`·`INVALID_TOKEN`·`TOKEN_EXPIRED`·`TOKEN_REVOKED` | 실측: `ExamplesController.write_dependencies = (get_current_active_user,)` 라 **모든 DELETE 가 그 의존성을 지난다.** 세션이 죽었으면 남은 전건이 같은 401 이다 — 재시도 버튼은 무한 루프다. `actionForErrors` 가 이것을 `destroySession` 으로 부른다 |
| 그 밖 | 5xx · 409 등, 그리고 `transport`(요청이 서버에 닿지조차 못했다) | **이것만 재시도할 값이 있다** |

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from '@/components/grid/bulk-result'

const failed = (id: string, status: string, code: string) => ({
  id,
  ok: false,
  errors: [{ status, code, detail: 'x' }],
})

describe('summarize', () => {
  it('성공과 실패를 따로 센다', () => {
    const report = {
      outcomes: [{ id: 'a', ok: true }, failed('b', '500', 'INTERNAL_SERVER_ERROR'), { id: 'c', ok: true }],
      cancelled: false,
    }
    expect(summarize(report)).toEqual({
      ok: 2,
      failed: 1,
      alreadyGone: [],
      retryable: ['b'],
      sessionLost: false,
      cancelled: false,
    })
  })

  it('이미 없는 행은 재시도 대상이 아니다 - 의도가 이미 달성됐다', () => {
    // 최빈 실패다. 재시도 버튼에 넣으면 운영자는 영원히 지워지지 않는
    // 행을 계속 누르게 된다 - 실제로는 처음부터 지워져 있었다.
    const s = summarize({ outcomes: [failed('b', '404', 'RESOURCE_NOT_FOUND')], cancelled: false })
    expect(s.alreadyGone).toEqual(['b'])
    expect(s.retryable).toEqual([])
  })

  it('세션이 죽으면 재시도가 아니라 재로그인이다', () => {
    // 남은 전건이 같은 401 을 받는다. actionForErrors 가 destroySession 을 준다.
    const s = summarize({ outcomes: [failed('b', '401', 'TOKEN_EXPIRED')], cancelled: false })
    expect(s.sessionLost).toBe(true)
    expect(s.retryable).toEqual([])
  })

  it('성공한 건은 다시 보내지 않는다', () => {
    const s = summarize({
      outcomes: [{ id: 'a', ok: true }, failed('b', '503', 'HTTP_ERROR')],
      cancelled: false,
    })
    expect(s.retryable).toEqual(['b'])
  })

  it('전건 성공이면 재시도 대상이 없다', () => {
    const s = summarize({ outcomes: [{ id: 'a', ok: true }], cancelled: false })
    expect(s).toEqual({
      ok: 1,
      failed: 0,
      alreadyGone: [],
      retryable: [],
      sessionLost: false,
      cancelled: false,
    })
  })

  it('문구도 코드도 없는 실패는 재시도 대상이다 - 삼켜서 사라지게 하지 않는다', () => {
    // `{ ok: false }` 에 errors 가 없을 수 있다(변환이 오류 문서를 못 얻은 경우).
    // 분류할 근거가 없으면 alreadyGone·sessionLost 로 넘길 수 없으니 재시도로 둔다 -
    // 어느 통에도 안 넣으면 그 행이 표에서 소리 없이 사라진다.
    const s = summarize({ outcomes: [{ id: 'b', ok: false }], cancelled: false })
    expect(s.failed).toBe(1)
    expect(s.retryable).toEqual(['b'])
  })
})
```

`failed` 는 ok 가 아닌 전건의 수다 — `alreadyGone` 과 `retryable` 의 합이 아니다. 세션이 죽어 분류된 행도 실패로 센다. 표의 머리글이 "12건 중 3건 실패"를 정직하게 말해야 하기 때문이다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인하고 `summarize` 를 구현한다**

Run: `pnpm vitest run test/unit/components/bulk-result.test.ts` → FAIL → 구현 → PASS (6 tests)

`summarize` 는 건별로 `actionForErrors(outcome.errors ?? [])` 를 부르고 그 답으로 통을 고른다 — `notFound` → `alreadyGone`, `destroySession` → `sessionLost`, 나머지(`banner`·`fieldErrors`·`transport`) → `retryable`. 빈 배열에 `actionForErrors` 를 부르면 `'banner'` 가 나오므로 마지막 검사가 저절로 맞는다(그 함수가 "어떤 배열에도 정의된 답을 낸다"고 주석에 적어 둔 성질이다).

- [ ] **Step 3: 선택 바를 만든다**

선택이 하나 이상일 때만 나타난다. 선택 건수와 **나갈 요청 수**를 적고, `MAX_BULK_ITEMS` 를 **읽어** 상한을 함께 알린다(값을 박지 않는다).

- [ ] **Step 4: 확인 줄을 만들고, 단건 삭제도 같은 경로를 타게 한다**

일괄 삭제를 누르면 실행 전에 "벌크 엔드포인트가 없어 DELETE 요청 N 회를 순차로 보낸다 · 일부만 실패할 수 있다 · 이미 보낸 요청은 되돌리지 않는다"를 알린다. **누르기 전에 알리는 것이 스펙 6.2 의 요구다.**

**단건 삭제도 이 Step 이 소유한다.** Task 10 이 만든 `app/(admin)/examples/[id]/page.tsx` 의 삭제에는 확인 단계가 없다. 실측(2026-09-12)으로 그 상태는 문장보다 나쁘다:

```tsx
<form action={deleteExampleAction.bind(null, id)} className="max-w-lg">
  <SubmitButton label="삭제" variant="destructive" />
</form>
```

`SubmitButton`(`components/form/submit-button.tsx`)은 `className="w-full"` 을 무조건 붙이고, **바로 위 `ExampleForm` 의 저장 버튼도 같은 부품이다.** 그래서 화면에는 같은 모양·같은 너비의 전폭 제출 버튼 둘이 수직으로 맞붙어 있고, 아래쪽이 되돌릴 수 없다 — **색이 유일한 구별이다.** 되돌릴 방법은 없다(백엔드에 복원 경로가 없다).

세 가지를 함께 한다:

1. **확인 문구를 N=1 에 맞게 쓴다.** 위 일괄용 문구를 그대로 재사용하지 마라 — 단건에서 "요청 N 회를 순차로"와 "일부만 실패할 수 있다"는 **둘 다 거짓이다.** 확인 부품이 건수를 받아 1 일 때와 여럿일 때 다른 문장을 내게 하고, 어느 쪽이든 "되돌리지 않는다"는 공통으로 남긴다.
2. **버튼 배치를 함께 고친다.** 저장과 삭제가 같은 폭·같은 위치를 공유하지 않게 한다. 색만으로 파괴적 동작을 구별하지 마라 — 색각 이상에서 무너지고, 맞붙은 전폭 버튼에서는 그나마의 구별도 조준에 도움이 되지 않는다.
3. **`alert-dialog` 는 미설치다.** 실측: dashboard-01 이 가져온 `components/ui/` 22 개에 없다. 필요하면 `npx shadcn@latest add alert-dialog` 로 더하되, 더했으면 그것이 이 계약의 일부가 됐다는 사실을 `components/AGENTS.md` 에 적어라(Task 14 가 그 파일을 쓴다). 더하지 않고 폼 안의 두 단계(`확인` 상태를 거치는 제출)로 풀어도 된다 — **판단은 구현자의 것이고, 확인 단계가 존재한다는 결과만 필수다.**

- [ ] **Step 5: 결과 표를 만든다**

**토스트로 뭉개지 않는다.** 행별 성공·실패를 표로 내고, 실패 이유는 백엔드가 준 문구를 그대로 쓴다 — `outcome.errors` 에서 `detail ?? title ?? code` 를 읽는다(`lib/jsonapi/errors.ts` 의 `messageOf` 와 같은 순서다. 문구를 지어내지 마라). 진행 중에는 **텍스트 없이** 스피너와 진행률만 둔다(진행 카운트 `7 / 12` 는 데이터이므로 허용).

**재시도 버튼은 `summarize().retryable` 만 받는다.** 세 통이 서로 다른 것을 뜻하므로 표도 셋을 구분해 보여야 한다.

| 통 | 표가 말해야 하는 것 | 버튼 |
| --- | --- | --- |
| `retryable` | 다시 보내면 달라질 수 있다 | **재시도** |
| `alreadyGone` | 그 행은 이미 없다 — 지우려던 목적은 달성됐다 | 없음. 목록 새로 고침을 권한다 |
| `sessionLost` | 세션이 끊겨 남은 건이 처리되지 않았다 | **다시 로그인**(재시도가 아니다) |

`sessionLost` 가 참이면 **재시도 버튼을 아예 그리지 마라.** 남은 전건이 같은 401 을 받으므로 그 버튼은 누를 때마다 같은 표를 다시 만든다.

`sonner` 가 블록과 함께 들어왔지만 **부분 실패에는 쓰지 않는다.**

- [ ] **Step 6: Server Action 을 배선한다**

`actions.ts` 에 일괄 삭제 Action 을 더하고 `runBulk` 로 실행한다. 각 건은 `DELETE /api/v1/examples/{id}` 한 번이다.

**`JsonApiResult` → `BulkOutcome` 변환은 이 Step 이 소유한다.** Task 11 의 실행기는 순수함수라 요청을 모르고, 화면은 `BulkOutcome` 만 본다 — 그 사이를 잇는 것이 여기다. 함정이 둘이고 둘 다 실측돼 있다.

**1. 204 를 `status` 로 좁히지 마라.** 성공한 삭제는 **204, 본문 없음**이다(`route_registrar.py` 실측). 그런데 `lib/jsonapi/client.ts` 의 `JsonApiResult<T>` 는 204 갈래만 `status: 204` 리터럴이고 나머지는 `status: number` 라 판별자가 섞여 있다 — TypeScript 는 `result.status === 204` 로 멤버를 배제하지 않는다. 그 파일이 이 함정을 주석으로 크게 적어 뒀으니 읽고 시작해라. 좁히려면 `ok` 와 `document` 로 좁힌다.

```ts
// 성공: ok 가 참이면 끝이다. 204(document: null)도 200(document: T)도 같은 성공이다.
// 삭제에서 문서를 읽을 일이 없으니 status 를 들여다볼 이유가 아예 없다.
if (result.ok) return { id, ok: true }
return { id, ok: false, errors: result.errors }
```

**2. `errors` 를 복사해 재조립하지 마라.** `BulkOutcome.errors` 가 `readonly ErrorObject[]` 인 이유가 이것이다 — `exactOptionalPropertyTypes: true` 아래에서 `{ status: e.status, detail: e.detail }` 는 `string | undefined` 를 `status?: string` 에 넣으려 해 **컴파일되지 않는다.** 오류 배열을 그대로 넘기면 그 벽이 생기지 않고, `code` 도 같이 살아서 Step 1 의 분류가 성립한다.

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -F - <<'MSG'
feat: make partial failure a first-class bulk result

The selection bar reads MAX_BULK_ITEMS rather than restating it and says how
many requests a bulk action will send before it is pressed. Failures land in
a per-row result table carrying the backend's own message.

Retry is offered only for rows where retrying can change the answer. The two
failures this actually hits are both excluded, and both were measured: a 404
means the row was already gone, so the operator's intent is already satisfied
and resending deletes nothing forever; a 401 means the session died, and since
every DELETE goes through the same auth dependency, every remaining row would
fail identically — a retry button there is a loop. summarize does not decide
this from HTTP status strings; it reads actionForErrors, which already owns
the routing, so there is no second catalogue of codes to rot.

sonner arrived with the block but is deliberately not used here: a toast
collapses twelve outcomes into one line, and three of twelve failing is the
normal path.
MSG
```

---

### Task 13: 실제 백엔드 E2E 와 게이트 완성

**Files:**
- Create: `docker-compose.e2e.yml`, `Dockerfile`, `.dockerignore`, `playwright.config.ts`
- Create: `test/e2e/{stack.ts,matrix.ts,fixtures.ts,probe-email.ts}`, `test/e2e/seed/{examples.sql,examples.rails.sql,README.md}`
- Create: `test/e2e/{auth.spec.ts,examples.spec.ts,bulk.spec.ts}`
- Modify: `scripts/check.sh`, `package.json`, `.prettierignore`, `eslint.config.mjs`, `components/nav-user.tsx`(로그아웃 배선만 - 나머지 사이드바는 Task 15)
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

**네 build context 를 여기 적어 둔다. 추측하지 마라 — 그럴듯하고 틀린 이름이 실제로 존재한다.** `builder-shin/template-nestjs-api` 는 있는 저장소인데 Dockerfile 이 없다. NestJS 백엔드는 **`template-typescript-nestjs`** 다.

| 무엇 | build context | `target` | 근거(Dockerfile 스테이지, 실측) |
| --- | --- | --- | --- |
| fastapi | `https://github.com/builder-shin/template-python-fastapi.git#main` | **없다** | `uv` · `builder` · `runtime` — 마지막이 이미 `runtime` |
| nestjs | `https://github.com/builder-shin/template-typescript-nestjs.git#main` | **없다** | `builder` · `runtime` — 마지막이 이미 `runtime` |
| rails | `https://github.com/builder-shin/template-ruby-rails.git#main` | **`development`** | `base` · `bundle` · `development` · `production-bundle` · `production` — 마지막이 `production` 이라 지정하지 않으면 그쪽이 잡힌다 |
| 이 앱 | `.` | `runtime` | 이 Task 가 만드는 `Dockerfile` 의 마지막 스테이지 이름을 `runtime` 으로 둔다(형제의 `base`·`deps`·`build`·`runtime` 를 미러링) |

**`target:` 은 rails 에만 있다.** 정본에서 fastapi·nestjs 는 `build: <git URL>` 스칼라 단축형이라 `target` 키가 아예 없고, rails 만 YAML 앵커로 `context` + `target: development` 를 함께 묶어 세 서비스(`migrate-rails`·`api-rails`·`seed-rails`)가 그것을 참조한다. 아래 스니펫을 세 갈래에 그대로 복제하면 **fastapi 와 nestjs 의 빌드가 없는 스테이지를 찾다가 실패한다.**

```yaml
# 백엔드마다 migrate-* · api-* · seed-* 세 서비스를 두고 profiles 로 가른다.
# db(postgres:18-alpine) 와 redis(redis:8-alpine) 는 셋이 공유한다.
#
# rails 만 target 이 필요하므로 앵커로 묶어 세 서비스가 공유한다.
x-rails-build: &rails-build
  context: https://github.com/builder-shin/template-ruby-rails.git#main
  # 필수다. 빼면 Dockerfile 의 마지막 스테이지(production)가 잡힌다.
  target: development

  api-rails:
    profiles: [rails]
    build: *rails-build
    networks:
      default:
        aliases: [api] # ← 세 api-* 가 모두 이 별칭을 갖는다
    ports:
      - target: 4000
        published: ${E2E_API_PORT:-4100}

  api-fastapi:
    profiles: [fastapi]
    # target 없음 - 마지막 스테이지가 runtime 이다.
    build: https://github.com/builder-shin/template-python-fastapi.git#main
    networks:
      default:
        aliases: [api]

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

**씨앗 파일은 둘이다.** `examples.sql` 은 fastapi·nestjs 가 공유하고(두 백엔드의 테이블 이름이 같다), **Rails 는 `examples.rails.sql` 을 따로 쓴다** — 분류·라벨·조인 테이블 이름이 다르다(정본 434-435행). 왜 다른지와 무엇이 다른지는 `test/e2e/seed/README.md` 에 적는다. 하나로 때우면 rails 프로파일이 씨앗 단계에서 `relation does not exist` 로 죽는데, **그때는 이미 git URL 에서 Rails 이미지를 다 빌드한 뒤다.**

**정본에서 반드시 찾아 확인할 것 다섯.** 아래는 답이 아니라 질문이다 — 답은 전부 정본의 주석에 있고, 그 주석은 대조군 실측으로 쓰여 있다. 값을 여기 옮겨 적지 않는 이유는 그 사본이 드리프트하기 때문이다. 다섯 개를 각각 찾아서 **어디서 찾았는지 보고에 적어라.** 하나라도 못 찾았으면 못 찾았다고 적어라 — 추측해 메우지 마라.

| 무엇 | 왜 놓치기 쉬운가 |
| --- | --- |
| Rails 가 왜 **별도 데이터베이스 이름**을 받나, 그리고 `seed-rails` 의 `PGDATABASE` 가 무엇이어야 하나 | `bin/rails db:prepare` 는 DB 를 **새로 만든 경우에만** `db:seed` 를 돈다. 공유 DB 를 주면 시드를 조용히 건너뛰고, 엉뚱한 DB 에 씨앗을 넣으면 E2E 단정이 전부 빈 데이터에서 실패한다 |
| Rails 의 **Host 차단**을 푸는 환경변수, 그리고 **두 번째 값이 왜 필요한가** | 없으면 `GET /health/ready` 가 403 `Blocked hosts` 를 낸다. 두 번째 값을 빼면 브라우저를 거치지 않고 호스트 공개 포트로 직접 닿는 시나리오만 전멸한다 — Host 헤더가 컨테이너 이름이 아니기 때문이다. **FastAPI·NestJS 에는 이 검사가 없어서 두 갈래에서는 드러나지 않는다** |
| `development` 스테이지에 **HEALTHCHECK 가 없어서** compose 가 무엇을 대신 주나, 그리고 왜 `localhost` 가 아니라 서비스 이름으로 찌르나 | production 스테이지의 HEALTHCHECK 를 글자 그대로 베끼면 죽는다(정본이 실측으로 적어 뒀다) |
| `--wait` 가 성립하려면 `web` 의 `depends_on` 이 무엇까지 가리켜야 하나 | 정상 종료(exit 0)하는 일회성 서비스를 참조에서 빼면 compose 가 그것을 "예기치 않게 멈췄다"로 읽고 실패한다 |
| 포트를 **한 곳에서만** 정하는 규칙이 어느 파일에 있나 | `ALLOWED_HOSTS` 의 두 번째 값과 `ports.published` 가 같은 변수를 참조해야 한다 — 한쪽만 고치면 조용히 어긋난다 |

**Postgres 에 볼륨을 붙이지 마라 — 없는 것이 계약이다.** 정본 실측(2026-09-12): 최상위 `volumes:` 키가 **없고**, `db` 서비스는 `image`·`environment`·`healthcheck` 세 개뿐이며 `/var/lib/postgresql` 마운트도 `tmpfs` 도 없다. 즉 데이터가 컨테이너의 쓰기 계층에만 있어서 `down` 한 번에 사라지고, 매 `up` 이 **빈 데이터베이스에서 시작한다.**

개발용 스택을 짜는 본능대로 `db` 에 named volume 을 붙이면 두 가지가 조용히 망가진다.

| 갈래 | 두 번째 실행부터 |
| --- | --- |
| rails | **씨앗이 건너뛰어진다.** `bin/rails db:prepare` 는 데이터베이스를 **새로 만든 경우에만** `db:seed` 를 돈다. 볼륨이 남으면 `rails_e2e_template` 이 이미 존재하므로 생성도 시드도 없다 — E2E 단정이 전부 빈 데이터에서 실패한다 |
| fastapi · nestjs | `examples.sql` 이 이미 있는 행 위에 다시 돌아, 고정 id 면 중복 키로 죽고 아니면 행이 배로 쌓여 페이지·총합 단정이 어긋난다 |

정본이 다른 모든 결정에 주석을 달아 놓고 이 부재에는 달지 않았다 — 그래서 여기 적는다. **볼륨이 필요해 보이면 그것은 스택을 재사용하려는 신호이고, 이 스택은 재사용하지 않는 것이 설계다.**

**`.dockerignore` 는 정본의 것을 그대로 쓴다.** 짧고 드리프트하지 않으므로 여기 옮겨 적는다(실측: 정본 저장소의 `.dockerignore` 전문):

```
node_modules
.next
.git
.superpowers
docs
coverage
*.tsbuildinfo
.env
.env.local
```

`web` 의 build context 가 `.` 이므로 이 목록이 없으면 `node_modules/` 전체가 데몬으로 올라가 빌드가 느려지고, **`.superpowers/`**(원장·브리핑·리뷰 패키지 — 지금 수 MB 다)까지 컨텍스트에 실린다. `.env` 두 줄은 실수로 이미지에 자격증명이 들어가는 것을 막는다.


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

- [ ] **Step 7b: 생성 폼 시나리오를 쓴다 — Base UI 가 정말 `FormData` 에 값을 넣는지 잰다**

`examples.spec.ts` 에 **생성 한 건**을 넣는다: 제목·점수를 채우고 **분류를 `Select` 로 고르고 라벨을 `Checkbox` 로 켠 뒤** 제출해, 만들어진 상세에서 그 분류와 라벨이 보이는지 본다.

**이 시나리오가 갚는 빚이 따로 있다.** Task 10 의 Server Action 은 `FormData.get`/`.getAll` 로 분류와 라벨을 읽는데, Base UI 의 `Select`·`Checkbox` 는 네이티브 입력이 아니라 **숨은 `<input>` 을 곁에 렌더해** 폼에 참여한다(근거: `node_modules/@base-ui/react` 의 `SelectRoot.d.ts`·`CheckboxRoot.d.ts` 가 그 동작을 문서로 적고 있다 — Task 10 리뷰에서 실측). 타입 선언은 의도를 말할 뿐 **브라우저에서 그렇게 되는지는 말하지 않고**, 이 저장소에는 DOM 테스트 하네스가 아예 없다. 즉 단위 테스트로는 원리상 덮을 수 없고 **여기가 그것을 재는 유일한 자리다.**

값이 실리지 않으면 증상은 조용하다 — `FormData.get(CATEGORY_FIELD)` 가 `null` 이라 관계가 그냥 빠진 채 201 이 떨어지고, 화면은 "분류 없음"을 정상처럼 그린다. **그래서 단정은 "제출이 성공했다"가 아니라 "상세에 그 분류 이름과 그 라벨이 보인다"여야 한다.**

- [ ] **Step 8: 다국어 오류를 잰다**

로케일이 다른 컨텍스트 둘로 오류 배너를 띄우고 **영어 쪽에 한글이 없는지** 본다. **한국어 쪽만 단언하면 배선을 지워도 통과한다** — 헤더가 빠지면 백엔드가 `ko` 로 떨어진다. 이것이 Task 8 Step 7 이 예고한 가드다.

- [ ] **Step 9: 일괄 작업 시나리오를 쓴다**

행 여럿을 골라 삭제를 실행하고 **행별 결과 표**가 나오는지, 실패가 섞였을 때 **실패한 것만 재시도**되는지, 취소가 남은 요청을 막는지 본다.

**부분 실패를 만드는 방법은 404 다.** 삭제가 422 로 거절되는 상태는 이 백엔드에 존재하지 않는다(실측: `destroy` 는 성공 204, 없는 행 404 이고 `example_tags` 가 CASCADE 다). 대신 **목록을 그린 뒤 그 행 하나를 HTTP 로 직접 지우고** 화면에서 일괄 삭제를 실행한다 — 그러면 그 행만 404 로 죽는다. 이것이 운영에서 실제로 일어나는 모양이기도 하다: 운영자 둘이 같은 그리드를 보고, 목록이 낡는다.

- [ ] **Step 10: 알려진 차이 보고를 만든다**

`reportKnownDivergences()` 가 **매 실행 건수를 출력**한다 — 0 건이어도 출력한다. **침묵은 "안 돌았다"와 구별되지 않는다.** 다음 드리프트를 `test.fail(조건, 이유)` 로 어떻게 무는지를 `matrix.ts` 의 주석에 남긴다: 드리프트가 그대로면 CI 는 초록이고, 백엔드가 고쳐져 테스트가 실제로 통과해 버리면 그 자리에서 죽는다.

**건수가 0 이 아니어도 된다 — 스펙 8.4 기준 3 은 그 값을 게이트로 쓰지 않는다.** 그 기준의 두 절을 나눠 읽어라. 구속력이 있는 것은 "**0건이라는 값이 매 실행 출력된다**"이고, 근거가 기준 자신에 적혀 있다 — "침묵은 '안 돌았다'와 구별되지 않는다." 요구되는 것은 **관측 가능성**이다. "0건이다"는 스펙을 쓸 때의 관측이지 구현이 통제하는 설계 요구가 아니다.

그래서 진짜 차이를 찾으면 **`test.fail` 로 물고 건수에 세고 이유와 함께 출력한다.** 그것이 기준 3 을 어기는 것이 아니라 기준 3 이 작동하는 모습이다. 0 을 억지로 맞추는 길은 둘뿐이고 둘 다 나쁘다 — 차이를 감추거나, 차이를 재지 않는 단정을 쓰는 것.

**세는 것은 `계약` 차이뿐이다.** 기준 3 의 문구는 "알려진 **계약** 차이"다. 배포·운영 차이는 여기 세지 않는다 — 예컨대 Rails 만 갖는 Host 검사, Rails 만 받는 별도 데이터베이스 이름, `development` 스테이지를 지정해야 하는 것은 **JSON:API 계약의 차이가 아니라 컨테이너를 띄우는 방법의 차이**다. 그 셋은 compose 파일과 `test/e2e/seed/README.md` 가 설명할 일이고, 이 건수에 넣으면 숫자가 "세 백엔드가 같은 계약을 말하는가"를 더 이상 뜻하지 않게 된다.

계약 차이는 **와이어에서 관측되는 것**을 말한다: 같은 요청에 다른 상태 코드, 다른 `code` 문자열, 다른 pointer 모양, 다른 페이지네이션 메타, 있어야 할 관계가 빠지는 것. 그런 것을 하나라도 찾으면 보고에 **요청과 세 응답을 나란히** 적어라 — 그것이 다음 사람이 "우리 버그인가 백엔드 차이인가"를 다시 묻지 않게 하는 유일한 증거다.

- [ ] **Step 11: 게이트를 아홉 단계로 완성한다**

**게이트 무시 목록을 먼저 넓혀라 - 나중에 하면 자기 마지막 Step 에서 터진다.** Playwright 는 실행마다 `playwright-report/`(HTML 리포터, 생성된 JS 포함)와 `test-results/` 를 쓴다. `.gitignore` 는 이미 둘을 덮고 있지만(9-10행) 게이트 세 단계가 각기 다른 목록을 본다 - 실측(2026-09-12):

| 단계 | 무엇을 보나 | playwright 산출물 |
| --- | --- | --- |
| `[2/9] lint` = `eslint .` | `eslint.config.mjs` 의 `ignores`(현재 `.next/**` · `node_modules/**` · `next-env.d.ts` 뿐) | **걸린다.** `recommendedTypeChecked` 라 tsconfig 프로젝트 밖 JS 는 경성 오류다 |
| `[3/9] format` = `prettier --check .` | `.prettierignore`(현재 0건) | **걸린다** |
| `[4/9] secretlint` | `--secretlintignore .gitignore` | 안 걸린다 - gitignore 를 읽는다 |

`.prettierignore` 가 `.superpowers/` 에 대해 이미 같은 이유를 적어 뒀다 - "자신의 .gitignore 로 커밋에서는 빠지지만, prettier --check 는 gitignore 를 읽지 않아 작업 트리에 있으면 그대로 걸린다." 두 디렉터리에 글자 그대로 같은 문장이 적용된다.

**증상이 늦게 온다.** 두 디렉터리는 첫 E2E 실행 전에는 존재하지 않으므로, 넓히지 않으면 Step 13 의 `./scripts/check.sh` 에서 **자기가 쓰지도 않은 생성 파일** 때문에 처음 터진다 - 가장 큰 과업의 맨 끝에서.

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
- **Modify**: `AGENTS.md` — **이미 있다.** `next dev` 가 만든 9행짜리 `<!-- BEGIN:nextjs-agent-rules -->` ~ `<!-- END:nextjs-agent-rules -->` 블록이 전부다(실측 2026-09-12; 마커 이름은 `node_modules/next/dist/server/lib/generate-agent-files.js` 와 일치). 계층 계약은 그 블록 **위에** 쓰고 블록은 파일 끝에 그대로 남긴다 — Step 0 참고
- Create: `README.md`
- Create: `app/AGENTS.md`, `components/AGENTS.md`, `hooks/AGENTS.md`, `lib/AGENTS.md`, `test/AGENTS.md`, `scripts/AGENTS.md`, `docs/AGENTS.md`, `.github/AGENTS.md`
- Create: `.github/workflows/ci.yml`

**이미 있는 `AGENTS.md` 를 다시 만들지 마라.** 실측(2026-09-12)으로 존재하는 것: 루트 · `lib/auth/` · `lib/config/` · `lib/grid/` · `lib/jsonapi/` · `lib/resources/` · `test/fixtures/` · `test/unit/auth/` · `test/unit/config/` · `test/unit/jsonapi/`. 앞 과업들이 만든 것이고 그 계약은 이미 유효하다 — 낡은 서술이 있으면 고치되, 새로 쓰지는 마라. `lib/bulk/AGENTS.md` 는 Task 11 이 만든다.

**Interfaces:**
- Consumes: 앞의 모든 과업
- Produces: 스펙 8.4 의 성공 기준을 만족하는 저장소

- [ ] **Step 0: 루트 `AGENTS.md` 에 이미 있는 블록을 지우지 마라**

`next dev` 가 `AGENTS.md` 의 `<!-- BEGIN:nextjs-agent-rules -->` ~ `<!-- END:nextjs-agent-rules -->` 블록을 **스스로 쓰고 다시 붙인다**(실측: Task 5 의 연기 확인에서 `next dev` 를 돌리자 루트에 `AGENTS.md` 와 `@AGENTS.md` 한 줄만 담은 `CLAUDE.md` 가 생겼다). 생성 주체는 `node_modules/next/dist/server/lib/generate-agent-files.js` 다.

**지우면 다음 `next dev` 가 다시 만들어 트리가 더러워진다** — 블록 자신이 그렇게 경고한다. 계층 계약은 그 블록 **위에** 쓰고, 블록은 파일 끝에 그대로 남긴다. 형제 저장소의 `AGENTS.md` 도 같은 모양이다.

`CLAUDE.md` 는 그 한 줄(`@AGENTS.md`)만 유지한다 — 내용을 복제하지 마라.

- [ ] **Step 1: 루트 `AGENTS.md` 를 쓴다 — 계층 계약의 정본**

스펙 4장의 소유권 표와 **위반의 정의**를 적는다. 표는 **소유 관계이지 파일 목록이 아니다** — 어떤 위치가 비어 있어도 그 행의 계약은 이미 유효하다. 어느 파일이 실재하는지는 저장소를 보면 되므로 적지 않는다(적어 두면 그 목록이 드리프트하고, 읽는 사람은 표가 아니라 그 목록을 믿는다).

반드시 함께 적을 것 여섯:

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

6. **파일 맨 위의 지시어는 그 파일의 모든 export 와 그 파일이 값으로 import 하는 모든 것에 걸리는 제약이다.** 이 계획에서 같은 부류로 **세 번** 깨졌고 증상이 매번 달라서 세 번째까지 아무도 패턴을 알아보지 못했다.

   | 어긴 것 | 증상 | 어떻게 드러났나 |
   | --- | --- | --- |
   | 서버 컴포넌트가 `'use client'` 모듈의 **평범한 함수를 호출**했다 | **모든 상세 페이지 조회가 런타임에 깨졌다** | 빌드는 통과한다 — `/examples/[id]` 는 동적 라우트(ƒ)라 빌드 시 렌더되지 않는다. 실제 백엔드 E2E 가 그 페이지를 처음 열었을 때 드러났다 |
   | 클라이언트 컴포넌트가 `@/proxy` 를 값으로 가져왔고, 그것이 `lib/auth/session.ts` 를 거쳐 `next/headers` 에 닿았다 | 빌드 실패 | `next build` 가 즉시 잡는다 — `next/headers` 에 서버 전용 차단이 있어서다 |
   | `'use server'` 파일이 **동기 함수를 export** 했다 | 빌드 실패 | `next build` 만 잡는다. `tsc` 는 이 규칙을 모르므로 typecheck·단위 테스트가 전부 초록이었다 |

   **기계적 검사 하나가 셋 중 첫째를 잡는다**(나머지 둘은 빌드가 잡는다): 비-클라이언트 모듈이 `'use client'` 모듈에서 값을 가져올 때, **가져온 이름은 JSX 로만 쓰여야 하고 호출되면 안 된다.** 컴포넌트를 경계 너머로 가져오는 것은 정상이고 그것이 경계의 작동 방식이다 — 금지되는 것은 그 모듈의 순수 함수를 서버 렌더에서 부르는 것이다. 실측(2026-09-12): 이 저장소에서 경계를 넘는 값 import 12건이 전부 JSX 컴포넌트이고 함수 호출은 0건이다.

   **"그 파일이 이미 순수 헬퍼를 export 하고 있다"는 근거로 새 import 를 정당화하지 마라.** 그것이 첫째 사례의 원인이다 — `resource-grid.tsx` 가 순수 헬퍼 여섯 개를 export 하고 있었지만 그 소비자는 **단위 테스트**였고, vitest 는 `'use client'` 를 강제하지 않는다. 테스트가 하는 import 는 서버 컴포넌트가 해도 된다는 증거가 아니다.

   **지시어가 있는 파일에서 순수한 것을 꺼내야 하면 지시어 없는 형제 모듈로 옮긴다.** 이 저장소가 그것을 세 번 했다 — `components/grid/format.ts`, `app/(admin)/examples/write.ts`, `app/(admin)/examples/form-state.ts`(0-런타임-import). 셋 다 같은 이유로 존재하므로 그 셋을 예로 적어라.

- [ ] **Step 2: dnd-kit 의 사실을 적는다**

`AGENTS.md` 에 **드래그로 옮긴 순서는 서버에 남지 않고 새로고침하면 사라진다**는 사실과 그 이유(백엔드에 정렬 수서 필드도 재정렬 엔드포인트도 없다)를 적는다. **적지 않으면 다음 사람이 "드래그가 저장 안 되는 버그"로 읽고 없는 엔드포인트를 찾는다**(스펙 3.4.2).

차트가 표본 데이터라는 사실도 같은 자리에 적는다(스펙 3.4.1).

- [ ] **Step 3: 하위 `AGENTS.md` 를 쓴다**

| 경로 | 소유하는 로컬 계약 |
| --- | --- |
| `lib/AGENTS.md` | 네 하위 디렉터리의 **의존 방향** — 누가 누구를 import 할 수 있는가. 이 저장소에서 실제로 틀린 자리가 두 번 여기였다(`lib/resources/` 가 `lib/jsonapi/` 를 값으로 소비, 오류 문서 파서를 `lib/resources/` 에 두려 함) |
| `lib/jsonapi/AGENTS.md` | "자원을 모른다" 규칙과 그 위반의 정의 (Task 2 가 만들었고 Task 9 가 갱신했다) |
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

**툴체인 버전을 워크플로에 두 번째로 적지 마라.** 정본은 `package.json` 이다(실측: `engines.node` 는 `>=24.11.0`, `packageManager` 는 `pnpm@11.22.0`). 워크플로에 숫자를 박으면 사본이 둘이 되고 하나만 올릴 때 조용히 어긋난다.

- **Node**: `24.11.0` 은 새 버전이라 러너의 기본 Node 가 그보다 낮을 수 있고, 그러면 `pnpm install` 이 `engines` 검사에서 죽는다. `actions/setup-node` 의 `node-version-file` 로 `package.json` 을 가리켜 `engines.node` 를 읽게 하는 것이 의도다 — **그 입력이 `engines` 범위를 실제로 해석하는지 작성 시점에 액션 문서로 확인하고**, 안 되면 명시적으로 고정한 뒤 **왜 사본이 둘인지 주석에 적어라.** 확인하지 않고 둘 중 하나를 고르지 마라.
- **pnpm**: `packageManager` 가 이미 정확한 버전을 고정하므로 corepack 또는 `pnpm/action-setup` 이 그것을 읽게 둔다. 워크플로에 `version:` 을 적지 않는다.

**실패한 실행의 Playwright 리포트를 산출물로 올린다** — `if: failure()` 로 `playwright-report/` 와 `test-results/` 를 업로드한다. 매트릭스이므로 산출물 이름에 갈래를 넣어 셋이 서로 덮어쓰지 않게 한다. **이것이 없으면 CI 가 빨간불일 때 손에 남는 것이 로그 한 덩어리뿐이고**, 로컬에서는 재현되지 않는 갈래가 하필 잘 깨지는 갈래다(Rails 는 Host 검사·별도 DB 이름·`development` 스테이지 셋을 혼자 갖는다).

**각 잡에 `timeout-minutes` 를 준다.** 백엔드를 git URL 에서 빌드하고 스택이 뜨기를 기다리는 구조라, 준비 대기가 걸리면 기본 한도(6시간)까지 러너를 붙잡는다. 넉넉하되 유한하게 잡는다.

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

### Task 15: 사이드바가 실재하는 것만 말하게 한다

**이 과업은 계획을 쓸 때 빠뜨린 자리다.** dashboard-01 블록이 사이드바 다섯 파일을 함께 들여왔는데 어느 과업도 그것을 소유하지 않았다(Task 13 구현자가 로그아웃 E2E 를 쓰려다 발견했다). Task 14 보다 **뒤에** 두는 이유는 이 과업이 `components/AGENTS.md` 를 함께 고치기 때문이다 — 그 파일이 서술하는 대상을 이 과업이 바꾸므로, 순서를 뒤집으면 Task 14 가 곧 낡을 서술을 쓴다.

**Files:**
- Modify: `components/app-sidebar.tsx`, `components/nav-main.tsx`, `components/nav-documents.tsx`, `components/nav-secondary.tsx`
- Modify: `app/(admin)/layout.tsx`(사이드바에 실제 운영자를 넘기는 자리 — 파일명은 열어서 확인한다)
- Modify: `components/AGENTS.md`(Task 14 가 만든다 — 이 과업이 바꾸는 만큼만 고친다)
- Test: `test/unit/components/sidebar.test.ts`, `test/unit/components/boundary-policy.test.ts`

**Interfaces:**
- Consumes: `lib/auth/session.ts` 의 세션 읽기, `lib/jsonapi/client.ts` 의 `request`, `app/(admin)/count.ts`·`health.ts` 가 세운 "화면 옆에 요청 조립" 전례
- Produces: 없음(화면 계층이다)

- [ ] **Step 1: 무엇이 조작됐는지 세고 적는다**

실측(2026-09-12)으로 확인된 것부터 확인한다. 숫자가 달라졌으면 달라진 숫자를 쓴다.

```bash
grep -c "url: '#'" components/app-sidebar.tsx        # 20
grep -n "m@example.com\|shadcn\|Acme Inc" components/app-sidebar.tsx
find app -name 'page.tsx'                            # 실제 라우트 다섯
```

| 조작된 것 | 실재하는 것 | 지울지 대체할지 |
| --- | --- | --- |
| `url: '#'` 20개 | 라우트는 `/` · `/examples` · `/examples/[id]` · `/examples/new` · `/login` 다섯뿐이고, 사이드바에 올릴 만한 것은 `/` 와 `/examples` 둘이다 | 둘은 **대체**, 열여덟은 **지운다** |
| `email: 'm@example.com'` | 로그인한 운영자의 이메일. `/api/v1/users/me` 가 실재한다 | **대체** |
| `name: 'shadcn'` | **없다.** 실측: `user_serializer.py` 의 `attributes = ("email", "is_active", "created_at", "updated_at")` — **`name` 이 계약에 없다** | **지운다** |
| `avatar: '/avatars/shadcn.jpg'` | **없다.** `public/` 디렉터리 자체가 이 저장소에 없고, 있더라도 Task 3 의 프록시 매처가 거기서 서빙되는 첫 파일을 `/login` 으로 보낸다 | **지운다** |
| `Acme Inc.` | 이 템플릿은 남의 제품 이름을 모른다 | **지운다** |

**운영자는 이메일 주소 하나다.** 조작된 네 필드 중 대체할 것이 있는 것은 `email` 하나뿐이고 `name`·`avatar`·조직명은 셋 다 백엔드에 대응물이 없다. 그러니 `NavUser` 가 받는 모양도 그만큼 줄어든다 — 이름 자리를 이메일로 채워 "이름이 있는 척" 하지 말고, **이름 줄 자체를 없앤다.**

`is_active`·`created_at`·`updated_at` 도 노출되지만 사이드바가 쓸 것이 아니다. 가져오지 마라.

- [ ] **Step 2: 운영자 조회의 테스트를 쓴다**

`/api/v1/users/me` 응답에서 이메일을 뽑는 순수 함수를 만든다. 모양은 `app/(admin)/count.ts` 의 `readTotal` 과 `app/(admin)/examples/options.ts` 의 `optionsFromDocument` 를 읽어서 맞춘다 — 요청 조립은 화면 옆, 순수 변환은 테스트 가능하게.

```ts
import { describe, expect, it } from 'vitest'
import { operatorFromDocument } from '@/app/(admin)/operator'

describe('operatorFromDocument', () => {
  it('이메일을 뽑는다', () => {
    expect(
      operatorFromDocument({
        data: {
          type: 'users',
          id: 'u1',
          attributes: { email: 'ops@example.com', isActive: true },
        },
      }),
    ).toEqual({ email: 'ops@example.com' })
  })

  it('이메일이 없으면 null 이다 - 대체 문구를 만들지 않는다', () => {
    // 계약 위반이지만 화면이 죽지는 않아야 한다. "알 수 없는 사용자" 같은
    // 문구를 지어내는 대신 그 자리를 비운다(Step 4).
    expect(operatorFromDocument({ data: { type: 'users', id: 'u1' } })).toBeNull()
  })

  it('이메일이 문자열이 아니면 null 이다', () => {
    expect(
      operatorFromDocument({ data: { type: 'users', id: 'u1', attributes: { email: 42 } } }),
    ).toBeNull()
  })
})
```

**속성 이름의 표기를 확인하라.** 백엔드는 `is_active` 로 선언하지만 와이어에서 어떤 표기로 나가는지는 `app/jsonapi/naming.py` 가 정한다(실측: 이 저장소의 `lib/jsonapi` 는 camelCase 를 기대하고 기존 화면들이 `totalCount`·`createdAt` 을 쓴다). `email` 은 한 단어라 표기 문제가 없지만, 위 테스트의 `isActive` 는 **그 파일을 읽어 맞는 표기인지 확인하고**, 다르면 고친 뒤 그렇게 했다고 보고하라.

- [ ] **Step 3: 테스트를 돌려 실패를 확인하고 구현한다**

Run: `pnpm vitest run test/unit/components/sidebar.test.ts` → FAIL → 구현 → PASS (3 tests)

- [ ] **Step 4: 사이드바를 실재하는 것으로 줄인다**

- `nav-main.tsx` 는 실재하는 두 곳만 받는다(`/` 와 `/examples`). 링크는 `next/link` 로, 현재 경로 강조는 `usePathname` 으로 — `components/grid/resource-grid.tsx` 가 이미 그것을 쓴다.
- `nav-documents.tsx`·`nav-secondary.tsx` 에 올릴 실재하는 항목이 없으면 **그 컴포넌트 호출을 지운다.** 빈 섹션 제목만 남기지 마라 — 빈 섹션은 "곧 생긴다"고 약속하는 것이고 이 템플릿은 약속하지 않는다. 파일 자체는 블록의 일부로 남겨도 되지만, 남긴다면 `components/AGENTS.md` 에 "호출되지 않는다"고 적어라.
- `Acme Inc.` 와 아바타를 지운다. 로고가 필요하면 **인라인 SVG** 로 그린다 — `public/` 에 파일을 두지 마라(Task 3 의 매처가 그것을 `/login` 으로 보낸다. 계획 Task 9 의 같은 경고 참고).
- 운영자 **이메일**은 서버에서 받아 prop 으로 내린다(이름은 계약에 없다 - Step 1). 조회에 실패하면 **그 영역을 비워라** — 대체 문구를 만들지 마라.

- [ ] **Step 5: 로그아웃이 이미 배선돼 있는지 확인한다**

Task 13 이 `nav-user.tsx` 의 로그아웃을 `logoutAction` 에 연결했다. **다시 하지 마라.** 확인만 하고, 이 과업이 사용자 데이터를 prop 으로 바꾸는 과정에서 그 배선을 깨지 않았는지 본다.

- [ ] **Step 6: `components/AGENTS.md` 를 이 과업이 바꾼 만큼 고친다**

Task 14 가 쓴 서술 중 사이드바에 관한 것을 사실에 맞게 고친다. 적을 것 둘: 블록이 들여온 부품 중 **호출되지 않는 것이 무엇인지**, 그리고 **왜 운영자 정보가 prop 으로 내려오는지**(화면이 `fetch` 하지 않는다는 `app/AGENTS.md` 의 규칙과 같은 이유다).

- [ ] **Step 6b: 지시어 경계를 기계적으로 고정한다**

루트 `AGENTS.md` 의 규칙 **6번**(지시어 오염)은 산문뿐이다. 5번에는 이미 기계적 테스트가 있다 - `test/unit/components/registry-policy.test.ts` 가 `table.tsx`·`label.tsx` 를 파일로 읽어 `'use client'` 가 없음을 고정한다. 같은 모양으로 6번을 고정한다.

`test/unit/components/boundary-policy.test.ts` 를 만든다. 하는 일 하나: **비-클라이언트 모듈이 `'use client'` 모듈에서 값으로 가져온 이름은 JSX 로만 쓰여야 하고 호출되면 안 된다.**

- 저장소를 훑어 첫 줄이 `'use client'` 인 파일 집합을 만든다.
- 그 집합에 속하지 않는 `app/`·`components/`·`lib/` 의 파일에서, 그 집합의 모듈을 값으로 가져오는 `import { … } from` 을 찾는다(`import type` 은 제외).
- 가져온 이름마다, 그 파일 안에서 `<이름` 으로 쓰이는지 `이름(` 으로 호출되는지 본다. **호출되면 실패다.**

**왜 빌드가 이것을 못 잡는지 테스트 주석에 적어라**: 이 위반이 실제로 일어났을 때(`components/grid/format.ts` 가 생긴 이유) 깨진 것은 `/examples/[id]` 였고, **그 라우트는 동적(ƒ)이라 빌드 시 렌더되지 않는다.** `pnpm build` 는 정적 페이지만 미리 렌더하므로 초록이었고, 실제 백엔드 E2E 가 그 페이지를 처음 열었을 때 드러났다.

실측 기준선(2026-09-12): 경계를 넘는 값 import **12건, 전부 JSX 컴포넌트, 호출 0건**. 숫자가 달라졌으면 달라진 숫자로 적되, **단정은 "호출이 0건"이지 "import 가 12건"이 아니다** - 컴포넌트를 경계 너머로 가져오는 것은 정상이고 그것이 경계의 작동 방식이므로, import 개수를 고정하면 정상적인 추가마다 테스트가 깨진다.

- [ ] **Step 7: 게이트를 돌리고 커밋**

Run: `rm -rf .next && ./scripts/check.sh`

```bash
git add -A
git commit -F - <<'MSG'
feat: make the sidebar name only things that exist

The dashboard block arrived with a sidebar nobody owned: twenty url: '#'
entries against four real routes, a hardcoded operator called shadcn at
m@example.com, an avatar path that cannot resolve because public/ does not
exist here, and Acme Inc. as an organisation name. None of it was labelled
as sample data, so all of it reads as fact.

Removing and replacing are different jobs and this splits them. The operator's
name and email are replaceable, because the backend serves them at
/api/v1/users/me, so they are fetched on the server and passed down. The avatar
and the organisation name have nothing to replace them with, so they are gone.
Of the twenty links, two pointed at screens that exist.

An empty section heading is a promise that something is coming, and this
template makes no such promise, so sections with nothing real in them are not
rendered at all.
MSG
```

---
