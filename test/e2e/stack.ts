/**
 * E2E 스택의 기동과 정리 - `docker-compose.e2e.yml` 하나만 다룬다.
 *
 * 모킹 계층 없이 **실제 백엔드**(Postgres + 마이그레이션 + FastAPI·NestJS·
 * Rails 중 하나 - `BACKEND_KIND` 가 고른다, 기본은 정본 FastAPI)와 **실제
 * 프로덕션 빌드**(`Dockerfile` 의 `runtime` 타깃)를 띄우고 그 위로 브라우저를
 * 돌린다.
 *
 * ## 왜 Playwright 의 `webServer` 가 아니라 globalSetup 인가
 *
 * `webServer` 는 프로세스 하나를 띄우고 URL 이 응답하면 넘어가는 계약이다.
 * `docker compose up --wait` 는 **떠 있는 프로세스가 아니라** 헬스체크가 전부
 * 통과하면 종료하는 명령이라, Playwright 가 "서버가 죽었다"로 볼 수 있고
 * 무엇보다 정리(`down -v`)를 걸 자리가 없다 - Playwright 는 자기가 띄운 자식
 * 프로세스를 죽일 뿐 컨테이너를 모른다. globalSetup/globalTeardown 으로 두면
 * 기동과 정리가 같은 파일에서 짝을 이룬다.
 *
 * ## 포트를 한 곳에서만 정한다
 *
 * `WEB_PORT` 가 정본이고, 이 파일이 그 값을 `E2E_WEB_PORT` 로 compose 자식
 * 프로세스에 **명시적으로 넘긴다.** compose 파일 쪽 `${E2E_WEB_PORT:-3000}`
 * 의 기본값은 사람이 손으로 `docker compose up` 할 때만 쓰인다 - 즉 이
 * 하네스가 도는 동안 두 기본값이 서로 어긋날 여지가 없다.
 *
 * 개발 서버(`pnpm dev`)가 이미 3000 을 쓰고 있으면 `E2E_WEB_PORT` 로 옮겨라.
 * 충돌은 조용하지 않다 - compose 가 "port is already allocated" 로 죽는다.
 *
 * `API_PORT` 도 같은 관용구를 따른다 - 활성 프로파일의 `api-*` 컨테이너만
 * 호스트에 포트를 공개하고, 세 프로파일 모두 같은 변수(`E2E_API_PORT`)·같은
 * 기본값을 쓰므로 이 파일은 어느 백엔드가 떠 있는지 몰라도 된다.
 *
 * `BACKEND_KIND` 가 프로파일을 고른다. 기본값은 `fastapi` - 로컬 게이트
 * (`./scripts/check.sh`)가 오늘처럼 인자 없이 돌아야 한다. `docker-compose.e2e.yml`
 * 의 `migrate-*`·`api-*`·`seed-*` 서비스는 각각 이 이름과 같은 compose profile
 * 에 묶여 있고, 이 파일은 그 값을 그대로 `COMPOSE_PROFILES` 로 compose 자식
 * 프로세스에 넘긴다. 타입(`BackendKind`)과 런타임 검증, `KNOWN_DIVERGENCES` 는
 * `test/e2e/matrix.ts` 가 갖는다 - 아래 `BACKEND_KIND` 상수가 그 파일의
 * `resolveBackendKind` 를 그대로 부른다(잘못된 값이면 이 모듈을 불러오는
 * 시점에 던진다 - 이유는 `matrix.ts` 머리말).
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveBackendKind } from './matrix'

/** 이 파일은 `<루트>/test/e2e/stack.ts` 다 - 두 계단 위가 저장소 루트다. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const COMPOSE_FILE = 'docker-compose.e2e.yml'

/** 호스트에 퍼블리시할 `web` 포트. playwright.config.ts 의 baseURL 이 이 값을 쓴다. */
export const WEB_PORT = process.env.E2E_WEB_PORT ?? '3000'

export const BASE_URL = `http://127.0.0.1:${WEB_PORT}`

/**
 * 호스트에 퍼블리시할 백엔드(`api-fastapi`/`api-nestjs`/`api-rails` 중 활성
 * 프로파일의 것) 포트. 점유된 호스트 포트 밖에서 고른 기본값은
 * `docker-compose.e2e.yml` 의 같은 이름 절 참고. 이 저장소의 스펙 파일은
 * 전부 브라우저를 거쳐 `web`(→ 별칭 `api`)로만 백엔드에 닿지만, 값은
 * 완전성을 위해 노출해 둔다 - `docker-compose.e2e.yml` 이 이미 포트를 공개해
 * 두었고, 세 프로파일 매트릭스를 다루는 다음 태스크가 호스트에서 백엔드에
 * 직접 닿을 자리가 필요해질 수 있다.
 */
export const API_PORT = process.env.E2E_API_PORT ?? '4100'

export const BACKEND_BASE_URL = `http://127.0.0.1:${API_PORT}`

/**
 * 띄울 백엔드. `docker-compose.e2e.yml` 의 `migrate-*`·`api-*`·`seed-*` 서비스가
 * 같은 이름의 compose profile 에 묶여 있다 - 이 값이 곧 그 profile 이름이다.
 *
 * `matrix.ts` 의 `resolveBackendKind` 로 검증한다 - 이 줄 자체가 검증이다:
 * 알려진 셋(`fastapi`·`nestjs`·`rails`) 밖의 값이면 이 모듈을 불러오는 시점에
 * 던져서 `startStack()` 이 컨테이너를 하나도 안 띄운 채로 죽는다(이유는
 * `matrix.ts` 머리말 - `COMPOSE_PROFILES` 오타는 도커 차원에서는 조용히
 * 부분 스택으로 해석된다).
 */
export const BACKEND_KIND = resolveBackendKind(process.env.BACKEND_KIND)

function compose(args: string[], stdio: 'inherit' | 'ignore' = 'inherit'): void {
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: REPO_ROOT,
    stdio,
    env: {
      ...process.env,
      E2E_WEB_PORT: WEB_PORT,
      E2E_API_PORT: API_PORT,
      COMPOSE_PROFILES: BACKEND_KIND,
    },
  })
}

/**
 * 스택을 띄우고 전부 healthy/completed 가 될 때까지 기다린다.
 *
 * `build web` 을 먼저 부르는 이유: `up` 은 이미지가 **없을 때만** 빌드하므로,
 * 그것만으로는 방금 고친 코드가 아니라 지난번 이미지를 상대로 E2E 가 돈다 -
 * 초록인데 틀린 가장 나쁜 모양이다. `web` 은 이 저장소 코드를 빌드하는 유일한
 * 서비스라 이름이 프로파일과 무관하게 고정이다. 백엔드(`api-*`·`migrate-*`)는
 * git 컨텍스트라 매번 다시 받으면 느려서 `up` 의 "없으면 빌드"에 맡긴다.
 * 활성 프로파일 백엔드의 최신 main 을 다시 받으려면
 * `COMPOSE_PROFILES=<fastapi|nestjs|rails> docker compose -f docker-compose.e2e.yml build --pull`.
 *
 * `up` 이 실패하면 반쯤 뜬 컨테이너가 남는다. Playwright 는 globalSetup 이
 * 던지면 globalTeardown 을 부르지 않으므로 여기서 직접 내린다 - 안 그러면
 * 다음 실행이 포트 충돌로 죽고, 원인이 이번 실패라는 것이 드러나지 않는다.
 */
export function startStack(): void {
  try {
    compose(['build', 'web'])
    compose(['up', '--wait', '--remove-orphans'])
  } catch (error) {
    stopStack()
    throw error
  }
}

/**
 * 스택을 내린다. `-v` 로 익명 볼륨까지 지운다.
 *
 * 프로젝트 이름은 compose 파일이 `name:` 으로 고정한다 - 이 명령은 그
 * 프로젝트만 건드린다(같은 도커 데몬 위의 다른 스택은 손대지 않는다).
 *
 * 조사용으로 스택을 남기려면 `E2E_KEEP_STACK=1`. 남긴 스택은 직접 내려야
 * 하고, 그 전까지 다음 실행이 포트 충돌로 죽는다.
 *
 * **정리 명령에 프로파일을 함께 줘야 한다.** `down` 은 활성 프로파일에 속한
 * 서비스만 내리므로, 프로파일 없이 부르면 `db`·`redis`·`web` 만 지워지고
 * `migrate-*`·`api-*`·`seed-*` 가 남는다. 자동 teardown 은 `compose()` 가
 * `COMPOSE_PROFILES` 를 넘기므로 안전하고, 사람이 손으로 부르는 아래 안내
 * 문구만 그것을 빠뜨리지 않도록 직접 적어 준다.
 */
export function stopStack(): void {
  if (process.env.E2E_KEEP_STACK === '1') {
    console.warn(
      `[e2e] E2E_KEEP_STACK=1 - 스택을 남긴다. 정리: COMPOSE_PROFILES=${BACKEND_KIND} docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`,
    )
    return
  }
  compose(['down', '-v', '--remove-orphans'])
}
