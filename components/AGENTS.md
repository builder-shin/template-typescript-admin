<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# components/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 `components/grid/`에 배정한 것: 자원
선언을 읽어 만드는 획일 그리드 UI. 배정하지 않은 것: 자원별 분기.

## 하위 구성

| 위치                  | 무엇인가                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/`      | shadcn 레지스트리가 그대로 넣은 부품(`base-nova` 스타일). 아래 "`'use client'` 정책" 참고                                                      |
| `components/grid/`    | 자원을 모르는 그리드 UI(그리드·선택 바·일괄 확인·결과 표) - 아래 "자원 이름으로 분기하지 않는다" 참고                                          |
| `components/form/`    | 화면 공용 폼 UI(제출 버튼·필드 오류·폼 배너) - 자원을 모른다                                                                                   |
| 그 밖의 최상위 `.tsx` | `dashboard-01` 블록이 들여온 대시보드·사이드바 부품(`section-cards`·`site-header`·`chart-area-interactive`·`app-sidebar`·`nav-*`·`data-table`) |

**사이드바 부품 다섯 중 셋만 호출된다**(Task 15, 실측 2026-09-12) - `app-sidebar.tsx`
는 `nav-main.tsx`·`nav-user.tsx`만 부른다. `nav-documents.tsx`·`nav-secondary.tsx`는
블록이 들여온 항목(Data Library·Reports·Word Assistant, Settings·Get Help·Search)
전부가 `url: '#'`이고 이 저장소에 대응하는 화면이 없어 **더 이상 호출되지
않는다** - 파일 자체는 블록의 일부로 남겼다. 빈 섹션 제목만 남기지 않는다는
판단이다 - 빈 섹션은 "곧 생긴다"고 약속하는 것이고 이 템플릿은 약속하지 않는다.

**운영자 정보는 화면이 직접 `fetch`하지 않고 prop으로 내려온다** - `app/`에서
`fetch`를 직접 부르면 위반이라는 위 계층 소유권 규칙이 여기도 그대로
적용된다. `app/(admin)/layout.tsx`가 `/api/v1/users/me`를 조회해 `AppSidebar`에
`operator: { email: string } | null`을 내려주고, `NavUser`는 그 값이
`null`이면(조회 실패·계약 위반 - `user` 모델에 `name`이 없다) 그 영역을
비운다 - 대체 문구를 만들지 않는다(`app/(admin)/operator.ts`).

## 자원 이름으로 분기하지 않는다

`components/grid/*`에 이 저장소의 실제 자원 이름(`examples`·`exampleCategories`·
`exampleTags` 등)을 가리키는 문자열 리터럴이나 그 이름에 의존하는 분기가
코드로 나타나면 위반이다(주석의 설명적 언급은 대상이 아니다 - 실측
2026-09-12, 코드상 0건). `ResourceGrid`는 `ResourceDef`와 Server Action
참조만 받아 그린다 - 어떤 자원을 그리는지는 호출부(`app/`)만 안다.

## `'use client'` 정책 - 레지스트리 부품

판별 기준은 **"로컬 훅이 없다"가 아니라 "상호작용 프리미티브에 의존하지
않는다"**다(근거는 루트 `AGENTS.md`). `components/ui/`의 현재 상태(실측
2026-09-12):

- **지시어 없음(순수 마크업, `react` 타입과 `cn`만 import)**: `badge` ·
  `breadcrumb` · `button` · `card` · `input` · `label` · `skeleton` ·
  `table`. 이 중 `table`·`label`은 **레지스트리가 붙여 준 지시어를 이
  저장소가 의도적으로 뺀 것**이다(각 파일 머리말 주석 참고) - `npx shadcn@latest
add table` 또는 `add label`을 다시 돌리면 되살아나므로, 되살아난 것을 보면
  다시 뺀다(`test/unit/components/registry-policy.test.ts`가 이 둘에
  `'use client'`가 없다는 것을 기계적으로 확인한다 - 되살아나면 게이트
  `[6/9]`가 먼저 잡는다).
- **`'use client'` 유지(`@base-ui/react/*` 프리미티브에 의존)**: `avatar` ·
  `chart` · `checkbox` · `drawer` · `dropdown-menu` · `select` · `separator` ·
  `sheet` · `sidebar` · `sonner` · `tabs` · `toggle` · `toggle-group` ·
  `tooltip`. 프리미티브 자신이 이미 클라이언트 컴포넌트라, 지시어를 떼도
  번들 경계는 그대로이고 레지스트리와만 갈라진다 - 이득 없이 드리프트만
  늘어난다.

새 레지스트리 부품을 추가하면(`npx shadcn@latest add <이름>`) 위 표에 추가하고,
어느 쪽인지는 이 기준(프리미티브 의존 여부)으로 판단한다 - 파일 안에 훅이
있는지만 보지 않는다.

`components/grid/*`·`components/form/*`는 상호작용(선택·드래그·폼 입력)이
실제로 필요해서 `'use client'`를 스스로 선언한 것들이다(예외:
`components/grid/format.ts`·`components/form/field-error.tsx`·
`components/form/form-banner.tsx` - 서버 컴포넌트도 불러야 해서 지시어가
없다). 이 부류는 레지스트리 판정표 대상이 아니다.

## 검증

`components/grid/`의 순수 헬퍼(`format.ts`)는 `test/unit/`이 지킨다. 선택·
일괄 작업·폼 참여 같은 실제 DOM 동작은 `test/e2e/`만 지킨다(이 저장소에는
DOM 테스트 하네스가 없다). 지시어 경계(위 "`'use client'` 정책"과 별개로,
루트 `AGENTS.md` 규칙 6번 - 비-클라이언트 모듈이 `'use client'` 모듈의 값을
호출하지 않는다)는 `test/unit/components/boundary-policy.test.ts`가 저장소
전체(`app`·`components`·`lib`)를 훑어 기계적으로 지킨다. 운영자 조회
(`app/(admin)/operator.ts`)는 `test/unit/components/sidebar.test.ts`가
지킨다. 최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
