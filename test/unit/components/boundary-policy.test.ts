import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 루트 `AGENTS.md` 규칙 6번(지시어 오염)의 기계적 고정 - `registry-policy.test.ts`
 * 가 규칙 5번을 파일을 읽어 고정하는 것과 같은 모양이다(Task 15, `docs/superpowers/
 * plans/2026-09-12-admin-template.md`의 "지시어 경계를 기계적으로 고정한다").
 *
 * 하는 일 하나: **비-클라이언트 모듈이 `'use client'` 모듈에서 값으로 가져온
 * 이름은 JSX 로만 쓰여야 하고 호출되면 안 된다.** 실제로 벌어졌던 위반
 * (`components/grid/format.ts` 가 생긴 이유, 루트 `AGENTS.md` 규칙 6번의 표
 * 첫 줄) 은 서버 컴포넌트가 `'use client'` 모듈의 평범한 함수를 값으로 불러
 * 호출한 것이었다 - Next 의 RSC 번들러가 `'use client'` 모듈의 모든 export
 * 를 클라이언트 참조로 바꾸므로, 컴포넌트로 그리는 것(`<Name .../>`)은
 * 되지만 함수로 호출하는 것(`Name()`)은 서버에서 실제 구현이 아니다.
 *
 * **왜 `pnpm build` 가 이 부류를 못 잡는가.** 그 위반이 깨뜨린 라우트
 * (`/examples/[id]`)는 동적(ƒ)이라 빌드 시 미리 렌더되지 않는다 - `next build`
 * 는 정적 페이지만 렌더하므로 초록이었고, 실제 백엔드 E2E 가 그 페이지를
 * 처음 열었을 때에야 런타임에서 드러났다. 이 테스트는 그 틈을 메운다 -
 * 렌더도 백엔드도 없이 파일 내용만으로 같은 부류를 고정한다.
 *
 * ## 이 테스트가 세는 것과 세지 않는 것
 *
 * **단정은 "호출이 0건"이지 "import 가 몇 건"이 아니다.** 컴포넌트를 경계
 * 너머로 가져와 JSX 로 그리는 것은 정상이고 그것이 이 경계의 작동 방식이다 -
 * import 개수를 고정하면 정상적인 추가(화면이 늘 때마다 컴포넌트를 하나 더
 * 가져오는 것)마다 테스트가 깨진다. 실측 기준선(2026-09-12): 경계를 넘는 값
 * import 12건, 전부 JSX 컴포넌트, 호출 0건 - 이 숫자는 참고용 주석일 뿐 아래
 * 어떤 `expect` 도 이 숫자에 걸려 있지 않다(늘어나거나 줄어도 통과한다).
 *
 * `import type` 은 통째로, 개별 지정자의 `type Foo` 도 제외한다 - 타입은
 * 런타임에 지워지므로 호출될 수 없다. `'use server'` 파일은 이 테스트의
 * 대상이 아니다(루트 AGENTS.md 규칙 6번 표의 나머지 두 위반은 `next build`
 * 가 이미 잡는다 - 이 테스트는 빌드가 못 잡는 첫째 것만 겨냥한다).
 *
 * ## 어떻게 판별하는가 - 완전한 파서가 아니라 기계적 근사다
 *
 * `registry-policy.test.ts` 와 같은 수준의 도구다(정규식으로 파일 내용을
 * 본다, TS AST 를 쓰지 않는다). `'use client'` 판별은 파일 맨 앞의 공백·주석을
 * 건너뛰고 **첫 실제 문장**이 그 지시어인지만 본다 - 단순 `grep` 이었다면
 * "레지스트리가 붙여 준 지시어를 이 저장소가 의도적으로 뺐다" 같은, 지시어를
 * 설명하는 주석 문장에도 걸린다(`components/data-table-query.ts`·
 * `lib/auth/form-state.ts`·`components/ui/table.tsx` 등에서 실측). 호출 판별은
 * `이름(` 정규식이다 - 프로토타입 체인 접근(`obj.Name(`)처럼 완전히 다른
 * 호출을 오탐할 수 있지만, 오늘 이 저장소에는 그런 자리가 없다(실측, 아래
 * 두 번째 테스트가 그 실측을 계속 지킨다).
 *
 * ## 두 번째 방향 - `'use client'` 파일이 `lib/config/settings` 로 값-import 를 닿게 하지 않는다
 *
 * 위는 "비-클라이언트가 클라이언트 값을 호출하는가"(한 방향)만 본다 - 반대
 * 방향("클라이언트 파일 자신이 값으로 무엇을 끌어오는가")은 별개의 위험을
 * 지킨다. `lib/config/settings.ts` 는 `process.env` 를 읽는 서버 전용
 * 코드다 - `'use client'` 파일의 값-import **전이적 폐쇄**(직접이든, 몇
 * 단계를 거치든)에 그 파일이 들어오면, 그 코드가 클라이언트 번들의
 * 의존 그래프에 들어온다는 뜻이다. `server-only` 패키지 같은 강제 장치가
 * 이 저장소에 없어(그 자리가 있었다면 `next build` 가 잡았을 것이다),
 * 오늘 새지 않는 것은 순전히 트리 셰이킹이 실제로 안 쓰이는 코드를 쳐내
 * 주는 우연이다 - 이 테스트가 그 우연을 규칙으로 바꾼다.
 *
 * 실제로 걸렸던 자리 둘(`components/grid/bulk-result.tsx` 가
 * `lib/jsonapi/errors` 의 `actionForErrors` 를 값으로 불러 `client.ts` →
 * `settings.ts` 까지 이어졌던 것, `components/data-table-query.ts` 가
 * `recentExamplesRequest` 를 통해 같은 사슬에 닿았던 것)를 고치며 이
 * 테스트를 추가했다 - 예외 목록은 없다. 둘 다 값 import 를 아예 없애는
 * 쪽으로 고쳤지, 이 테스트에 예외를 등록하는 쪽으로 고치지 않았다 -
 * 예외 목록이 있으면 "닿지 않는다"가 아니라 "닿아도 되는 곳을 빼고는
 * 닿지 않는다"가 되어, 새 예외가 조용히 늘어나는 것을 이 테스트가 막지
 * 못한다.
 */

const SCAN_DIRS = ['app', 'components', 'lib']

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(toPosix(full))
    }
  }
  return out
}

/**
 * 파일 맨 앞의 공백과 두 종류의 주석(줄 주석 `//`, 블록 주석)을 건너뛴 뒤 첫
 * 문장이 정확히 그 지시어(`'use client'` 또는 `'use server'`, 따옴표 종류
 * 무관)인지 본다 - ECMAScript 의 directive prologue 규칙과 같다. 주석 안에서
 * 그 문구를 설명만 하는 파일(위 머리말 참고)을 오판하지 않기 위해 이 정도
 * 파싱이 필요했다.
 */
function hasDirective(source: string, directive: string): boolean {
  let rest = source
  for (;;) {
    const trimmed = rest.replace(/^\s+/, '')
    if (trimmed.startsWith('//')) {
      const newline = trimmed.indexOf('\n')
      rest = newline === -1 ? '' : trimmed.slice(newline + 1)
      continue
    }
    if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/')
      rest = end === -1 ? '' : trimmed.slice(end + 2)
      continue
    }
    rest = trimmed
    break
  }
  const escaped = directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^(['"])${escaped}\\1`).test(rest)
}

const allFiles = SCAN_DIRS.flatMap((dir) => listSourceFiles(dir))
const allFilesSet = new Set(allFiles)
const fileContents = new Map(allFiles.map((file) => [file, readFileSync(file, 'utf8')]))
const clientFiles = new Set(
  allFiles.filter((file) => hasDirective(fileContents.get(file)!, 'use client')),
)
/**
 * `'use server'` 파일들 - 역방향 폐쇄(`valueImportClosure`)가 이 파일들의
 * 경계에서 멈춘다. 공식 문서(node_modules/next/dist/docs/01-app/02-guides/
 * server-actions.md:78,84): "the 'use server' directive tells the compiler
 * to swap the function's implementation in client bundles for a reference
 * ... unused Server Functions are stripped from client bundles" - 즉 클라이언트
 * 파일이 `'use server'` 파일에서 값을 import 해도, 그 구현과 그 구현이
 * 끌어오는 것들은 클라이언트 번들에 실리지 않는다(오직 액션 참조 하나만
 * 실린다). 이 경계를 반영하지 않으면 이 스캔이 거짓 양성을 낸다 - 실측:
 * `components/nav-user.tsx` 가 `app/(auth)/actions.ts`(`'use server'`)의
 * `logoutAction` 을 값으로 import 하고, 그 파일은 `lib/auth/*` 를 거쳐
 * `lib/config/settings.ts` 에 닿는다 - 이 경계 처리 없이 실행하면 이
 * 저장소에 실제로는 없는 위반을 보고한다.
 */
const serverFiles = new Set(
  allFiles.filter((file) => hasDirective(fileContents.get(file)!, 'use server')),
)

/** `@/` 별칭과 상대 경로(`./`·`../`)만 저장소 안으로 푼다 - 그 밖(패키지 이름)은 대상이 아니다. */
function resolveImportPath(specifier: string, fromFile: string): string | undefined {
  let base: string
  if (specifier.startsWith('@/')) {
    base = specifier.slice(2)
  } else if (specifier.startsWith('.')) {
    base = toPosix(path.normalize(path.join(path.dirname(fromFile), specifier)))
  } else {
    return undefined
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find((candidate) => allFilesSet.has(candidate))
}

/**
 * `import type {...}`(전체 타입 전용) · `import {...}`(개별 지정자에 `type`
 * 이 섞일 수 있다) · `import Default[, {...}]` · `import * as NS` 넷을
 * 이름 있는 그룹으로 구별한다. 이 저장소의 실제 import 문 전부가 이 넷
 * 안에 든다(실측 - 아래 스캔이 밑에서 두 번째 테스트가 기대하는 개수를 그대로 낸다).
 */
const IMPORT_RE =
  /import\s+(?<wholeType>type\s+)?(?:(?<defaultName>[A-Za-z_$][\w$]*)\s*,\s*)?(?:\{(?<braceBody>[^}]*)\}|(?<nsName>\*\s+as\s+[A-Za-z_$][\w$]*)|(?<soloDefault>[A-Za-z_$][\w$]*))\s+from\s+['"](?<specifier>[^'"]+)['"]/g

interface CrossBoundaryImport {
  file: string
  name: string
  resolved: string
}

function namedImports(file: string, source: string): CrossBoundaryImport[] {
  const found: CrossBoundaryImport[] = []
  for (const match of source.matchAll(IMPORT_RE)) {
    const groups = match.groups!
    if (groups.wholeType !== undefined) continue // import type {...} - 통째로 제외
    // specifier 는 이 정규식이 매치하면 항상 잡힌다(어떤 대안 분기 안에도
    // 있지 않다) - noUncheckedIndexedAccess 가 강제하는 방어적 가드일 뿐,
    // 실제로 undefined 면 이 import 문 자체를 해석할 수 없으므로 건너뛴다.
    if (groups.specifier === undefined) continue

    const resolved = resolveImportPath(groups.specifier, file)
    if (resolved === undefined || !clientFiles.has(resolved)) continue

    const names: string[] = []
    if (groups.defaultName !== undefined) names.push(groups.defaultName)
    if (groups.soloDefault !== undefined) names.push(groups.soloDefault)
    if (groups.nsName !== undefined) names.push(groups.nsName.replace(/^\*\s+as\s+/, ''))
    if (groups.braceBody !== undefined) {
      for (const rawSpecifier of groups.braceBody.split(',')) {
        const specifier = rawSpecifier.trim()
        if (specifier === '' || /^type\s+/.test(specifier)) continue // 개별 `type X` 제외
        const asClause = specifier.match(/^[A-Za-z_$][\w$]*\s+as\s+([A-Za-z_$][\w$]*)$/)
        const aliasName = asClause?.[1]
        names.push(aliasName ?? specifier)
      }
    }

    for (const name of names) found.push({ file, name, resolved })
  }
  return found
}

const crossBoundaryImports = allFiles
  .filter((file) => !clientFiles.has(file)) // 비-클라이언트 모듈만 본다
  .flatMap((file) => namedImports(file, fileContents.get(file)!))

/** `이름(` 이 그 파일 안에 나타나면 호출이다 - `<이름` 이면 JSX 다. */
function isCalled(name: string, source: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\s*\\(`).test(source)
}

describe('지시어 경계 - 비-클라이언트 모듈이 use client 모듈의 값을 호출하지 않는다', () => {
  it('경계를 넘는 값 import 가 존재한다 - 스캔 자체가 무력화되지 않았다', () => {
    // 이 단정이 없으면 위 스캔 로직이 고장 나 아무것도 못 찾을 때도(예:
    // SCAN_DIRS 경로가 바뀌거나 정규식이 깨질 때) 아래 "호출 0건" 테스트가
    // 공허하게 초록으로 남는다. 정확한 개수는 걸지 않는다(위 머리말) -
    // "0 보다 크다"만 걸어 스캔이 실제로 뭔가를 보고 있다는 것만 지킨다.
    expect(crossBoundaryImports.length).toBeGreaterThan(0)
  })

  it('가져온 이름은 전부 JSX 로만 쓰이고 호출되지 않는다', () => {
    const violations = crossBoundaryImports
      .filter(({ name, file }) => isCalled(name, fileContents.get(file)!))
      .map(({ file, name, resolved }) => `${file}: '${name}' (from ${resolved})`)

    expect(violations).toEqual([])
  })
})

/**
 * 이 import 문(`IMPORT_RE` 의 한 매치)이 **값**을 끌어오는지 - `namedImports`
 * 와 달리 대상 파일이 클라이언트인지는 보지 않는다(역방향 탐색은 대상이
 * 무엇이든 값 import 인 간선을 전부 따라가야 한다). `import type {...}`
 * 전체, 그리고 `{ type X, ... }` 처럼 중괄호 안 지정자가 전부 `type` 접두를
 * 가진 경우만 값 import 가 아니다 - 기본 import·네임스페이스 import·중괄호
 * 안에 지정자 하나라도 `type` 이 아닌 것이 섞이면 값 import 다.
 */
function isValueImport(groups: Record<string, string | undefined>): boolean {
  if (groups.wholeType !== undefined) return false
  if (groups.defaultName !== undefined) return true
  if (groups.soloDefault !== undefined) return true
  if (groups.nsName !== undefined) return true
  if (groups.braceBody !== undefined) {
    const specifiers = groups.braceBody
      .split(',')
      .map((specifier) => specifier.trim())
      .filter((specifier) => specifier !== '')
    return specifiers.some((specifier) => !/^type\s+/.test(specifier))
  }
  return false
}

/**
 * `start` 에서 값 import 로 닿을 수 있는 모든 파일의 전이적 폐쇄(자기 자신
 * 포함) - 클라이언트 여부와 무관하게 저장소 내부 파일 전부를 따라간다.
 * 순환 import 가 있어도 `visited` 로 막혀 무한 루프에 빠지지 않는다.
 */
function valueImportClosure(start: string): Set<string> {
  const visited = new Set<string>([start])
  const queue = [start]
  while (queue.length > 0) {
    const current = queue.pop()!
    // `'use server'` 파일 자체는 도달한 것으로 기록하지만, 그 너머로는
    // 가지 않는다 - 공식 문서가 확인하는 그대로, 클라이언트 번들에는 이
    // 파일의 구현도 그 구현이 끌어오는 것도 실리지 않고 액션 참조 하나만
    // 실린다(serverFiles 선언부 주석).
    if (serverFiles.has(current)) continue
    const source = fileContents.get(current)
    if (source === undefined) continue
    for (const match of source.matchAll(IMPORT_RE)) {
      const groups = match.groups!
      if (!isValueImport(groups) || groups.specifier === undefined) continue
      const target = resolveImportPath(groups.specifier, current)
      if (target === undefined || visited.has(target)) continue
      visited.add(target)
      queue.push(target)
    }
  }
  return visited
}

describe("지시어 경계 - 'use client' 파일은 lib/config/settings 에 값으로 닿지 않는다", () => {
  const SETTINGS_FILE = 'lib/config/settings.ts'

  it('SETTINGS_FILE 이 실제로 스캔 대상이다 - 스캔 자체가 무력화되지 않았다', () => {
    // 위 "경계를 넘는 값 import 가 존재한다" 테스트가 clientFiles 가 비어
    // 있지 않음을 이미 보장한다 - 여기서는 이 테스트가 겨냥하는 특정 파일
    // (SETTINGS_FILE)이 스캔된 파일 목록에 실제로 있는지만 따로 확인한다.
    // 경로 오타로 이 파일을 놓치면 아래 "닿지 않는다" 단정이 공허하게
    // 초록이 된다.
    expect(allFilesSet.has(SETTINGS_FILE)).toBe(true)
  })

  it('어떤 use client 파일의 값-import 전이적 폐쇄에도 SETTINGS_FILE 이 없다 - 예외 없음', () => {
    const violations = [...clientFiles]
      .filter((file) => valueImportClosure(file).has(SETTINGS_FILE))
      .sort()

    expect(violations).toEqual([])
  })
})
