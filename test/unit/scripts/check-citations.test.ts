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
