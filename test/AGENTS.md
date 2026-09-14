<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-14 -->

# test/ 작업 지침

세 하위 디렉터리가 서로 다른 것을 지킨다. **`test/unit/`**(순수 함수 - 각
하위 디렉터리가 `lib/`·`app/`의 대응하는 계층을 지키고, 자신의 `AGENTS.md`를
가진 곳은 그 파일이 로컬 계약을 소유한다)와 **`test/fixtures/`**(공유 JSON:API
문서, 자신의 `AGENTS.md` 보유)는 이 파일이 다루지 않는다. 이 파일은
**`test/e2e/`** - 실제 프로덕션 빌드 + 실제 백엔드(FastAPI·NestJS·Rails 중
하나) 위에서 브라우저를 돌리는, 요청 스코프 API(`cookies()`·`headers()`·
`redirect()`)를 스텁하지 않는 이 저장소의 관례 때문에 단위 테스트가
구조적으로 볼 수 없는 자리를 지키는 층 - 을 소유한다.

## `test/e2e/`의 파일별 역할

| 파일                                                                 | 역할                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stack.ts`                                                           | `docker-compose.e2e.yml` 기동·정리. 포트(`WEB_PORT`·`API_PORT`)와 백엔드 선택(`BACKEND_KIND`)의 정본.                                                                                                                                                                                                                         |
| `matrix.ts`                                                          | `BackendKind` 타입과 런타임 검증(`resolveBackendKind`), `KNOWN_DIVERGENCES`와 `reportKnownDivergences` - "오늘 이 백엔드가 정본과 어디서 갈리는가"를 실행마다 로그로 남긴다(0건이어도 "0건"을 찍는다).                                                                                                                        |
| `global-setup.ts`                                                    | Playwright 전체 실행 전 한 번 - 스택을 띄우고 `reportKnownDivergences`를 부른다.                                                                                                                                                                                                                                              |
| `global-teardown.ts`                                                 | 실패한 실행 뒤에도 돈다 - 스택을 내려 러너에 컨테이너를 남기지 않는다.                                                                                                                                                                                                                                                        |
| `fixtures.ts`                                                        | `consoleGuard`(선언되지 않은 콘솔 오류·경고·4xx/5xx를 자동으로 실패시키는 픽스처, `auto: true`)와 `provisionAndSignIn`(운영자 프로비저닝 + 화면을 통한 실제 로그인).                                                                                                                                                          |
| `probe-email.ts`                                                     | RFC 5321 로컬 파트 64자 상한을 지키며 접두사 + `randomUUID()`로 고유 이메일을 만드는 `probeEmail()`.                                                                                                                                                                                                                          |
| `seed/`                                                              | `docker-compose.e2e.yml`의 `seed-*` 서비스가 마이그레이션 직후 넣는 SQL. Rails만 분류·라벨·조인 테이블 이름이 달라(`example_categories`·`example_tags`·`example_taggings`) `examples.sql`(FastAPI·NestJS 공용)과 `examples.rails.sql` 두 벌이 있다 - 값을 바꾸면 **둘 다** 고친다(자동 동기화 없음, 근거는 `seed/README.md`). |
| `auth.spec.ts`·`bulk.spec.ts`·`examples.spec.ts`·`reference.spec.ts` | 네 시나리오 스위트 - 아래 "새 시나리오를 쓸 때" 참고. `reference.spec.ts` 는 읽기 전용 자원(분류)의 목록·상세와 선언에 없는 슬러그를 잰다 - 행을 만들지 않고 씨앗 분류 이름의 접두사 `프로브` 로 좁힌다.                                                                                                                      |

## 새 시나리오를 쓸 때 - 기존 세 파일이 실제로 따르는 규칙 셋

1. **실전값과 구별되는 값을 쓴다.** 픽스처가 기본값·정상 경로와 같은 값을
   쓰면 그 시나리오가 통과하는지 실패하는지가 같은 결과로 보인다 -
   "쟀다"는 착각만 남긴다. `auth.spec.ts`의 `RETURN_PATH`가 예다: 로그인 후
   복귀할 경로를 기본 로그인 목적지(`/`)로 잡으면 복귀가 되든 안 되든
   결과가 같아서, 보호 경로이면서 `/`가 아닌 값(`/examples/new?probe=e2e-return`)
   을 쓰고 쿼리 문자열까지 단다(proxy가 `pathname`뿐 아니라 `search`도
   싣는지까지 재려면 필요하다).
2. **이메일은 실행마다·테스트마다 고유해야 한다.** `probeEmail(prefix)`
   (`probe-email.ts`)를 쓴다 - 직접 문자열을 이어 붙이지 않는다. 중복
   가입은 409라 같은 이메일을 재사용하면 "새로 가입"과 "이미 있는 계정과
   충돌"이 조용히 다른 갈래를 타서 시나리오가 매번 다른 것을 재게 된다.
3. **목록·표 단언은 자기 접두사로 좁힌다.** 새 시나리오가 만드는 행이
   씨앗 데이터나 다른 시나리오가 만든 행과 섞이면 단언이 우연히 통과하거나
   우연히 실패한다. 그래서 각 스펙 파일이 자기 접두사 상수를 하나 선언하고
   (`examples.spec.ts`의 `SEED_PREFIX = 'probe-seed'`·`CREATE_PREFIX =
'probe-create'`, `bulk.spec.ts`의 `BULK_PREFIX = 'probe-bulk'`, `reference.spec.ts`의 `SEED_NAME_PREFIX = '프로브'`(행을 만들지 않아 씨앗 이름의 접두사를 그대로 쓴다)), 목록
   질의(`title=` 필터 등)와 화면 단언 양쪽을 그 상수로 좁힌다. **새 접두사는
   기존 셋과 겹치면 안 된다** - 접두사가 겹치면 한 시나리오가 만든 행이 다른
   시나리오의 단언에 끼어든다.

네 파일 다 이 셋을 공통 규칙으로 문서화해 두고 있다(각 파일 머리말의 "픽스처
규칙"·"씨앗과 격리" 절). 새 시나리오를 추가할 때 이 셋을 벗어나면, 그
시나리오가 실제로 무엇을 재는지부터 다시 확인한다.

## 이 저장소가 정직하게 포기한 것 - 재현 불가능한 상태를 지어내지 않는다

`bulk.spec.ts`의 "재시도" 절이 본이다: 실제 백엔드의 `DELETE`는 204 아니면
404뿐이라(`app/controllers/concerns/crud_actions.py`의 `destroy`), 재시도
버튼이 뜨는 조건(`retryable` 통에 오류가 있음)은 이 백엔드로는 **도달할 수
없다.** 그렇다고 422 같은 존재하지 않는 실패를 모킹으로 지어내 재현하지
않는다 - 대신 실제로 도달 가능한 절반("재시도 대상이 없을 때 버튼이 뜨지
않는다")만 E2E가 재고, 도달 불가능한 절반(`mergeRetryReport`, 재시도 클릭
자체)은 이미 그것을 지키는 단위 테스트(`test/unit/components/`)에 맡긴다.
새 시나리오도 같은 원칙을 따른다 - 백엔드가 실제로 내지 않는 응답을 전제로
한 테스트를 쓰지 않는다.

## Playwright 설정이 이 디렉터리에 강제하는 것

`playwright.config.ts`(저장소 루트)가 `retries: 0`·`workers: 1`을 고정한다 -
흔들리는 테스트를 재시도로 덮지 않는다(원인을 고친다는 뜻이다)는 것과, 모든
시나리오가 고유한 이메일을 쓰는 한 데이터가 이미 독립적이라 병렬이 굳이
필요하지 않다는 것을 반영한다. `CI` 환경 변수가 있으면 `forbidOnly: true`가
켜져 `test.only`가 남은 채로 커밋되면 CI가 실패한다.

## 검증과 의존성

`pnpm test:e2e`(Playwright)가 이 디렉터리를 돈다. 의존성은 `docker`(compose
v2 플러그인 포함)와 `lib/auth/provision.ts`(프로비저닝), `@/lib/jsonapi/client`
(직접 HTTP로 씨앗 행을 지우는 `bulk.spec.ts`)다. 최종 검증은
`./scripts/check.sh`의 `[9/9]`(로컬 게이트는 정본 FastAPI 하나만 돈다 - 세
백엔드 매트릭스는 `.github/workflows/ci.yml` 전용).

<!-- MANUAL: 이 아래의 수동 메모는 갱신 시 보존한다. -->
