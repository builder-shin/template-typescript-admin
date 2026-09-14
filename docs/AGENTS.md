<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# docs/ 작업 지침

**커밋되는** 설계·계획·실측 기록만 이 디렉터리에 둔다. 구현 진행
워크스페이스(원장·브리핑·리뷰 패키지)는 `.superpowers/`에 있고 그 디렉터리는
자신의 `.gitignore`로 커밋에서 빠진다 - 계획이 끝나면 사라질 자리이므로 여기
`docs/`에서 인용하지 않는다(근거는 루트 `AGENTS.md`의 "지킬 것 여섯" 1번,
검사는 `scripts/check-citations.sh`).

## 주요 파일

| 위치                                                          | 소유하는 것                                            |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `superpowers/specs/2026-09-12-admin-template-design.md`         | 설계 - **왜** 이 계층 계약인가. 계층 소유권의 운용 정본은 구현 뒤 루트 `AGENTS.md`가 갖는다(그 문서 0장이 스스로 그렇게 넘긴다). |
| `superpowers/specs/2026-09-14-declarative-resources-design.md`  | 선언 하나로 자원 화면 전부를 만드는 설계 - 원 스펙 10절의 "제네릭 화면 생성기" 제외를 뒤집는다. 원 스펙 5.1·10절에 이 문서를 가리키는 정정 註가 있다. |
| `superpowers/plans/2026-09-12-admin-template.md`                | 그 설계를 과업 단위로 쪼갠 구현 계획.                    |
| `superpowers/plans/2026-09-14-declarative-resources-part-1.md`  | 선언 확장·`lib/form/`·`components/resource/` - 둘째 스펙의 첫째 계획. |
| `superpowers/plans/2026-09-14-declarative-resources-part-2.md`  | `app/(admin)/[slug]/` 라우트·셸·E2E·실측 - 둘째 스펙의 둘째 계획. |
| `provenance/copied-core.json`                                   | 복사해 온 코어(`lib/jsonapi`·`lib/auth`·`lib/config`·`proxy.ts`)의 출처 커밋·경로 기록. `scripts/check-provenance.sh`가 매 게이트 실행마다 이 파일의 존재와 형식, 기록된 경로의 실재를 확인한다. |

## `docs/provenance/`만 `.dockerignore`에서 예외인 이유

정본(형제 저장소)의 `.dockerignore`는 `docs`를 통째로 한 줄로 뺀다. 이
저장소는 그렇게 하면 이미지가 죽는다 - `next build`의 `tsc` 단계가
`tsconfig.json`의 `include`(`**/*.ts`)를 따라
`test/unit/scripts/check-provenance.test.ts`도 타입 검사하는데, 그 파일이
`../../../docs/provenance/copied-core.json`을 **값으로 import**한다(`import
record from ...`). `docs`를 통째로 뺀 빌드 컨텍스트로 `docker build`하면
"Cannot find module" 로 타입 검사가 죽는다 - 정본에는 이 provenance 추적
파일이 없어 드러나지 않았던 차이다. 그래서 `.dockerignore`는 `docs/*` +
`!docs/provenance`로 이 한 파일(8KB)만 컨텍스트에 남기고 나머지 문서(계획·
스펙 산문)는 그대로 뺀다.

`.prettierignore`는 반대로 `docs/`를 통째로 그대로 둔다 - 이유는 빌드
컨텍스트가 아니라 서식이다: 계획·스펙 문서에 박힌 표·JSON 예시는 저자가
의도적으로 압축한 서식이라 prettier의 표준 서식으로 재작성하면 안 된다. 두
설정이 `docs/`를 다르게 다루는 것은 실수가 아니다 - 각자 다른 이유로
갈린 것이다.

## 검증

`check-provenance.sh`가 매 게이트 실행(`[5b/9]`)마다 `provenance/copied-core.json`을
확인한다. 그 스크립트 자체는 `test/unit/scripts/check-provenance.test.ts`가
지킨다. 최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
