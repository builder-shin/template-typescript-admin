import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import record from '../../../docs/provenance/copied-core.json'

const SCRIPT = join(process.cwd(), 'scripts/check-provenance.sh')
const VALID_SHA = 'a'.repeat(40)

/**
 * 임시 디렉터리를 저장소 루트로 삼아 스크립트를 돌린다 - check-citations.test.ts
 * 와 같은 격리 방식이다. 스크립트는 `docs/provenance/copied-core.json` 과
 * `paths` 항목을 전부 `cwd` 기준 상대 경로로만 읽으므로, 스크립트를 고치지
 * 않고도 이 격리로 원하는 실패 분기를 그대로 재현할 수 있다.
 *
 * `existingPaths` 로 만든 디렉터리만 실재한다 - 그 밖의 경로를 `paths` 에
 * 적으면 "기록된 경로가 사라졌다" 분기가 그대로 트리거된다.
 */
function runCheck(recordBody: string | undefined, existingPaths: string[] = []): { code: number } {
  const dir = mkdtempSync(join(tmpdir(), 'prov-'))
  for (const path of existingPaths) {
    mkdirSync(join(dir, path), { recursive: true })
  }
  if (recordBody !== undefined) {
    mkdirSync(join(dir, 'docs', 'provenance'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'provenance', 'copied-core.json'), recordBody, 'utf8')
  }
  try {
    // `stdio: 'pipe'` 를 명시한다 - 지정하지 않으면 execFileSync 가 실패한
    // 자식 프로세스의 stderr 를 이 프로세스의 stderr 로 그대로 흘려보낸다.
    // 여기서 트리거하는 실패는 스크립트가 정확히 의도한 대로 동작한 결과라
    // 게이트 출력에 위반 메시지가 새 나갈 이유가 없다 - 검사는 종료 코드로
    // 충분하다.
    execFileSync('bash', [SCRIPT], { cwd: dir, stdio: 'pipe' })
    return { code: 0 }
  } catch (error) {
    return { code: (error as { status: number }).status }
  }
}

describe('copied-core provenance', () => {
  it('40자 커밋 SHA 를 갖는다', () => {
    expect(record.commit).toMatch(/^[0-9a-f]{40}$/)
  })

  it('기록된 경로가 전부 실재한다', () => {
    expect(record.paths.length).toBeGreaterThan(0)
    expect(() => execFileSync('bash', ['scripts/check-provenance.sh'])).not.toThrow()
  })

  it('기록 파일이 아예 없으면 0 이 아닌 코드로 죽는다', () => {
    expect(runCheck(undefined).code).not.toBe(0)
  })

  it('commit 이 40자 16진수가 아니면 0 이 아닌 코드로 죽는다', () => {
    const body = JSON.stringify({
      source: 'https://example.invalid/probe-repo',
      commit: 'not-a-real-sha',
      copiedAt: '2026-09-12',
      paths: ['lib'],
      exports: [],
    })
    expect(runCheck(body, ['lib']).code).not.toBe(0)
  })

  it('source 가 비어 있으면 0 이 아닌 코드로 죽는다', () => {
    const body = JSON.stringify({
      source: '',
      commit: VALID_SHA,
      copiedAt: '2026-09-12',
      paths: ['lib'],
      exports: [],
    })
    expect(runCheck(body, ['lib']).code).not.toBe(0)
  })

  it('paths 가 비어 있으면 0 이 아닌 코드로 죽는다', () => {
    const body = JSON.stringify({
      source: 'https://example.invalid/probe-repo',
      commit: VALID_SHA,
      copiedAt: '2026-09-12',
      paths: [],
      exports: [],
    })
    expect(runCheck(body).code).not.toBe(0)
  })

  it('paths 가 가리키는 경로가 사라졌으면 0 이 아닌 코드로 죽는다', () => {
    const body = JSON.stringify({
      source: 'https://example.invalid/probe-repo',
      commit: VALID_SHA,
      copiedAt: '2026-09-12',
      paths: ['does/not/exist'],
      exports: [],
    })
    // existingPaths 를 비워 둔다 - 'does/not/exist' 를 실제로 만들지 않아야
    // "사라진 경로" 분기를 재현한다.
    expect(runCheck(body).code).not.toBe(0)
  })

  it('모든 필드가 유효하면 통과한다', () => {
    const body = JSON.stringify({
      source: 'https://example.invalid/probe-repo',
      commit: VALID_SHA,
      copiedAt: '2026-09-12',
      paths: ['lib'],
      exports: [],
    })
    expect(runCheck(body, ['lib']).code).toBe(0)
  })
})
