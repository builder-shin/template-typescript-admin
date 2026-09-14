<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# template-typescript-admin 작업 지침

FastAPI · NestJS · Rails 세 백엔드가 공유하는 JSON:API 계약을 운영자 관점에서
소비하는 Next.js 어드민이다. 왜 이 계약인지는
`docs/superpowers/specs/2026-09-12-admin-template-design.md`가 소유한다 - 이
파일은 계층 소유권의 **운용 정본**과 위반의 정의를 소유한다.

## 계층 소유권

아래 표는 소유 관계이지 파일 목록이 아니다 - 어떤 위치가 아직 비어 있어도 그
행의 계약은 이미 유효하다. 어느 파일이 실재하는지는 저장소를 보면 된다.

| 위치                   | 소유하는 것                                                                   | 소유하지 않는 것        |
| ---------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| `lib/jsonapi/`         | 문서 파싱, `included` 정규화, 쿼리 직렬화, 오류 분류, HTTP 협상               | 자원별 지식, 화면       |
| `lib/resources/`       | 자원의 타입·필터·정렬·폼 스키마·표시 라벨                                     | JSX, `fetch`            |
| `lib/grid/`            | URL이 말하는 목록 상태 → 백엔드 질의로의 변환, URL 직렬화                     | JSX, `fetch`, 자원 분기 |
| `lib/bulk/`            | 일괄 실행기 - 순차 실행, 부분 실패 집계, 취소                                 | JSX, 자원 분기          |
| `lib/auth/`            | 쿠키 세션, 토큰 만료 판정, 가드                                               | 화면 이동 결정          |
| `lib/config/`          | 환경 변수 해석의 정본 - 필수 변수의 시작 실패 판정                            | 자원별 지식, 화면       |
| `proxy.ts`             | 보호 경로 목록, 경로 가드, 토큰 회전                                          | 화면, 자원별 지식       |
| `app/`                 | 화면, Server Action, 라우팅                                                   | `fetch`, 쿼리 조립      |
| `components/grid/`     | 자원 선언을 읽어 만드는 획일 그리드 UI                                        | 자원별 분기             |
| `lib/form/`            | 선언 + `FormData` → JSON:API 쓰기 문서, 응답 문서 → 폼 초기값, 오류 → 폼 상태 | JSX, `fetch`, 자원 분기 |
| `components/resource/` | 자원 선언을 읽어 만드는 획일 폼·상세 UI                                       | 자원별 분기             |

**위반의 정의:**

- `lib/jsonapi/` · `lib/grid/` · `lib/bulk/`에 이 저장소의 실제 자원 이름을
  가리키는 문자열 리터럴이 **코드로**(주석의 설명적 언급이 아니라) 나타나면
  위반이다.
- `lib/resources/*.ts` · `lib/grid/*.ts` · `lib/bulk/*.ts`에 JSX가 있으면
  위반이다.
- `app/`에서 `fetch`를 직접 부르면 위반이다.
- `components/grid/*`에 자원 이름으로 분기하는 코드가 있으면 위반이다.
- `lib/form/*` · `components/resource/*`에 이 저장소의 실제 자원 이름이나
  필드 이름(`title` · `category` 등)을 가리키는 문자열 리터럴이 **코드로**
  나타나면 위반이다 - `lib/grid/`와 같은 규칙이다.

`lib/resources/index.ts`는 손으로 채우는 배열이다. **여기 없으면 그 자원은
존재하지 않는 것과 같다.** 자동 탐색(glob · `import.meta.glob` · 동적
`import`)을 쓰면 이 계약이 사라진다 - 배열에 손으로 적어야 "이 저장소가 아는
자원 전부"가 파일 하나를 읽는 것만으로 드러난다.

## 지킬 것 여섯

1. **사라질 자리를 인용하지 마라.** 게이트 `[5/9]`가 강제한다(`scripts/check-citations.sh`).
   근거는 사실 문장으로 적는다 - "무엇을 쟀고 결과가 무엇이었는가"를 그 자리에
   쓰면 원본 문서가 사라져도 근거가 남는다. 문서가 더 필요하면
   `docs/superpowers/`를 가리킨다 - 그 자리는 커밋되므로 인용해도 된다.

2. **`(admin)` 안에서 `min-h-svh`를 쓰지 않는다.** 높이는 셸이 갖는다 -
   `(admin)/layout.tsx`의 사이드바 셸이 이미 뷰포트 높이를 잡고 있어, 화면이
   다시 `min-h-svh`를 선언하면 헤더 높이만큼 넘친다. (셸 자체가 마운트되지
   않는 자리 - 루트 `app/error.tsx`·`app/not-found.tsx`·`app/loading.tsx` -
   는 이 규칙 밖이다. 그 파일들이 뜰 때는 `(admin)` 셸 자체가 없다.)

3. **화면 껍데기를 `app/layout.tsx`에 두지 않는다.** 그 자리는 `(admin)`·
   `(auth)` 두 그룹을 전부 덮는다. 사이드바 셸은 `(admin)/layout.tsx`가,
   뷰포트 전체·헤더 없음은 `(auth)/layout.tsx`가 각자 갖는다.

4. **라우트 파일을 옮기거나 지운 뒤 게이트가 `TS2307`로 죽으면 `rm -rf .next`
   부터 한다.** `.next/dev`만 지워서는 안 되고, `pnpm build`만 돌려서는 안
   보이고 `[1/9] typecheck`에서만 드러난다 - 캐시된 라우트 타입이 남기
   때문이다.

5. **`shadcn add`를 다시 돌리면 `table.tsx`·`label.tsx`에 `'use client'`가
   되살아난다.** 되살아난 것을 보면 다시 뺀다 -
   `test/unit/components/registry-policy.test.ts`가 이 둘에 지시어가 없다는
   것을 기계적으로 확인하므로 되살아나면 `[6/9]`가 먼저 잡는다. 판별 기준은 **"로컬 훅이
   없다"가 아니라 "상호작용 프리미티브에 의존하지 않는다"**다. 실측
   (2026-09-12)으로 갈린다:

   | 부품                                          | import                        | 지시어     |
   | --------------------------------------------- | ----------------------------- | ---------- |
   | `table` · `label`                             | `react`(타입) · `cn`뿐        | **뺀다**   |
   | `avatar` · `separator` · `toggle` · `tooltip` | `@base-ui/react/*` 프리미티브 | **남긴다** |

   넷도 파일 자체에는 훅·핸들러·브라우저 API가 0건이라 "로컬 훅" 기준만
   보면 뺄 대상처럼 보인다. 그런데 **프리미티브가 이미 클라이언트
   컴포넌트라 import 경로로 경계가 생긴다** - 지시어를 떼도 번들 경계는
   그대로이고 레지스트리와만 갈라진다. 이득 없이 드리프트만 늘린다.

6. **파일 맨 위의 지시어(`'use client'`·`'use server'`)는 그 파일의 모든
   export와 그 파일이 값으로 import하는 모든 것에 걸리는 제약이다.** 이
   저장소에서 같은 부류의 실수가 **세 번** 일어났고, 증상이 매번 달라서 세
   번째까지 아무도 패턴을 알아보지 못했다.

   | 어긴 것                                                                                                        | 증상                                                                                                | 어떻게 드러났나                                                                                                                      |
   | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
   | 서버 컴포넌트가 `'use client'` 모듈의 **평범한 함수를 호출**했다                                               | **모든 상세 페이지 조회가 런타임에 깨졌다**(관계 유무와 무관하게 - 생성일·수정일 포맷팅에도 걸린다) | 빌드는 통과한다 - `/examples/[id]`는 동적 라우트(ƒ)라 빌드 시 렌더되지 않는다. 실제 백엔드 E2E가 그 페이지를 처음 열었을 때 드러났다 |
   | 클라이언트 컴포넌트가 `@/proxy`를 값으로 가져왔고, 그것이 `lib/auth/session.ts`를 거쳐 `next/headers`에 닿았다 | 빌드 실패                                                                                           | `next build`가 즉시 잡는다 - `next/headers`에 서버 전용 차단이 있어서다                                                              |
   | `'use server'` 파일이 **동기 함수를 export**했다                                                               | 빌드 실패                                                                                           | `next build`만 잡는다. `tsc`는 이 규칙을 모르므로 typecheck·단위 테스트가 전부 초록이었다                                            |

   **기계적 검사 하나가 셋 중 첫째를 잡는다**(나머지 둘은 빌드가 잡는다):
   비-클라이언트 모듈이 `'use client'` 모듈에서 값을 가져올 때, **가져온
   이름은 JSX로만 쓰여야 하고 호출되면 안 된다.** 컴포넌트를 경계 너머로
   가져오는 것은 정상이고 그것이 경계의 작동 방식이다 - 금지되는 것은 그
   모듈의 순수 함수를 서버 렌더에서 부르는 것이다. 실측(2026-09-12): 이
   저장소에서 경계를 넘는 값 import 12건이 전부 JSX 컴포넌트이고 함수 호출은
   0건이다.

   **"그 파일이 이미 순수 헬퍼를 export하고 있다"는 근거로 새 import를
   정당화하지 마라.** 그것이 첫째 사례의 원인이다 - `resource-grid.tsx`가
   순수 헬퍼 여섯 개(`relationshipLabel`·`formatDateTime` 등)를 export하고
   있었지만 그 소비자는 **단위 테스트**였고, vitest는 `'use client'`를
   강제하지 않는다. 테스트가 하는 import는 서버 컴포넌트가 해도 된다는
   증거가 아니다.

   **지시어가 있는 파일에서 순수한 것을 꺼내야 하면 지시어 없는 형제
   모듈로 옮긴다.** 이 저장소가 그것을 세 번 했다 - 셋 다 같은 근본 원인
   (지시어가 파일 전체에 적용되고 모든 export를 오염시킨다)에서 나왔으므로
   예로 적어 둔다:

   - `components/grid/format.ts` - `resource-grid.tsx`(`'use client'`)가
     export하던 `relationshipLabel`·`formatDateTime`을 옮겼다. 서버
     컴포넌트인 상세 화면이 이 함수들을 값으로 직접 호출해야 했다.
   - `app/(admin)/examples/write.ts` - `actions.ts`(`'use server'`)에 있던
     쓰기 요청 조립 함수들을 옮겼다. Server Action은 반드시 async 함수여야
     하는데 이 함수들은 순수 동기 함수였다("Server Actions must be async
     functions").
   - `lib/form/form-state.ts` - 런타임 import를 **0개**로 유지한다. 폼
     상태·타입·초기값을 클라이언트 컴포넌트(`components/resource/resource-form.tsx`)
     가 값으로 가져가야 하는데, 오류 판단 로직을 같은 파일에 두면
     `lib/jsonapi/errors` → `lib/jsonapi/client` → `lib/config/settings`
     (서버 전용, `process.env`를 읽는다)까지 클라이언트 번들이 끌어들이는
     자리가 된다. 판단은 `lib/form/flow.ts` 가 갖는다.

   다음에 이 저장소에서 순수 함수를 "그냥 옆에 있는 Action·컴포넌트
   파일"에 두고 싶은 유혹이 들면 이 절을 먼저 읽을 것.

## 화면에는 보이지 않는 계약 둘

**`/`(대시보드)의 표(`components/data-table.tsx`, `app/(admin)/page.tsx`가
렌더한다) 드래그 정렬은 서버에 남지 않는다.** 드래그로 바꾼 순서는
새로고침하면 사라진다 - 백엔드에 정렬 순서를 담을 칼럼도, 그것을 바꾸는
재정렬 엔드포인트도 없다. 이것은 버그가 아니다 - 백엔드 계약에 없는 기능이라
프론트엔드만으로는 만들 수 없어서, `dashboard-01` 블록의 드래그 부품과
`@dnd-kit/*` 의존성 넷을 그대로 남겨 뒀을 뿐이다(나중에 백엔드가 순서를
갖추면 배선만 하면 된다). **이 사실을 모르고 읽으면 "드래그가 저장 안 되는
버그"로 오인해 존재하지 않는 엔드포인트를 찾게 된다.**

**드래그는 `/examples` 에는 없다.** 그 화면은 `ResourceGrid`
(`components/grid/resource-grid.tsx`)를 쓰고, 그 컴포넌트는 `@dnd-kit`
을 전혀 import 하지 않는다(실측: 저장소 전체에서 `@dnd-kit`·`DndContext`·
`useSortable` 은 `data-table.tsx` 한 파일에만 있다) - 이 경고를 읽고 `/examples`
에서 재정렬 엔드포인트를 찾아 헤매지 않도록 명시해 둔다.

**`/`(대시보드)의 차트(`chart-area-interactive`)는 표본 데이터다.** 백엔드에
시계열도 집계 엔드포인트도 없어 `dashboard-01` 블록이 들고 온 배열을 그대로
그린다. 화면 자신이 그 사실을 밝힌다(카드 부제: "표본 데이터입니다 - 백엔드에
연결되어 있지 않습니다") - 운영자가 그 숫자를 실제 지표로 읽으면 안 된다는
뜻이고, 그 표시를 지우거나 실제 배선처럼 보이게 고치지 않는다. 카드(`section-cards`)와
표(`data-table`)는 이미 실제 자원 카운트·`examples`로 배선돼 있다 - 표본으로
남은 것은 이 차트 하나뿐이다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
