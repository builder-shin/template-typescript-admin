import { reportKnownDivergences } from './matrix'
import { BACKEND_KIND, startStack } from './stack'

/**
 * Playwright 의 globalSetup 계약: 전체 실행 전에 한 번 돈다. 근거는 stack.ts.
 *
 * 스택을 띄운 직후 `reportKnownDivergences()` 를 부른다 - 실행마다 "오늘 이
 * 백엔드가 정본과 어디서 갈리는가"가 로그에 그대로 남는다(0건이어도 남는다 -
 * 근거는 `matrix.ts` 의 같은 이름 함수 주석). `BACKEND_KIND` 는 `stack.ts` 가
 * 모듈 평가 시점에 이미 `resolveBackendKind` 로 검증해 둔 값이다.
 */
export default function globalSetup(): void {
  startStack()
  reportKnownDivergences(BACKEND_KIND)
}
