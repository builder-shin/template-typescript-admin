<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# scripts/ 작업 지침

단일 게이트와 그 게이트가 부르는 검사 스크립트, 그리고 첫 운영자를 만드는
시드 스크립트를 둔다.

## 주요 파일

| 파일                  | 역할                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check.sh`            | **유일한 게이트**. `pnpm check`가 이 파일을 그대로 부른다. 아래 "단계 순서" 참고.                                                                           |
| `check-citations.sh`  | 사라질 자리(`.superpowers/`·`superpowers/sdd`)와 형제 저장소의 개발 단계·리뷰 표기(`D<숫자> Task`·`브랜치 리뷰`)를 코드·문서 주석에서 인용하는 것을 막는다. |
| `check-provenance.sh` | `docs/provenance/copied-core.json`이 있고, `commit`이 40자 SHA고, 기록된 `paths`가 실제로 존재하는지 확인한다.                                              |
| `seed-operator.ts`    | `pnpm seed:operator <email> <password>` - 첫 운영자를 만든다. 아래 "시드 스크립트의 제약" 참고.                                                             |

## 단계 순서 - `check.sh`

```
[1/9] typecheck   [2/9] lint        [3/9] format
[4/9] secretlint  [5/9] 인용        [5b/9] 출처
[6/9] unit        [7/9] build       [8/9] compose
[9/9] e2e
```

순서에 근거가 있다 - 분 단위인 `[9/9]`(도커 스택 기동 + 브라우저) 앞에 2초짜리
정적 검사들을 두어, 오타 하나로 도커 스택을 띄우지 않는다. 새 단계를
추가한다면 이 순서(정적 검사 → 단위 → 빌드 → 통합)를 따른다 - 느린 단계를
앞으로 옮기지 않는다.

## 인용 검사에 예외 장치가 없다

`check-citations.sh`는 `--exclude`나 허용 목록, 무시 주석 같은 예외 경로를
하나도 두지 않는다(파일 자신의 머리말 주석이 그렇게 선언한다). 검사 대상이
아니라 인용 자체를 사실 문장으로 바꾸는 것이 유일한 통과 방법이다.

**검사 대상은 `app`·`components`·`lib`·`test`·`proxy.ts`뿐이다** -
`scripts/`·`docs/`·`hooks/`·`.github/`와 루트 `AGENTS.md`·`README.md`는 이
스크립트가 훑지 않는다. 그 자리에 글을 쓸 때는 같은 규칙(사라질 자리를
인용하지 않는다)을 게이트 없이 손으로 지킨다.

## 시드 스크립트의 제약

`seed-operator.ts`는 `@/` 경로 별칭을 쓰지 않는다(상대 경로 + `.ts` 확장자로
import한다). `node --experimental-strip-types`로 직접 실행되어(`package.json`의
`seed:operator`) Next·vitest가 흉내 내는 별칭 해석을 거치지 않기 때문이다 -
`lib/auth/provision.ts`가 그 무엇도 import하지 않는 이유도 같다. 이 스크립트를
고칠 때 `@/`를 쓰면 타입은 통과하지만(에디터·`tsc`는 `tsconfig.json`의
`paths`를 안다) 실행 시점에 `node`가 그 별칭을 모른 채 죽는다 - `[6/9]`
이전에는 잡히지 않고 실제로 스크립트를 실행해야 드러난다.

`BACKEND_URL`이 없으면(필수, 기본값 없음) 즉시 던진다 - `lib/config/settings.ts`의
계약을 그대로 재사용한다. 이미 있는 계정으로 재실행하면(409) 오류로 취급하지
않고 0으로 끝난다 - 재실행이 안전해야 배포 절차에서 반복 호출해도 무해하다.

## 검증

`check.sh` 자신은 대상이 없다 - 그 안의 각 단계가 자신의 영역을 검증한다.
`check-citations.sh`·`check-provenance.sh`는 `test/unit/scripts/`가 지킨다 -
임시 디렉터리를 저장소 루트로 삼아 `execFileSync`로 스크립트를 직접 돌리고
(허용/금지 문구, 존재/누락 기록 등) 종료 코드를 확인한다. `seed-operator.ts`가
부르는 `provisionOperator`는 `test/unit/auth/`와 `test/e2e/fixtures.ts`(같은
함수) 양쪽이 지킨다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
