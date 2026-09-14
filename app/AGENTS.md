<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-14 -->

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

`app/(admin)/[slug]/page.tsx` 머리말이 이 규칙을 그대로 말한다: "이 파일에는
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

| 파일                            | 조립하는 것                                                                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(admin)/[slug]/list.ts`        | 목록 요청(`listRequest`) - 경로·`gridQuery`·언어                                                                                                                                                                                                                                       |
| `(admin)/[slug]/[id]/detail.ts` | 상세 요청(`detailRequest`) - `list.ts`와 같은 모양, `resource.includes`를 싣는다                                                                                                                                                                                                       |
| `(admin)/[slug]/options.ts`     | 관계 보기 목록 요청(`optionsRequest`) - `listRequest`를 재사용하지 않는다(include 정책이 다르다). 생성·상세용 `relationshipOptionRequests`·`optionsByRelationship`(하나라도 실패하면 배너)과 목록용 `relationshipFilterRequests`·`filterOptionsFromResults`(실패는 접는다)가 여기 있다 |
| `(admin)/[slug]/write.ts`       | 쓰기 요청 셋(`createRequest`·`updateRequest`·`deleteRequest`) - 본문은 `lib/form/write.ts` 의 `writeDocument`                                                                                                                                                                          |
| `(admin)/[slug]/resource.ts`    | 조립은 아니다 - slug → 선언(`resourceFromSlug`, 없으면 `notFound()`)과 쓰기 Action 의 문지기(`writableResource`, 없거나 읽기 전용이면 던진다)                                                                                                                                          |
| `(admin)/count.ts`              | 대시보드 카드의 자원 총합 요청(`countRequest`) - `page[size]=1`+`page[totals]=true`                                                                                                                                                                                                    |
| `(admin)/health.ts`             | 대시보드 상태 카드의 헬스 요청과 판정                                                                                                                                                                                                                                                  |

**이 함수들을 `lib/resources/`로 옮기지 마라.** `lib/resources/`는 어떤 내부
모듈도 import하지 않는 순수 선언 계층이다(`lib/resources/AGENTS.md`) -
`RequestOptions`·`withAcceptLanguage`를 값으로 끌어오는 조립 함수를 그
디렉터리에 두면 그 규칙이 깨진다. 요청 조립은 그것을 쓰는 화면 옆에 둔다.

## `[slug]` 한 벌 - 자원마다 라우트를 만들지 않는다

`app/(admin)/[slug]/` 아래 `page.tsx`(목록) · `new/page.tsx`(생성) ·
`[id]/page.tsx`(상세)와 각자의 `loading.tsx` 가 선언된 자원 전부를 그린다.
세 화면의 첫 줄이 `resourceFromSlug(slug)` 다(`resource.ts`) - 선언에 없는
slug 는 `notFound()` 로 루트 `app/not-found.tsx` 에 간다. Server Action 넷
(`actions.ts`)은 `slug` 를 첫 인자로 받고 첫 줄에서 `writableResource(slug)`
로 쓰기 가능 여부를 확인한다 - 화면은 `action.bind(null, resource.slug)` 로
넘긴다(실측: bind 된 문자열 인자가 `useActionState` 를 거쳐 서버에 그대로
돌아온다 - `test/e2e/examples.spec.ts` 의 생성 시나리오).

`writable` 이 화면을 가른다 - 목록은 `writable` 일 때만 `bulkDeleteAction`·
`newHref` 를 그리드에 넘기고(그리드는 그 유무로 선택 열과 "새로 만들기"를
그린다), 생성은 `writable` 이 아니면 `notFound()`, 상세는 `writable` 이면
두 열(폼·저장된 값·위험 구역) 아니면 저장된 값 카드 하나다. 이 판단은
전부 화면이 선언을 읽어 한다 - 그리드·폼·상세 부품은 자원 이름을 모른다.

`loading.tsx` 셋은 `'use client'` 다 - `useParams` 로 slug 를 읽어 열 수·
필터 수·필드 수를 선언에서 센다(`[slug]/loading.tsx` 머리말의 실측).

이 디렉터리 아래에는 실제 자원 이름·필드 이름 리터럴이 코드로 하나도 없다 -
`app/` 는 자원 이름을 알아도 되지만, 이 한 벌이 특정 자원을 알기 시작하면
"선언 하나로 전부"가 거짓이 된다. 자원 이름을 코드로 아는 자리는
대시보드의 최근 표뿐이다(루트 `AGENTS.md` 의 "화면에는 보이지 않는
계약").

## 덮어쓰기 - 정적 폴더가 `[slug]` 를 이긴다

특정 자원의 화면을 다르게 그리려면 `app/(admin)/<slug>/` 정적 폴더를
만든다. 장치는 Next 의 라우트 정렬 하나다 - 같은 층위에서 정적 자식을
이름순으로 먼저 내고 그 다음 `[slug]` 를 낸다(`node_modules/next/dist/shared/
lib/router/utils/sorted-routes.js` 의 `_smoosh`). 실측(2026-09-14, 던져 버릴
`app/(admin)/examples/page.tsx` 하나로): 실제 프로덕션 빌드에서 `/examples` 는
정적 화면을 그렸고 `/categories` 는 그대로 `[slug]` 의 제네릭 목록(h1 `분류`)을
그렸다 - 같은 세그먼트에서 정적 폴더가 `[slug]` 를 이겼다. `next dev` 에서
세션 쿠키를 실어 같은 두 경로를 요청했을 때도 같은 순서였다(`static-override`
일치 줄이 `/examples` 1개·`/categories` 0개) - dev 서버도 프로덕션 빌드와
같은 순서로 고른다. 그 상태의 `pnpm build` 라우트 목록에는 `ƒ /[slug]` 와
`ƒ /examples` 가 나란히 실렸다 - 정적 폴더가 이겨도 `[slug]` 항목이 목록에서
사라지지는 않는다. 그 덮어쓰기 예시는 커밋하지 않는다 - 재고 지웠다. 남기면
제네릭 화면이 정작 `examples` 에서 검증되지 않는다.

덮어쓰는 폴더는 자기 `loading.tsx` 도 스스로 가져야 한다 - `[slug]/loading.tsx`
는 형제 세그먼트에 적용되지 않는다. 그 밖의 덮어쓰기 장치(필드 단위 커스텀
컴포넌트 등)는 두지 않는다.

선언에 없는 슬러그의 응답 상태: 실측(2026-09-14, 정본 FastAPI 스택의 프로덕션
빌드): `/nope` 같은 슬러그의 응답 상태는 200 이었다(`next dev` 에서도 200) -
`app/loading.tsx` 와 `[slug]/loading.tsx` 가 Suspense 경계를 만들어 응답이
스트리밍이면 Next 는 200 을 낸다(`not-found.md`). E2E 는 그래서 상태 코드가
아니라 화면을 단언한다(`test/e2e/reference.spec.ts`).

## 지시어 경계로 나뉜 파일

`'use server'`·`'use client'`가 파일 전체에 적용된다는 사실(근거와 판례는
루트 `AGENTS.md`의 "지킬 것 여섯"의 여섯째)이 아래 분리를 만들었다:

- `(admin)/[slug]/write.ts` - `actions.ts`(`'use server'`)가 쓰는 쓰기 요청
  조립. Server Action은 반드시 async 함수여야 해서, 순수 동기 함수인 조립
  함수를 같은 파일에 두면 빌드가 죽는다. 본문 자체(`FormData` → JSON:API
  문서)는 자원을 모르는 `lib/form/write.ts` 의 `writeDocument` 가 만들고, 이
  파일은 경로·메서드·토큰·언어만 붙인다. `resource.ts` 도 같은 이유로
  지시어 없이 따로 있다 - `writableResource` 는 동기 함수다.
- 폼 상태·판단은 이 디렉터리에 없다 - `lib/form/form-state.ts`(런타임
  import **0개**, 클라이언트 폼 `components/resource/resource-form.tsx` 가
  값으로 가져간다)와 `lib/form/flow.ts`(오류 판단, Server Action 만 부른다)가
  갖는다. 예전에는 `(admin)/examples/form-state.ts`·`flow.ts` 가 같은 경계를
  `examples` 전용으로 갖고 있었다 - 근거는 `lib/form/AGENTS.md`.

**클라이언트 컴포넌트에 `proxy.ts`를 값으로 넘기지 않는다.** `ResourceGrid`
(`components/grid/resource-grid.tsx`, `'use client'`)가 로그인 복귀 경로를
그려야 하는 자리가 있는데, `proxy.ts`의 `LOGIN_REDIRECT_PARAM`을 그 컴포넌트가
직접 import하면 `lib/auth/session.ts`를 거쳐 `next/headers`가 클라이언트
번들에 끌려 들어가 빌드가 깨진다(실측). 그래서 그 값을 쓰는 서버 컴포넌트
(`(admin)/[slug]/page.tsx`)가 문자열을 완성해 prop으로 내려준다 - 서버
컴포넌트는 이미 `searchParams`를 갖고 있어 완성 비용도 없다.

## 검증

Server Action 왕복·제출 중 상태·부분 실패·`headers()`가 실제로 전달되는가는
`test/e2e/`만 지킨다(요청 스코프 API를 vitest에서 스텁하지 않는 관례 - 근거는
각 파일의 "관측 불가" 주석). 조립 함수 자체의 순수 로직은 `test/unit/slug/`가
직접 부른다. 최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
