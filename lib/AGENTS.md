<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# lib/ 작업 지침

여섯 하위 디렉터리로 나뉜 순수 함수 계층을 모은다. 각자의 로컬 계약(자원을
모른다, JSX를 두지 않는다 등)은 자신의 `AGENTS.md`가 소유한다 - 이 파일은
**그 여섯 사이의 의존 방향**, 즉 누가 누구를 import할 수 있는가만 소유한다.

## 의존 방향

| 디렉터리         | import할 수 있는 내부 모듈                                                             |
| ---------------- | -------------------------------------------------------------------------------------- |
| `lib/config/`    | 없음 - 기반 계층이다.                                                                  |
| `lib/resources/` | 없음 - 자원을 선언만 하는 순수 계층이다. `lib/jsonapi/`조차 소비하지 않는다.           |
| `lib/jsonapi/`   | `lib/config/`(설정을 읽어 요청을 조립한다)                                             |
| `lib/grid/`      | `lib/resources/`가 내보내는 `ResourceDef` **타입**만(`import type`). 값 import는 없다. |
| `lib/bulk/`      | `lib/jsonapi/document.ts`의 `ErrorObject` **타입**만(`import type`). 값 import는 없다. |
| `lib/auth/`      | `lib/jsonapi/`, `lib/config/settings.ts`                                               |

화살표로 그리면 `lib/config/` → `lib/jsonapi/` → `lib/auth/`가 값을 주고받는
한 줄기이고, `lib/resources/` → `lib/grid/`·`lib/bulk/`가 타입만 주고받는
독립된 줄기다. 두 줄기는 서로 만나지 않는다 - `lib/grid/`·`lib/bulk/`는
`lib/jsonapi/`를 값으로 쓰지 않고(요청을 만드는 것이 이 둘의 일이 아니므로),
`lib/resources/`는 그 무엇도 소비하지 않는다.

## 실제로 틀렸던 자리 둘

이 저장소에서 의존 방향이 실제로 틀렸던 자리가 이 표에서 두 번 나왔다 - 둘 다
구현 중에 사람이 잡았지 게이트가 자동으로 잡아 주지 않는다(타입 검사는
"이 import가 이 계층에 있어도 되는가"를 모르고 "타입이 맞는가"만 본다):

- **`lib/resources/`가 `lib/jsonapi/`를 값으로 소비하려 했다.** `lib/resources/`는
  자원이 무엇인지만 아는 순수 선언 계층이어야 하는데, 요청 관련 모듈을 값으로
  끌어오면 그 경계가 무너진다. 위 표의 두 번째 줄("없음")이 이 실수를 다시
  막는 자리다.
- **오류 문서 파서를 `lib/resources/`에 두려 했다.** 오류 분류는
  `lib/jsonapi/errors.ts`의 일이다 - 자원 선언 계층에 오류 파싱을 두면
  "자원이 무엇인지"와 "요청이 어떻게 실패하는지"가 한 파일에서 섞인다.

새 코드를 이 디렉터리들 중 하나에 추가할 때 위 표에 없는 새 import가
필요해지면, 그 코드가 정말 그 디렉터리의 것이 맞는지부터 의심한다.

## 검증

여섯 하위 디렉터리는 각자 `test/unit/`의 대응하는 하위 디렉터리가 지킨다.
최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
