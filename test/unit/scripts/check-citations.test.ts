import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FORBIDDEN_DOT = '.' + 'superpowers/notes/x.md'
const FORBIDDEN_BARE = 'superpowers' + '/sdd'
const ALLOWED = 'docs/superpowers/specs/2026-09-12-admin-template-design.md'
const FORBIDDEN_TASK_LABEL = 'D' + '2 Task 4'
const FORBIDDEN_REVIEW_LABEL = '브랜치' + ' 리뷰'
const ALLOWED_SPEC_REF = '스펙 4.2'

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

  it('형제 저장소의 개발 단계·리뷰 표기를 가리키면 0 이 아닌 코드로 죽는다', () => {
    expect(runCheck(`// ${FORBIDDEN_TASK_LABEL}\n`).code).not.toBe(0)
    expect(runCheck(`// ${FORBIDDEN_REVIEW_LABEL}\n`).code).not.toBe(0)
  })

  it('이 저장소 자신의 스펙 절 표기를 가리키면 통과한다', () => {
    expect(runCheck(`// ${ALLOWED_SPEC_REF}\n`).code).toBe(0)
  })
})
