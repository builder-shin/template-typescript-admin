<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# .github/ 작업 지침

`workflows/ci.yml` 하나를 둔다 - 로컬 게이트(`./scripts/check.sh`, 정본
FastAPI 하나)가 하지 않는 **3-백엔드 비교**를 CI에서만 돈다(스펙 8.3: 매번
세 스택을 띄우면 로컬 개발 흐름이 막힌다).

## 잡 둘

| 잡           | 무엇을 하나                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gate`       | `./scripts/check.sh`를 그대로 한 번 - 아홉 단계 전부, 정본 FastAPI. 컨트리뷰터가 로컬에서 돌리는 것과 동일하다.                                       |
| `e2e-matrix` | `gate`가 통과한 뒤(`needs: gate`)에만 돈다. `fastapi`·`nestjs`·`rails` 세 갈래를 `fail-fast: false`로 - 한 백엔드가 실패해도 나머지 둘의 결과를 본다. |

`e2e-matrix`가 `gate` 뒤에 도는 이유는 게이트 자신의 단계 순서와 같은
근거다(`scripts/AGENTS.md`) - 정적 검사에서 이미 죽을 변경을 세 백엔드 스택을
띄워 가며 다시 확인할 이유가 없다.

## 툴체인 버전 - `package.json`이 유일한 정본

워크플로에 Node·pnpm 버전 숫자를 두 번째로 적지 않는다. 각 잡의 "툴체인
설치" 스텝이 `package.json`을 읽는다:

- **Node** - `actions/setup-node`의 `node-version-file: package.json`.
  **확인한 것**(작성 시점, `actions/setup-node` 저장소의
  `docs/advanced-usage.md`와 `src/util.ts`·`src/distributions/base-distribution.ts`):
  `package.json`을 가리키면 이 액션은 `volta.node` → `devEngines.runtime` →
  **`engines.node`** 순으로 필드를 찾고, 찾은 문자열을 그대로 `semver.satisfies()`의
  range 인자로 넘긴다 - 즉 `engines.node`가 `">=24.11.0"`처럼 등호 없는
  범위여도(정확한 버전 하나가 아니어도) 올바르게 해석된다. 이 저장소는
  `volta`·`devEngines`가 없으므로 `engines.node`(`">=24.11.0"`)가 그대로
  쓰인다.
- **pnpm** - `pnpm/action-setup`을 `version:` 없이 쓴다. **확인한 것**(같은
  시점, `pnpm/action-setup` 저장소 README): `version` 입력을 생략하면
  `package.json`의 `packageManager`(pnpm v11 이상일 때)를 그대로 읽는다 -
  이 저장소의 `packageManager`(`"pnpm@11.22.0"`)가 그 조건을 만족한다.

두 액션 다 이 저장소가 이미 가진 값 하나만 읽으므로, `package.json`을 올리면
워크플로를 고치지 않아도 다음 실행부터 새 버전을 쓴다.

## Playwright 브라우저 설치

`pnpm exec playwright install --with-deps chromium`을 두 잡 모두에 둔다 -
브라우저 바이너리는 `pnpm install`(의존성 설치)에 딸려 오지 않는다.
`--with-deps`는 Playwright 공식 CI 가이드가 권하는 대로 헤드리스 실행에
필요한 OS 패키지까지 함께 받는다(러너마다 사전 설치 여부가 다를 수 있어
근거로 삼지 않는다).

## `CI` 환경 변수

GitHub Actions가 모든 잡에 `CI=true`를 자동으로 준다 - 워크플로가 따로 설정할
필요가 없다. `playwright.config.ts`가 `process.env.CI`를 읽어 `forbidOnly`를
켜므로, `test.only`가 남은 채 커밋되면 CI에서만 실패한다(로컬은 실수로 그
상태로 통과할 수 있다는 뜻이기도 하다 - 커밋 전에 직접 확인한다).

## 실패 시 산출물

두 잡 다 `if: failure()`로 `playwright-report/`·`test-results/`를
업로드한다. `e2e-matrix`는 매트릭스이므로 산출물 이름에 갈래를 넣는다
(`playwright-report-${{ matrix.backend }}`) - 넣지 않으면 세 실행이 같은
이름으로 덮어써 마지막 것만 남는다. 이것이 없으면 CI가 빨간불일 때 손에
남는 것이 로그 한 덩어리뿐이고, 로컬에서는 재현되지 않는 갈래가 하필 잘
깨지는 갈래다(Rails는 Host 검사·별도 DB 이름·`development` 스테이지를 혼자
갖는다 - `docker-compose.e2e.yml` 머리말 참고).

## `timeout-minutes`

두 잡 다 20분으로 유한하게 잡는다. 백엔드를 git URL에서 빌드하고(캐시가 없는
새 러너에서는 매번 처음부터) 스택이 뜨기를 기다리는 구조라, 준비 대기가
걸리면 기본 한도(6시간)까지 러너를 붙잡는다.

## 검증

이 워크플로 자체를 검사하는 자동 게이트는 없다 - `.github/`는
`scripts/check-citations.sh`의 검사 대상 밖이다(대상은 `app`·`components`·
`lib`·`test`·`proxy.ts`뿐, 근거는 `scripts/AGENTS.md`). 고칠 때 같은 규칙
(사라질 자리를 인용하지 않는다)을 손으로 지킨다. 워크플로 자신의 정확성은
실제 실행(GitHub Actions 탭)으로 확인한다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
