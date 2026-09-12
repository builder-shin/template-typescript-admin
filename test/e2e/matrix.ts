/**
 * 세 백엔드 매트릭스 - `BackendKind` 타입·런타임 검증과 `KNOWN_DIVERGENCES`.
 *
 * `docker-compose.e2e.yml` 의 `migrate-*`·`api-*`·`seed-*` 서비스는 `fastapi`·
 * `nestjs`·`rails` 세 compose profile 로 묶여 있다(그 파일 머리말의 "프로파일"
 * 절). `test/e2e/stack.ts` 가 `BACKEND_KIND` 환경변수를 읽어 이 파일의
 * `resolveBackendKind` 로 좁히고, 그 값을 그대로 compose profile 이름으로
 * 자식 프로세스에 넘긴다. 이 파일은 그 좁히기와, "오늘 세 백엔드가 정본과
 * 어디서 갈리는가"를 코드로 남기는 `KNOWN_DIVERGENCES` 를 갖는다.
 *
 * ## `resolveBackendKind` 가 도커를 건드리기 전에 던지는 이유
 *
 * `COMPOSE_PROFILES=<존재하지 않는 값>` 은 에러 없이 **exit 0** 으로 끝나고,
 * `db`·`redis`·`web` 만 뜬 부분 스택으로 조용히 해석된다(profiles 가 붙은
 * 서비스는 활성 profile 이 하나도 매치되지 않으면 전부 건너뛰어질 뿐, Compose
 * 는 그것을 오류로 보지 않는다 - `docker-compose.e2e.yml` 머리말의 "프로파일"
 * 절이 실측해 둔 성질이다). 그 위에서 `pnpm test:e2e` 를 돌리면 백엔드 없는
 * 스택을 상대로 모든 요청이 실패**해야** 정상인데, `BACKEND_KIND` 오타 하나가
 * 그 실패를 "이 백엔드는 원래 이렇게 갈린다"로 오독하게 만들 여지가 있다 -
 * "세 백엔드를 커버한다"는 이 태스크 전체의 주장이 조용히 거짓이 될 수 있는
 * 자리다. `stack.ts` 의 `BACKEND_KIND` 상수가 모듈 평가 시점에 이 함수를
 * 바로 부르므로, 잘못된 값은 `startStack()` 이 컨테이너를 하나도 안 띄운
 * 채로(도커를 건드리기도 전에) 던진다.
 *
 * **그 배선 자체를 `test/unit/e2e/matrix.test.ts` 가 아니라
 * `test/unit/e2e/stack.test.ts`(`stack.ts` 를 동적으로 import 한다)가
 * 지킨다** - "이 함수가 던진다"와 "그 값을 모듈 평가 시점에 부른다"는
 * 다른 성질이고, 위험한 쪽은 뒤엣것이다.
 *
 * ## 목록이 비어 있는 지금, 이 기구가 남아 있는 이유
 *
 * `KNOWN_DIVERGENCES` 는 Step 12 실측 시점의 결과를 담는다 - 세 갈래가 전부
 * 일치하면 0건이다. 기구를 지우지 않는 이유 둘. (1) `reportKnownDivergences()`
 * 는 실행마다 "0건"을 로그에 찍는다 - 그 줄이 없으면 "갈리지 않는다"와 "이
 * 검사가 안 돌았다"가 구별되지 않는다. (2) 다음 드리프트가 생겼을 때 **무엇을
 * 하면 되는지**가 코드로 남아 있어야 한다 - 빨간 칸을 본 사람의 가장 빠른
 * 대응은 `test.skip` 이고, 그것은 조용하다.
 */

export type BackendKind = 'fastapi' | 'nestjs' | 'rails'

const BACKEND_KINDS: readonly BackendKind[] = ['fastapi', 'nestjs', 'rails']

function isBackendKind(value: string): value is BackendKind {
  return (BACKEND_KINDS as readonly string[]).includes(value)
}

/**
 * `BACKEND_KIND` 환경변수의 날 값을 알려진 셋 중 하나로 좁힌다. 기본값은
 * `fastapi`(정본) - 로컬 게이트(`./scripts/check.sh`)가 오늘처럼 인자 없이
 * 돌아야 한다. 알려진 셋이 아니면 던진다 - 이유는 파일 머리말.
 */
export function resolveBackendKind(raw: string | undefined): BackendKind {
  const value = raw ?? 'fastapi'
  if (!isBackendKind(value)) {
    throw new Error(
      `BACKEND_KIND='${value}' 는 알려진 백엔드가 아니다 - ${BACKEND_KINDS.join(' | ')} 중 하나여야 한다`,
    )
  }
  return value
}

/** 이 백엔드에서 알려진 실패 하나. 판정(owner)과 근거(reason)를 함께 갖는다. */
export interface KnownDivergence {
  readonly backend: BackendKind
  /** 어느 테스트가 죽는가 - `<파일> › <describe 경로> › <테스트 제목>`. */
  readonly test: string
  /** 왜 갈리는가 - 재현·추정 근거를 함께 적는다. */
  readonly reason: string
  /** 고칠 저장소. `frontend` 면 이 저장소가, `backend` 면 백엔드 저장소가 고칠 일이다. */
  readonly owner: 'frontend' | 'backend'
  /** 이 세션이 실제로 재현했는가(`true`), 아직 못 하고 예상만 했는가(`false`). */
  readonly verified: boolean
}

/**
 * Step 12(세 갈래를 손으로 한 번씩 돌린다) 실측 결과. 새 드리프트를 적을 때:
 *
 * 1. 항목을 하나 추가한다(`reason` 에 재현과 실측을 적는다 - 근거 없는
 *    드리프트는 "고쳤는지"를 판단할 수 없다).
 * 2. 그 테스트를 가리키는 상수를 이 파일에 두고, 스펙 파일에서
 *    `knownDivergenceReason(resolveBackendKind(...), <상수>)` 를 `test.fail`
 *    에 물린다. 문구를 두 곳에 따로 적으면 언젠가 어긋난다.
 * 3. **`test.skip` 을 쓰지 마라.** 건너뛴 테스트는 조용하고, 백엔드가 고쳐져도
 *    아무도 모른다. `test.fail` 은 고쳐지는 날 스스로 죽는다.
 * 4. 백엔드 저장소에 이슈를 올리고 `owner: 'backend'` 로 둔다.
 */
export const KNOWN_DIVERGENCES: readonly KnownDivergence[] = []

/**
 * 이 백엔드·이 테스트에 알려진 드리프트가 있으면 그 이유를 돌려준다 -
 * `test.fail()` 에 그대로 물린다.
 *
 * 목록이 비어도 이 함수는 남겨 둔다 - 다음 드리프트가 생겼을 때 배선하는
 * 방법이 코드로 남아 있어야 한다. `divergences` 인자를 열어 둔 이유는
 * `test/unit/e2e/matrix.test.ts` 가 프로덕션 목록이 아니라 프로브 목록으로
 * 이 함수 자체를 구동하기 위해서다 - 목록이 비었다고 가드까지 헛돌면 다음에
 * 물릴 때 그것이 도는지 아무도 모른다.
 */
export function knownDivergenceReason(
  backend: BackendKind,
  test: string,
  divergences: readonly KnownDivergence[] = KNOWN_DIVERGENCES,
): string | undefined {
  return divergences.find(
    (divergence) => divergence.backend === backend && divergence.test === test,
  )?.reason
}

/**
 * "오늘 이 백엔드가 어디서 갈리는가"를 로그에 남긴다. `global-setup.ts` 가
 * 스택을 띄운 직후 한 번 부른다 - 매 실행(백엔드가 무엇이든)마다 이 백엔드에
 * 걸린 항목 전부가 로그에 찍힌다. **0건이어도 "0건"이라고 찍는다** - 침묵은
 * "안 돌았다"와 구별되지 않는다.
 */
export function reportKnownDivergences(
  backend: BackendKind,
  divergences: readonly KnownDivergence[] = KNOWN_DIVERGENCES,
): void {
  const matching = divergences.filter((divergence) => divergence.backend === backend)

  if (matching.length === 0) {
    console.log(`[matrix] ${backend}: 알려진 계약 드리프트 없음`)
    return
  }

  console.log(`[matrix] ${backend}: 알려진 계약 드리프트 ${matching.length}건`)
  for (const divergence of matching) {
    console.log(
      `[matrix]   - [${divergence.verified ? '실측' : '예상(미실측)'}, owner=${divergence.owner}] ${divergence.test}`,
    )
    console.log(`[matrix]     ${divergence.reason}`)
  }
}
