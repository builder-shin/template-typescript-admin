<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# hooks/ 작업 지침

`npx shadcn@latest add`가 부품과 함께 들여온 React 훅이 사는 자리다. 이
저장소가 직접 설계한 계층이 아니라 - 레지스트리 부품이 훅을 요구하면 여기로
들어온다.

## 주요 파일

| 파일            | 역할                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `use-mobile.ts` | `768px` 미만을 모바일로 판정하는 `useIsMobile()`. `matchMedia`를 구독한다. |

소비자는 `components/ui/sidebar.tsx`(모바일에서 `Sheet`로 전환)와
`components/chart-area-interactive.tsx`(모바일에서 표시 구간을 좁힌다) 둘뿐이다.

## 작업 규칙

- 이 디렉터리의 훅은 브라우저 API(`matchMedia`·`window`)에 의존하므로 그
  자체로 클라이언트 전용이다 - 훅을 부르는 컴포넌트가 `'use client'`를
  선언해야 한다(훅 파일 자신에는 지시어가 없어도 된다 - 지시어는 컴포넌트
  경계에 붙는 것이지 훅 모듈에 붙는 것이 아니다).
- 자원별 지식을 두지 않는다 - 이 디렉터리는 레지스트리 부품의 보조
  계층이지 이 저장소의 도메인을 알 필요가 없다.
- 새 레지스트리 부품을 추가해 훅이 딸려 오면 여기에 그대로 두고 이 표에
  추가한다. 내용을 손으로 고치지 않는다 - `shadcn add`를 다시 돌리면
  레지스트리 원본으로 덮인다.

## 검증

DOM 의존적이라 단위 테스트 하네스가 없다(이 저장소 전체의 관례) - 실제 동작은
그 훅을 쓰는 화면의 `test/e2e/`가 있다면 그것이, 없으면 눈으로 확인한다.
최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
