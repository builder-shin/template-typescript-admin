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
  라우트 파일을 만들지 않는다(아래 "쓰는 법").
- shadcn `dashboard-01` 블록 - 사이드바 셸, 대시보드 카드·차트·표. 데이터
  배선은 실제 계약으로 갈아끼웠다(아래 "화면" 참고). 드래그 정렬(`@dnd-kit/*`)과
  대시보드 차트는 **표본으로 남아 있다** - 이유는 아래와 루트 `AGENTS.md`.
- 단위 테스트(`test/unit/`, `vitest`)와 실제 백엔드 E2E(`test/e2e/`,
  `playwright`, 모킹 없음).
- 단일 게이트 `./scripts/check.sh` (아홉 단계)와 세 백엔드 CI 매트릭스
  (`.github/workflows/ci.yml`, CI 전용).

## 시작하기

다섯 단계다. 백엔드가 이미 떠 있으면 셋째는 건너뛴다.

1. 의존성을 설치한다.

   ```bash
   pnpm install
   ```

2. 환경 파일을 만들고 `BACKEND_URL` 을 백엔드 주소로 채운다(아래 "환경 변수").

   ```bash
   cp .env.example .env.local
   ```

3. 백엔드를 띄운다. 이 저장소는 백엔드를 담고 있지 않다 - `BACKEND_URL` 이
   가리킬 FastAPI·NestJS·Rails 백엔드가 이미 실행 중이어야 한다. 로컬에
   백엔드가 없다면 `docker-compose.e2e.yml` 로 하나를 띄울 수 있다(예:
   FastAPI). **서비스 이름을 명시한다** - 이름 없이 `up` 만 부르면 `web`(이
   저장소 자신의 컨테이너)도 함께 떠서 `pnpm dev` 와 포트 3000 이 충돌한다.

   ```bash
   docker compose --profile fastapi -f docker-compose.e2e.yml \
     up db redis migrate-fastapi api-fastapi seed-fastapi
   # 이때 BACKEND_URL=http://localhost:4100 (기본 E2E_API_PORT)
   ```

4. 첫 운영자를 만든다. 가입 화면이 없으므로 시드 스크립트로 만든다(자세한
   것은 아래 "첫 운영자 만들기").

   ```bash
   BACKEND_URL=http://localhost:4100 pnpm seed:operator admin@example.com "a-strong-password"
   ```

5. 개발 서버를 띄우고 `http://localhost:3000/login` 에서 그 계정으로
   로그인한다.

   ```bash
   pnpm dev
   ```

로그인하면 대시보드(`/`)가 뜨고 사이드바에 선언된 자원이 나열된다 - 오늘은
예제·분류·라벨 셋이다. 화면에서 무엇을 할 수 있고 자원을 어떻게 더하는지는
아래 "쓰는 법"이 적는다.

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

`slug` 는 선언의 것이다 - 오늘은 `examples`·`categories`·`tags`
셋(`lib/resources/index.ts`). 선언에 없는 슬러그는 "찾을 수 없음"
화면이다(응답 상태는 스트리밍이라 200 - `app/AGENTS.md`).

**공개 표면은 `/login` 하나뿐이다** - 나머지 전부는 익명 접근에서
`/login?next=<원래 경로>`로 보내진다(로그인 성공 후 그 경로로 복귀한다).
가입 화면(`/register`)은 없다 - 운영자는 스스로 가입하지 않는다(아래 "첫
운영자 만들기").

## 쓰는 법

이 템플릿의 작업 단위는 **자원 선언**이다. `lib/resources/<이름>.ts` 파일
하나에 자원의 타입·경로·속성·관계·열·필터를 데이터로 적으면 목록·생성·상세
화면과 사이드바 항목·헤더 제목·대시보드 카드가 그 선언에서 나온다. 자원마다
화면 코드를 쓰지 않는다 - `app/(admin)/[slug]/` 한 벌이 선언된 자원 전부를
그린다. react-admin 의 `<Resource>`·`<Datagrid>`·`<SimpleForm>` 이 하는 일을
선언 하나가 대신하되, JSX 가 아니라 데이터다(왜 그쪽을 골랐는지는
`docs/superpowers/specs/2026-09-14-declarative-resources-design.md` 3장).

### 무엇을 적으면 무엇이 생기나

| 선언에 적는 것  | 화면에 생기는 것                                                                              |
| --------------- | --------------------------------------------------------------------------------------------- |
| `label`         | 사이드바 항목, 헤더 제목(`<label>` · `<label> 만들기` · `<label> 상세`), 대시보드 카운트 카드 |
| `slug`          | `/<slug>`(목록) · `/<slug>/new`(생성) · `/<slug>/<id>`(상세)                                  |
| `path` · `type` | 백엔드 요청 경로와 쓰기 문서의 `data.type` - 화면은 이 둘로만 백엔드를 안다                   |
| `heading`       | 상세 제목, 관계 배지와 선택 목록에 보이는 이름                                                |
| `writable`      | 선택 열·일괄 삭제·"새로 만들기"·생성 화면·수정 폼·위험 구역 - 거짓이면 전부 빠진다            |
| `attributes`    | 폼 필드(`readOnly` 가 아닌 것)와 "저장된 값"(`readOnly` 인 것), 열·필터의 표현                |
| `relationships` | 목록·상세의 배지, 폼의 드롭다운(to-one)·체크박스(to-many), `관계.id` 필터의 보기 목록         |
| `columns`       | 열과 그 순서, 정렬 버튼(`sortable`), "열" 메뉴의 숨기기 항목                                  |
| `filters`       | 필터 바 - 컨트롤은 속성 종류에서, 백엔드로 나가는 연산자는 `uiOperator` 에서                  |
| `sorts`         | URL 의 `sort` 로 받아들이는 필드 목록                                                         |
| `includes`      | 목록·상세 요청에 실리는 `include` - 관계 이름이 배지에 뜨려면 여기 있어야 한다                |

### 새 자원 더하기

두 단계다. `app/` 에는 아무것도 만들지 않는다.

1. `lib/resources/<이름>.ts` 에 선언을 적는다 - `lib/resources/example.ts`
   가 본이다(속성 종류 다섯과 관계 둘을 전부 쓴다). 열·필터·정렬·include 는
   백엔드 소스에서 실측해 옮겨 적는다.
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

선언의 자기 정합성은 `pnpm test` 가 모든 자원에 대해 잰다 - 잘못 적으면 거기서
드러난다(아래 "선언이 틀리면 어디서 드러나나").

### 선언 항목

| 항목            | 뜻                                                                                                    | 지켜야 할 것                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `type`          | JSON:API 자원 타입 - 응답 문서의 `data.type` 과 같아야 한다                                           | 다른 자원의 관계가 `type` 으로 이 자원을 가리킨다                                                            |
| `slug`          | 화면 URL 의 첫 세그먼트                                                                               | 자원 사이에 유일하고 `^[a-z][a-z0-9-]*$` 에 맞는다                                                           |
| `path`          | 백엔드 경로(`/api/v1/notes`)                                                                          | `type` 에서 유도하지 않는다 - `exampleCategories` 의 경로는 `/api/v1/categories` 다                          |
| `label`         | 사람이 읽는 자원 이름                                                                                 |                                                                                                              |
| `heading`       | 한 건을 대표하는 속성 키                                                                              | `attributes` 안에 있어야 한다                                                                                |
| `writable`      | 백엔드에 이 자원의 쓰기 라우트(POST·PATCH·DELETE)가 있는가                                            | 속성의 `readOnly` 와 층위가 다르다(아래 "세 플래그")                                                         |
| `attributes`    | 속성 키 → `{ kind, label, nullable, readOnly }`, `enum` 은 `values` 를 더한다                         | 넷 다 필수 - 기본값에 숨지 않는다. 적은 순서가 폼과 "저장된 값"의 순서다                                     |
| `relationships` | 관계 키 → `{ cardinality: 'one', type, label, nullable }` 또는 `{ cardinality: 'many', type, label }` | `type` 은 `RESOURCES` 에 있는 자원의 `type` 이어야 한다                                                      |
| `columns`       | `{ key, sortable }` 의 배열                                                                           | 비어 있지 않고, 키는 속성 또는 관계. `sortable` 이면 `sorts` 에도 있어야 한다                                |
| `filters`       | `{ key, operators, uiOperator }` 의 배열                                                              | 키는 속성 키 또는 `관계.id`. `operators` 는 백엔드가 허용한 연산자 전부의 거울, `uiOperator` 는 그 안의 하나 |
| `sorts`         | 백엔드가 정렬을 받는 필드 이름                                                                        | 백엔드 허용 목록의 거울 - 화면이 바라는 목록이 아니다                                                        |
| `includes`      | 목록·상세 요청에 `include` 로 실을 관계 키                                                            | `relationships` 의 키                                                                                        |

열의 라벨·표현과 필터의 라벨·보기 목록은 적지 않는다 - 속성·관계 선언에서
유도된다(`defineResource`). 같은 라벨을 두 번 적을 자리가 없다.

### 속성 종류 `kind` 가 정하는 것

| `kind`     | 목록 셀                | 폼 컨트롤                                        | 필터 컨트롤                 | 비운 채 저장하면                                                                                            |
| ---------- | ---------------------- | ------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `string`   | 텍스트                 | 한 줄 입력                                       | 텍스트                      | `nullable` 이면 `null`, 아니면 `''` 를 보내 백엔드가 그 필드 아래 필수 오류를 낸다                          |
| `text`     | 텍스트                 | 여러 줄 입력                                     | 텍스트                      | 위와 같다                                                                                                   |
| `enum`     | 배지(와이어 값 그대로) | 드롭다운(`values` 그대로, 생성 기본값은 첫 값)   | 드롭다운(`values` + "전체") | 위와 같다                                                                                                   |
| `int`      | 숫자                   | 숫자 입력                                        | 숫자 입력                   | `nullable` 이면 `null`, 아니면 키 자체를 빼서 백엔드가 "필수 속성이 없다"를 낸다 - `0` 으로 둔갑하지 않는다 |
| `datetime` | `YYYY-MM-DD HH:mm`     | `datetime-local`(오늘 `readOnly` 아닌 것은 없다) | 날짜 입력                   | `string` 과 같다                                                                                            |

`int` 에 정수가 아닌 값(`4.5`·`abc`)이나 안전 정수 범위를 넘는 값을 적으면 원문
문자열 그대로 보낸다 - 백엔드가 타입 오류를 그 필드 아래 낸다. 보내는 값은
언제나 원문이다(앞뒤 공백 정리도 백엔드의 일이다). 필터 컨트롤은 같은 키의
열 표현을 따른다 - 필터만 있고 열이 없는 키는 텍스트 입력이다.

### 관계가 정하는 것

| `cardinality` | 목록·상세 | 폼                                                                          |
| ------------- | --------- | --------------------------------------------------------------------------- |
| `one`         | 배지 하나 | 드롭다운. `nullable` 이면 "없음" 항목이 맨 앞, 아니면 생성 기본값이 첫 보기 |
| `many`        | 배지 여럿 | 체크박스 묶음                                                               |

- 배지와 보기 목록에 보이는 이름은 대상 자원의 `heading` 속성이다.
- 보기 목록은 화면이 대상 자원의 목록을 조회해 채운다. 생성·상세에서는
  하나라도 실패하면 폼 대신 배너를 그린다(보기 없이 저장하면 관계가 조용히
  빠진다). 목록의 관계 필터에서는 실패한 필터만 텍스트 입력으로 떨어져 id 를
  직접 넣을 수 있다.
- 관계 필터의 키는 관계 이름이 아니라 `관계.id`(`category.id`)다 - 백엔드가
  읽는 이름 그대로 적는다.
- `includes` 에 없는 관계는 이름이 함께 오지 않는다 - 백엔드에 따라 배지가 id
  로 그려지거나 "없음"으로 읽힌다. 배지로 보일 관계는 전부 `includes` 에
  적는다.

### 세 플래그 - `writable` · `readOnly` · `nullable`

| 플래그     | 층위               | 참이면                                                                  | 거짓이면                                                     |
| ---------- | ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `writable` | 자원               | 목록에 선택 열과 "새로 만들기", `/new` 화면, 상세에 수정 폼과 위험 구역 | 목록·상세만 있다. `/new` 는 404, 대시보드 카드에 "읽기 전용" |
| `readOnly` | 속성               | 폼에 없고 쓰기 문서에 실리지 않는다. 상세의 "지금 저장된 값"에 보인다   | 폼 필드가 된다                                               |
| `nullable` | 속성 · to-one 관계 | 비우면 `null` 로 저장된다. to-one 폼에 "없음" 항목이 생긴다             | 비울 수 없다 - `readOnly` 도 아닌 속성은 필수다              |

필수·선택을 따로 적는 폼 스키마는 없다 - "필수 ⟺ `readOnly` 도 `nullable` 도
아님" 하나다(`isRequiredAttribute`). 브라우저 `required` 도 붙이지 않는다 -
검증의 정본은 백엔드고, 422 오류의 포인터(`/data/attributes/<키>`)가 그 입력
아래 오류로 그려진다.

### 목록 화면 - URL 이 정본이다

필터·정렬·쪽·숨긴 열은 전부 URL 검색 파라미터다 - 새로고침·뒤로 가기·주소
공유가 그대로 된다. 선언에 없는 키는 조용히 버린다(백엔드는 낯선 파라미터를
400 으로 거절하므로 걸러서 보내야 목록이 산다).

| URL                              | 뜻                                                   | 백엔드로 나가는 것                |
| -------------------------------- | ---------------------------------------------------- | --------------------------------- |
| `?<필터 키>=<값>`                | 필터 바에서 "적용"한 값                              | `filter[<키>][<uiOperator>]=<값>` |
| `?sort=<필드>` · `?sort=-<필드>` | 오름차순 · 내림차순 - `sorts` 에 있는 필드만         | `sort=`                           |
| `?page[number]=<n>`              | 쪽 번호                                              | 그대로                            |
| `?pageSize=<n>`                  | 쪽당 건수 - 기본 50, 상한 100                        | `page[size]=`                     |
| `?hide=<열 키>,<열 키>`          | "열" 메뉴로 숨긴 열 - 표시일 뿐 질의에는 영향이 없다 | 나가지 않는다                     |

매 요청에 `include=<includes>` 와 `page[totals]=true` 가 함께 실린다.

화면에서는: 정렬 가능한 열의 머리글을 누르면 그 열로 정렬한다. 필터 바는
필터마다 컨트롤 하나에 연산자를 라벨 옆에 밝히고(포함 · 이상 · 부터 …),
"적용"을 눌러야 한 번에 반영되며 "지우기"가 전부 푼다. 행을 누르면 상세로
간다. 바닥에 "총 N건"과 쪽 이동이 있다.

### 만들기 · 수정 · 삭제 - `writable` 자원

- **만들기.** 목록의 "새로 만들기" → `/<slug>/new`. 필드는 `readOnly` 가 아닌
  속성(선언 순서)과 관계 전부다. "만들기"를 누르면 POST 하나가 나가고
  성공하면 새 건의 상세로 간다. "취소"는 입력을 되돌릴 뿐 요청을 보내지
  않는다.
- **수정.** 상세의 "내용 수정" 카드가 같은 폼이다(초기값은 저장된 값). "저장"을
  누르면 PATCH 하나가 나가고 상세가 새 값으로 다시 그려진다. 옆의 "지금
  저장된 값"에 관계 배지와 `readOnly` 속성이 있다. 상세 제목은 `heading` 값,
  그 옆 배지는 `enum` 속성들의 값, 그 아래가 id 다.
- **삭제.** 상세의 "위험 구역"에서 "삭제" → "삭제 확인" → DELETE → 목록으로.
  이미 지워진 건(404)은 성공으로 친다.
- **일괄 삭제.** 목록에서 체크박스로 고르면 선택 바가 뜬다("선택 N개 ·
  DELETE 요청 N회 전송 예정 · 한 번에 최대 50"). "일괄 삭제" → "삭제 확인"이면
  한 건씩 순차로 DELETE 하고 진행률과 결과 표를 그린다 - 백엔드에 일괄
  엔드포인트가 없어서다. "취소"를 누르면 남은 건은 보내지 않는다. 결과 표는
  건마다 성공 · 이미 삭제됨 · 세션 만료 · 재시도 가능으로 갈리고, 재시도
  가능한 건만 "재시도" 버튼으로 다시 보낸다(세션이 끊겼으면 "다시 로그인"
  링크).
- **오류.** 백엔드 422 의 필드 오류는 그 입력 아래에, 문서 수준 오류는 폼 위
  배너에 뜬다. 저장 중에는 버튼이 스피너만 보인다.

### 읽기 전용 자원

`writable: false` 인 자원도 목록과 상세를 갖는다 - 오늘의 분류·라벨이 그렇다.
목록에는 선택 열과 "새로 만들기"가 없고, 상세는 "저장된 값" 카드 하나에 모든
속성과 관계를 보인다. `/<slug>/new` 는 404 다.

### 선언이 틀리면 어디서 드러나나

- **`pnpm test`.** `test/unit/resources/index.test.ts` 가 모든 자원에 대해
  아홉 불변식을 잰다: slug 유일·URL 안전, `heading` ∈ 속성, 열 비어 있지
  않음·열 키 ∈ 속성∪관계, 필터 키 ∈ 속성∪`관계.id`, `uiOperator` ∈
  `operators`, `sortable` 열 ∈ `sorts`, `includes` ⊆ 관계, 관계 `type` ∈
  `RESOURCES`, `enum` `values` 비어 있지 않음. `defineResource` 자체는
  던지지 않는다 - import 시점에 죽으면 무엇이 틀렸는지 오히려 안 보이기
  때문이다.
- **실제 백엔드.** `operators`·`sorts` 는 백엔드 정책을 손으로 베낀 거울이라
  테스트가 백엔드와의 일치까지 잴 수는 없다. 백엔드가 허용하지 않는
  연산자로 필터하면 목록 요청이 400 으로 실패하고(빈 목록이 아니라 실패다),
  허용하지 않는 필드를 `sorts` 에 적으면 그 열로 정렬한 요청이 거절된다.
  그래서 선언은 백엔드 소스에서 실측해 옮겨 적는다.
- **저장할 때.** 서버가 만드는 속성에 `readOnly` 를 빠뜨리면 폼이 그 값을
  보내고 백엔드가 422 를 낸다.
- **컴파일.** `kind` 를 하나 더하면 `kind` 로 분기하는 세 곳
  (`lib/resources/define.ts` · `components/resource/field-control.ts` ·
  `lib/form/write.ts`)의 빠진 갈래를 컴파일이 잡는다.

### 화면을 다르게 그리고 싶을 때

특정 자원의 화면을 다르게 그리고 싶으면 `app/(admin)/<slug>/` 정적 폴더를
만든다 - 같은 층위에서 정적 세그먼트가 `[slug]` 를 이긴다(프로덕션 빌드와
`next dev` 양쪽에서 실측, `app/AGENTS.md`). 그 폴더는 자기 `loading.tsx` 도
스스로 가져야 한다 - `[slug]/loading.tsx` 는 형제 세그먼트에 적용되지 않는다.
필드 하나만 바꾸는 장치는 없다 - 덮어쓰기의 단위는 화면 전체다.

### 선언으로 할 수 없는 것

- **enum 표시 라벨.** 와이어 값(`draft`)이 배지·필터·폼에 그대로 보인다 -
  라벨을 따로 두면 목록·필터·폼·URL 이 서로 다른 이름을 갖는 자리가 생긴다.
- **기본 정렬.** 백엔드의 기본 정렬이 온다(`examples` 는 `createdAt` 내림차순,
  참조 자원은 `name` 오름차순).
- **자원별 아이콘.** 선언은 JSX 를 갖지 않는다 - 사이드바 아이콘은 하나로
  통일돼 있다.
- **필드 단위 커스텀 컴포넌트.** 덮어쓰기는 위의 정적 폴더 하나뿐이다.
- **OpenAPI 에서 선언 생성.** 선언은 손으로 베낀 거울이고 거울 테스트가
  지킨다.
- **대시보드의 최근 표.** `examples` 에 묶인 표본이다(루트 `AGENTS.md`) -
  카운트 카드만 선언에서 나온다.

### react-admin 에서 오는 사람에게

| react-admin                                                                      | 이 템플릿                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `<Admin dataProvider={...}>`                                                     | `BACKEND_URL` 하나 - JSON:API 코어(`lib/jsonapi/`)가 dataProvider 자리다 |
| `<Resource name list edit create show>`                                          | `defineResource({...})` + `RESOURCES` 한 줄 - 목록·생성·상세가 따라온다  |
| `<Datagrid>` 안의 `<TextField>`·`<NumberField>`·`<DateField>`·`<ReferenceField>` | `columns` - 표현은 속성 `kind` 와 관계에서 유도된다                      |
| `<SimpleForm>` 안의 `<TextInput>`·`<SelectInput>`·`<ReferenceInput>`             | 속성 `kind` 와 관계 `cardinality` - 폼 부품을 따로 적지 않는다           |
| `filters={[...]}`                                                                | `filters` - 연산자는 백엔드 정책의 거울                                  |
| 커스텀 페이지                                                                    | `app/(admin)/<slug>/` 정적 폴더                                          |
| 필드 단위 커스텀 컴포넌트                                                        | 없다                                                                     |

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
