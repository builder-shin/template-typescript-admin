<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-12 -->

# lib/ 작업 지침

일곱 하위 디렉터리로 나뉜 순수 함수 계층을 모은다. 각자의 로컬 계약(자원을
모른다, JSX를 두지 않는다 등)은 자신의 `AGENTS.md`가 소유한다 - 이 파일은
**그 일곱 사이의 의존 방향**, 즉 누가 누구를 import할 수 있는가만 소유한다.

## 의존 방향

| 디렉터리         | import할 수 있는 내부 모듈                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/config/`    | 없음 - 기반 계층이다.                                                                                                                                                                                                                                                                                                                                                               |
| `lib/resources/` | 없음 - 자원을 선언만 하는 순수 계층이다. `lib/jsonapi/`조차 소비하지 않는다.                                                                                                                                                                                                                                                                                                        |
| `lib/jsonapi/`   | `lib/config/`(설정을 읽어 요청을 조립한다)                                                                                                                                                                                                                                                                                                                                          |
| `lib/grid/`      | `lib/resources/`가 내보내는 `ResourceDef` **타입**만(`import type`). 값 import는 없다.                                                                                                                                                                                                                                                                                              |
| `lib/bulk/`      | `lib/jsonapi/document.ts`의 `ErrorObject` **타입**만(`import type`). 값 import는 없다.                                                                                                                                                                                                                                                                                              |
| `lib/auth/`      | `lib/jsonapi/`, `lib/config/settings.ts`                                                                                                                                                                                                                                                                                                                                            |
| `lib/form/`      | `lib/resources/`(타입과 `formAttributes` 등 값), `lib/jsonapi/document.ts`(타입), `lib/jsonapi/normalize.ts`·`lib/jsonapi/errors.ts`(값). **`lib/jsonapi/client.ts` 는 쓰지 않는다** - 그 파일은 `lib/config/settings.ts`(서버 전용)에 닿는데, `lib/form/form-state.ts` 는 클라이언트 폼이 값으로 가져가므로 런타임 import 가 0개여야 하고 나머지 파일도 그 사슬에 들어가지 않는다. |

화살표로 그리면 `lib/config/` → `lib/jsonapi/` → `lib/auth/`가 값을 주고받는
한 줄기이고, `lib/resources/` → `lib/grid/`·`lib/bulk/`가 타입만 주고받는
독립된 줄기다. 두 줄기는 서로 만나지 않는다 - `lib/grid/`·`lib/bulk/`는
`lib/jsonapi/`를 값으로 쓰지 않고(요청을 만드는 것이 이 둘의 일이 아니므로),
`lib/resources/`는 그 무엇도 소비하지 않는다.

`lib/form/`은 예외적으로 두 줄기에 모두 닿는다 - `lib/resources/`의 선언을
읽어 `lib/jsonapi/`의 문서 모양으로 조립하는 것이 그 디렉터리의 일 자체라서다.
그래도 `lib/jsonapi/client.ts`(→ `lib/config/`)에는 닿지 않는다.

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

일곱 하위 디렉터리는 각자 `test/unit/`의 대응하는 하위 디렉터리가 지킨다.
최종 검증은 `./scripts/check.sh`다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 복사해 온 코어 안에서, 이 저장소가 실제로 쓰지 않는 자리

`lib/jsonapi`·`lib/auth` 는 `docs/provenance/copied-core.json` 이 기록한
복사본이다 - 그 기록(`note`/`divergences`)은 "원본과 갈라진 곳"만 남기고
"원본 그대로인데 이 저장소가 안 쓰는 곳"은 남기지 않는다. 그 자리는 여기
적는다 - 복사본 자신의 주석은 (원본 저장소 기준으로는 참이라) 고치지
않지만, 그 주석이 "이 함수가 유일한 규칙"이라고 말하는 것을 이 저장소에서
그대로 믿으면 안 되는 자리들이다.

- **`lib/jsonapi/query.ts` 전체(19개 export, `buildQuery`·`filterParameter`
  등)가 이 저장소에서 쓰이는 곳은 자기 자신의 테스트
  (`test/unit/jsonapi/query.test.ts`) 뿐이다** - 실측: 저장소 전체에서
  `jsonapi/query`(이 파일 자신의 경로)를 값으로 import 하는 곳이 그 테스트
  말고 없다. 그 파일 자신의 주석(`filterParameter` 앞, 예: "그래서 규칙을
  이 함수 하나에 둔다")은 원본 저장소에서는 참이지만 여기서는 아니다 -
  **실제로 살아 있는 질의 조립기는 `lib/grid/query.ts` 의 `gridQuery`**
  (`app/(admin)/examples/list.ts`·`app/(admin)/recent.ts` 가 부른다)다. 이
  둘의 필터 연산자 어휘(`FilterOperator`)가 겹치는 것도 우연이 아니라
  의도된 중복이다 - `lib/resources/define.ts` 가 내부 모듈을 하나도 import
  하지 않는다는 그 디렉터리 자신의 계약 때문에, `lib/resources` 가 아는
  연산자 집합을 `lib/jsonapi/query.ts` 에서 다시 가져올 수 없다. 하나로
  합칠 자리가 아니라는 뜻이다 - 손대지 마라.
- **`lib/auth`의 가입(registration) 표면이 이 저장소에서 도달 불가능하다.**
  `decideAfterRegistration`·`authLinkHref`·`signUpThenSignIn`·`signUp`·
  `interpretSignUpResult`·`registerDocument`·`REGISTER_TYPE` 전부 프로덕션
  소비자가 0개다(실측 - 전부 `test/unit/auth/`에서만 불린다). 이유는 이미
  `app/(auth)/actions.ts` 머리말이 적어 두었다 - 가입 화면 자체가 없다(첫
  운영자는 `scripts/seed-operator.ts`), 그리고 이 코어는 다른 프론트엔드
  템플릿과 공유되므로 안 쓰는 절반을 지우면 다음 동기화 때 "의도된 축소"와
  "드리프트"를 구별할 수 없게 된다 - 그래서 지우지 않는다.
  - 따름정리: **`AuthFormState.accountCreated` 는 이 저장소의 실제 실행
    경로에서 `true` 가 될 수 없다.** 그 값을 정하는 갈래가 둘인데
    (`lib/auth/flow.ts`), 로그인이 실제로 쓰는 `decideAfterLogin` 은 항상
    `accountCreated: false` 를 하드코딩하고, `true` 를 주는 쪽
    (`decideAfterRegistration`)은 위 항목대로 도달 불가능하다. 이 필드를
    읽는 화면도 없다(실측 - `lib/auth/` 밖 어디서도 `accountCreated` 를
    읽지 않는다). 타입은 `boolean` 이지만 사실상 상수 `false` 다.

### 메모이즈되는 설정 오류 - `lib/config/settings.ts` 의 "시작에 실패한다"

그 파일 머리말은 "필수 변수가 없으면 시작에 실패한다"고 적는다 -
`getSettings()` 자신은 그 실패를 프로세스당 한 번으로 메모이즈할 뿐, **첫
호출이 언제 일어나는지는 정하지 않는다.** 아무도 기동 시점에 부르지 않으면
첫 호출은 곧 첫 실제 요청이 되어 "시작 실패"가 아니라 "운영자가 첫 화면을
열 때 만나는 500"이 된다 - 실측: `test/unit/auth/logout.test.ts` 가
`BACKEND_URL=''` 로 모듈을 새로 불러와도 `endSession()` 을 실제로 부를
때만 던지는 것을 이미 확인해 둔다(모듈을 불러오는 시점이 아니다).

루트 `instrumentation.ts` 가 `register()` 훅에서 `getSettings()` 를 미리
불러 이 첫 호출을 요청보다 앞으로 옮긴다 - 그런데 **그래도 "시작 실패"는
아니다, 실측했다.** `next build` 뒤 `node .next/standalone/server.js` 를
깨진 `BACKEND_URL` 로 띄우면 서버는 "✓ Ready" 를 찍고 포트를 계속 듣는다 -
`register()` 가 던진 예외는 "Failed to prepare server" 로그와
`unhandledRejection` 으로 남지만 **프로세스는 종료되지 않는다.** 그 뒤
모든 요청이(첫 요청만이 아니라, 그리고 어떤 요청이 우연히 `getSettings()`
를 먼저 건드리는지와 무관하게) 즉시 500 을 받는다 - `instrumentation.ts`
가 얻는 것은 "프로세스가 죽는다"가 아니라 "실패가 균일하고 즉각적이다"
이다. "배포 자체가 거부된다"는 의미의 시작 실패를 원하면 오케스트레이션
계층(헬스체크가 최초 몇 초의 500 을 보고 배포를 되돌리는 것 등)이 별도로
있어야 한다.

즉 `settings.ts` 머리말의 문구는 `instrumentation.ts` 가 있어도 글자
그대로는 여전히 참이 아니다 - 더 정확한 서술은 "필수 변수가 없으면 서버가
뜬 직후부터 모든 요청이 균일하게 500 을 받는다"이다. 그 파일 자신은
복사해 온 코어라 문구를 고치지 않았다.
