<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# app/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 이 디렉터리에 배정한 것: 화면, Server
Action, 라우팅. 배정하지 않은 것: `fetch` 직접 호출, 쿼리 조립(그 둘은
`lib/jsonapi/`·`lib/grid/`의 일이다).

## 라우트 그룹

| 그룹      | 껍데기                                 | 무엇이 들어가나                             |
| --------- | -------------------------------------- | ------------------------------------------- |
| `(admin)` | 사이드바 셸(`AppSidebar`·`SiteHeader`) | 대시보드와 자원 화면. **새 화면은 여기다.** |
| `(auth)`  | 뷰포트 전체, 헤더 없음(`min-h-svh`)    | 로그인                                      |

화면 껍데기(사이드바든 뷰포트 전체든)를 `app/layout.tsx`(루트)에 두지 않는다 -
그 자리는 두 그룹을 전부 덮는다. `min-h-svh`를 `(admin)` 안에서 쓰지 않는
이유를 포함해, 이 계약의 근거는 루트 `AGENTS.md`가 갖는다.

## 화면 파일에는 `fetch`와 JSX만 둔다

`app/(admin)/examples/page.tsx` 머리말이 이 규칙을 그대로 말한다: "이 파일에는
`fetch`와 JSX만 둔다." 경로 조립·쿼리 직렬화·`Accept-Language` 읽기를 화면
안에서 각각 따로 부르면(예: `gridQuery(...)`·`resource.path`·헤더 읽기를 셋
따로), 그중 하나를 지우는 뮤턴트가 화면에서는 잡히지 않는다 - 화면 자신은
단위 테스트 대상이 아니라서(요청 스코프 API 를 스텁하지 않는 이 저장소의
관례 때문에 vitest 에서 못 돈다) 셋 중 어느 것을 지워도 게이트가 초록을
유지한다.

그래서 조립을 함수 하나로 모아 화면 옆에 둔다. 그 함수가 `[path, options]`
튜플을 돌려주면 화면은 `request(...assemblyFn(...))`로 펼치기만 한다 - 세
값을 단위 테스트의 `toEqual` 하나가 고정하고, 화면에 남는 무방비는 그 펼침
한 줄뿐이다.

| 파일                              | 조립하는 것                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `(admin)/examples/list.ts`        | 목록 요청(`listRequest`) - 경로·`gridQuery`·언어                                                                  |
| `(admin)/examples/[id]/detail.ts` | 상세 요청(`detailRequest`) - `list.ts`와 같은 모양, `resource.includes`를 싣는다                                  |
| `(admin)/examples/options.ts`     | 생성·수정 폼의 분류·라벨 선택지 요청(`optionsRequest`) - `listRequest`를 재사용하지 않는다(include 정책이 다르다) |
| `(admin)/count.ts`                | 대시보드 카드의 자원 총합 요청(`countRequest`) - `page[size]=1`+`page[totals]=true`                               |
| `(admin)/health.ts`               | 대시보드 상태 카드의 헬스 요청과 판정                                                                             |

**이 함수들을 `lib/resources/`로 옮기지 마라.** `lib/resources/`는 어떤 내부
모듈도 import하지 않는 순수 선언 계층이다(`lib/resources/AGENTS.md`) -
`RequestOptions`·`withAcceptLanguage`를 값으로 끌어오는 조립 함수를 그
디렉터리에 두면 그 규칙이 깨진다. 요청 조립은 그것을 쓰는 화면 옆에 둔다.

## 지시어 경계로 나뉜 파일

`'use server'`·`'use client'`가 파일 전체에 적용된다는 사실(근거와 판례는
루트 `AGENTS.md`의 "지킬 것 여섯"의 여섯째)이 아래 분리를 만들었다:

- `(admin)/examples/write.ts` - `actions.ts`(`'use server'`)가 쓰는 쓰기 요청
  조립. Server Action은 반드시 async 함수여야 해서, 순수 동기 함수인 조립
  함수를 같은 파일에 두면 빌드가 죽는다.
- `(admin)/examples/form-state.ts` - 폼 상수·타입·초기값. 런타임 import가
  **0개**다. 오류 판단(`examplesFormState`)은 `flow.ts`가 대신 갖는다 - 같은
  파일에 두면 그 함수가 값으로 끌어오는 `lib/jsonapi/errors` →
  `lib/jsonapi/client` → `lib/config/settings`(서버 전용)까지 클라이언트
  컴포넌트(`[id]/edit-form.tsx`·`new/page.tsx`)의 번들에 실린다.
- `(admin)/examples/flow.ts` - 위 오류 판단이 사는 자리. `lib/auth/flow.ts`와
  같은 분리, 같은 이유다.

**클라이언트 컴포넌트에 `proxy.ts`를 값으로 넘기지 않는다.** `ResourceGrid`
(`components/grid/resource-grid.tsx`, `'use client'`)가 로그인 복귀 경로를
그려야 하는 자리가 있는데, `proxy.ts`의 `LOGIN_REDIRECT_PARAM`을 그 컴포넌트가
직접 import하면 `lib/auth/session.ts`를 거쳐 `next/headers`가 클라이언트
번들에 끌려 들어가 빌드가 깨진다(실측). 그래서 그 값을 쓰는 서버 컴포넌트
(`(admin)/examples/page.tsx`)가 문자열을 완성해 prop으로 내려준다 - 서버
컴포넌트는 이미 `searchParams`를 갖고 있어 완성 비용도 없다.

## 검증

Server Action 왕복·제출 중 상태·부분 실패·`headers()`가 실제로 전달되는가는
`test/e2e/`만 지킨다(요청 스코프 API를 vitest에서 스텁하지 않는 관례 - 근거는
각 파일의 "관측 불가" 주석). 조립 함수 자체의 순수 로직은 `test/unit/examples/`가
직접 부른다. 최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
