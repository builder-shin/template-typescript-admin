# template-typescript-admin

FastAPI · NestJS · Rails 세 백엔드 템플릿이 공유하는 JSON:API 1.1 계약을
**운영자 관점**에서 소비하는 Next.js 어드민 템플릿이다. 전환은 `BACKEND_URL`
하나이고 어댑터 계층이 없다 - 세 백엔드의 공개 계약이 통일되어 있으므로 이
앱도 어느 백엔드를 상대하는지 몰라도 된다.

고객용 템플릿(`template-typescript-nextjs`)과 갈라지는 지점은 화면의 밀도와
작업 단위다. 이 템플릿이 실증하는 것은 계약이 아니라 **계약 위에 세운 운영
UX** - 열 구성, 다중 선택과 일괄 작업, 살아있는 필터 뷰, 인라인 편집이다. 왜
이런 설계인지는 `docs/superpowers/specs/2026-09-12-admin-template-design.md`가,
계층별 계약은 루트 `AGENTS.md`와 각 디렉터리의 `AGENTS.md`가 소유한다.

## 들어 있는 것

- **Next.js 16**(App Router) · React 19 · TypeScript, Tailwind v4 + shadcn
  (`base-nova` 스타일).
- `lib/jsonapi/`·`lib/auth/`·`lib/config/`·`proxy.ts` - `template-typescript-nextjs`에서
  복사한 JSON:API 코어(문서 파싱·세션·설정). 출처 커밋은
  `docs/provenance/copied-core.json`.
- `lib/resources/`·`lib/grid/`·`lib/bulk/`·`lib/form/` - 이 저장소가 새로 설계한 계층.
  자원 선언, URL ↔ 질의 변환(TanStack Table v9를 서버 구동으로), 일괄 실행기,
  폼 ↔ JSON:API 쓰기 문서 변환.
- `components/grid/`·`components/resource/` - 선언을 읽어 그리는 획일 그리드·폼·상세
  부품. 자원 이름을 모른다.
- `app/(admin)/[slug]/` - 선언된 자원 전부의 목록·생성·상세 화면 한 벌. 자원마다
  라우트 파일을 만들지 않는다(아래 "새 자원 더하기").
- shadcn `dashboard-01` 블록 - 사이드바 셸, 대시보드 카드·차트·표. 데이터
  배선은 실제 계약으로 갈아끼웠다(아래 "화면" 참고). 드래그 정렬(`@dnd-kit/*`)과
  대시보드 차트는 **표본으로 남아 있다** - 이유는 아래와 루트 `AGENTS.md`.
- 단위 테스트(`test/unit/`, `vitest`)와 실제 백엔드 E2E(`test/e2e/`,
  `playwright`, 모킹 없음).
- 단일 게이트 `./scripts/check.sh` (아홉 단계)와 세 백엔드 CI 매트릭스
  (`.github/workflows/ci.yml`, CI 전용).

## 시작하기

```bash
pnpm install
cp .env.example .env.local   # BACKEND_URL 을 실제 백엔드 주소로 채운다
pnpm dev
```

이 저장소는 백엔드를 담고 있지 않다 - `BACKEND_URL`이 가리킬 FastAPI·NestJS·
Rails 백엔드가 이미 실행 중이어야 한다. 로컬에 백엔드가 없다면
`docker-compose.e2e.yml`로 하나를 띄울 수 있다(예: FastAPI). **서비스
이름을 명시한다** - 이름 없이 `up`만 부르면 `web`(이 저장소 자신의
컨테이너)도 함께 떠서 `pnpm dev`와 포트 3000이 충돌한다:

```bash
docker compose --profile fastapi -f docker-compose.e2e.yml \
  up db redis migrate-fastapi api-fastapi seed-fastapi
# BACKEND_URL=http://localhost:4100 (기본 E2E_API_PORT)
```

첫 화면(`/login`)에 로그인하려면 운영자 계정이 필요하다 - 아래 "첫 운영자
만들기" 참고.

## 환경 변수

**필수 변수에 암묵적 기본값을 두지 않는다.** `BACKEND_URL`이 없으면 앱이
시작에 실패한다 - 첫 요청에서야 드러나는 설정 오류보다 시작 실패가 낫다.
백엔드 템플릿들의 `DATABASE_URL`과 같은 계약이다. **정본은
`lib/config/settings.ts`다** - 이 표·그 파일·`.env.example`이 거울이므로
값을 바꿀 때 셋을 함께 고친다.

### 앱이 읽는 변수

| 변수                    | 필수   | 기본값                      | 무엇                                                             |
| ----------------------- | ------ | --------------------------- | ---------------------------------------------------------------- |
| `BACKEND_URL`           | 예     | 없음                        | 백엔드 API의 절대 URL(`http://`/`https://`). 끝 슬래시는 잘린다. |
| `SESSION_COOKIE_SECURE` | 아니오 | `NODE_ENV === 'production'` | 세션 쿠키의 `Secure` 속성. `"true"`/`"false"`만 받는다.          |

### E2E만 읽는 변수

**앱은 이 다섯을 하나도 모른다.** `pnpm test:e2e`(Playwright)와 그 하네스
(`test/e2e/stack.ts`·`test/e2e/matrix.ts`)만 읽는다.

| 변수             | 필수   | 기본값       | 무엇                                                                                             |
| ---------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------ |
| `E2E_WEB_PORT`   | 아니오 | `3000`       | 이 앱의 프로덕션 빌드가 호스트에 공개되는 포트. `pnpm dev`가 3000을 쓰고 있으면 옮긴다.          |
| `E2E_API_PORT`   | 아니오 | `4100`       | 활성 프로파일의 백엔드가 호스트에 공개되는 포트.                                                 |
| `BACKEND_KIND`   | 아니오 | `fastapi`    | `fastapi`\|`nestjs`\|`rails` 중 하나 - 알려진 값이 아니면 던진다(도커를 건드리기 전에).          |
| `E2E_KEEP_STACK` | 아니오 | 없음(내린다) | `1`이면 실행 뒤 스택을 내리지 않는다 - 조사용. 직접 내려야 다음 실행이 포트 충돌 없이 돈다.      |
| `CI`             | 아니오 | 없음         | 있으면 `forbidOnly`가 켜져 `test.only`가 남은 채면 실패한다. GitHub Actions가 자동으로 설정한다. |

## 화면

경로의 정본은 `app/`의 파일 배치이고, 인증 필요 여부의 정본은 `proxy.ts`의
`PROTECTED_PATH_PATTERNS`다.

| 경로           | 인증 | 내용                                                                                    |
| -------------- | ---- | --------------------------------------------------------------------------------------- |
| `/`            | 필요 | 대시보드 - 자원마다 카운트 카드·헬스 상태·최근 목록(표본 차트 하나 제외 전부 실제 배선) |
| `/[slug]`      | 필요 | 선언된 자원의 목록 - 열 구성·필터 뷰. `writable` 이면 다중 선택·일괄 삭제·새로 만들기   |
| `/[slug]/new`  | 필요 | 생성. `writable` 이 아니면 404                                                          |
| `/[slug]/[id]` | 필요 | 상세. `writable` 이면 인라인 편집·삭제, 아니면 저장된 값만                              |
| `/login`       | 공개 | 로그인                                                                                  |

`slug` 는 선언의 것이다 - 오늘은 `examples`·`categories`·`tags` 셋
(`lib/resources/index.ts`). 선언에 없는 슬러그는 404 다.

**공개 표면은 `/login` 하나뿐이다** - 나머지 전부는 익명 접근에서
`/login?next=<원래 경로>`로 보내진다(로그인 성공 후 그 경로로 복귀한다).
가입 화면(`/register`)은 없다 - 운영자는 스스로 가입하지 않는다(아래 "첫
운영자 만들기").

## 새 자원 더하기

두 단계다. `app/` 에는 아무것도 만들지 않는다.

1. `lib/resources/<이름>.ts` 에 선언을 적는다 - `lib/resources/example.ts`
   가 본이다. 열·필터·정렬·include 는 백엔드 소스에서 실측해 옮겨 적는다.
2. `lib/resources/index.ts` 의 `RESOURCES` 배열에 한 줄 더한다.

그러면 `/<slug>` 목록, `/<slug>/new` 생성, `/<slug>/<id>` 상세와 사이드바
항목·대시보드 카드가 생긴다. 읽기 전용 자원(`writable: false`)도 목록·상세를
갖고 쓰기 UI 만 빠진다. 아래는 **예시**다 - `notes` 라는 자원은 세 백엔드에
없다:

```ts
// lib/resources/note.ts
import { defineResource, type ResourceDef } from './define'

export const notesResource: ResourceDef = defineResource({
  type: 'notes',
  slug: 'notes',
  path: '/api/v1/notes',
  label: '메모',
  heading: 'subject',
  writable: true,
  attributes: {
    subject: { kind: 'string', label: '제목', nullable: false, readOnly: false },
    body: { kind: 'text', label: '본문', nullable: true, readOnly: false },
    createdAt: { kind: 'datetime', label: '생성일', nullable: false, readOnly: true },
  },
  relationships: {},
  columns: [
    { key: 'subject', sortable: true },
    { key: 'createdAt', sortable: true },
  ],
  filters: [{ key: 'subject', operators: ['exact', 'contains'], uiOperator: 'contains' }],
  sorts: ['subject', 'createdAt'],
  includes: [],
})
```

```ts
// lib/resources/index.ts
export const RESOURCES: readonly ResourceDef[] = Object.freeze([
  examplesResource,
  exampleCategoriesResource,
  exampleTagsResource,
  notesResource, // ← 이 한 줄
])
```

선언의 자기 정합성(slug 유일, `heading` 이 속성 안에 있음, 열·필터 키가
선언 안에 있음 등 아홉)은 `test/unit/resources/index.test.ts` 가 모든
자원에 대해 잰다 - 잘못 적으면 `pnpm test` 에서 드러난다.

특정 자원의 화면을 다르게 그리고 싶으면 `app/(admin)/<slug>/` 정적 폴더를
만든다 - 정적 세그먼트가 `[slug]` 를 이긴다(`app/AGENTS.md` 의 실측). 그
폴더는 자기 `loading.tsx` 도 스스로 가져야 한다.

## 첫 운영자 만들기

백엔드에는 관리자용 계정 생성 경로가 없다(`users`는 `GET /me`만 노출한다) -
그래서 첫 운영자는 `POST /auth/register`를 한 번 호출하는 시드 스크립트로
만든다. 이 스크립트는 Next 런타임 없이 `node`로 직접 실행되므로 `.env.local`을
자동으로 읽지 않는다 - `BACKEND_URL`을 명령 앞에 직접 준다:

```bash
BACKEND_URL=http://localhost:4100 pnpm seed:operator admin@example.com "a-strong-password"
```

이미 있는 계정으로 재실행해도 안전하다(409를 오류로 취급하지 않고 0으로
끝난다). `test/e2e/`도 같은 함수(`lib/auth/provision.ts`의
`provisionOperator`)를 불러 매 실행마다 운영자를 만든다 - 이 절차가 문서에만
있는 죽은 절차가 되지 않는다. 시드가 깨지면 게이트가 빨개진다.

## 백엔드 전환

`BACKEND_URL` 하나만 바꾸면 된다 - 코드를 고치지 않는다.

```bash
# FastAPI / NestJS / Rails 모두 각 백엔드 저장소를 단독으로 띄우면 기본 포트가 같다
BACKEND_URL=http://localhost:4000
```

`docker-compose.e2e.yml`로 세 백엔드 중 하나를 골라 띄울 때는
`--profile fastapi`\|`nestjs`\|`rails`를 준다(자세한 내용은
`docker-compose.e2e.yml` 머리말과 `test/AGENTS.md`).

## 검증

유일한 게이트는 `./scripts/check.sh`다(아홉 단계 - typecheck·lint·format·
secretlint·인용·출처·unit·build·compose·e2e). 로컬 게이트는 정본 FastAPI
하나로만 돈다 - 매번 세 스택을 띄우면 개발 흐름이 막힌다. 세 백엔드 비교는
CI 전용이다(`.github/workflows/ci.yml`, `.github/AGENTS.md`).

```bash
pnpm check           # == ./scripts/check.sh
pnpm test            # 단위만
pnpm test:e2e        # E2E만(정본 FastAPI가 이미 떠 있지 않아도 된다 - 하네스가 직접 띄운다)
```

## 3-백엔드 검증 결과

CI 매트릭스(`.github/workflows/ci.yml`)가 push·PR 마다 세 백엔드 각각에
`pnpm test:e2e` 를 돈다 - 현재 결과는 그 워크플로의 최근 실행이 정본이다.
아래는 사람이 손으로 돌려 확인한 마지막 결과다(각 행의 날짜 기준).

| 백엔드          | 확인일     | 커밋(`main`) | 통과  | 알려진 계약 드리프트 |
| --------------- | ---------- | ------------ | ----- | -------------------- |
| `fastapi`(정본) | 2026-09-14 | `3c4eee3`    | 15/15 | 0건                  |
| `nestjs`        | 2026-09-14 | `4d49f3a`    | 15/15 | 0건                  |
| `rails`         | 2026-09-14 | `231576e`    | 15/15 | 0건                  |

알려진 드리프트 목록의 정본은 `test/e2e/matrix.ts`의 `KNOWN_DIVERGENCES`다 -
비어 있어도 매 실행이 "0건"을 로그로 남긴다(침묵은 "안 돌았다"와
구별되지 않는다). 새 드리프트가 생기면 그 파일의 머리말이 절차를 적어 둔다.
