<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-12 | Updated: 2026-09-14 -->

# lib/bulk/ 작업 지침

루트 `AGENTS.md`의 계층 소유권 표가 이 디렉터리에 배정한 것: 일괄 작업의 순차
실행기 - 실행 순서, 상한, 부분 실패 집계, 취소. 화면이 무엇을 그릴지도,
요청을 어떻게 만들지도 이 디렉터리의 일이 아니다 - `run` 콜백 하나만 받아
그것을 몇 번, 어떤 순서로, 언제까지 부를지만 정한다.

## 벌크 엔드포인트가 없다 - 그 사실이 이 디렉터리 전부를 정한다

라우트 목록 어디에도 bulk·batch·JSON:API 1.1 의 atomic:operations 가 없다.
행 열두 개를 지우는 것은 DELETE 열두 번이라는 뜻이고, 이 사실 하나가 아래
셋을 전부 정한다.

- **순차 실행과 상한.** 동시성을 묶지 않으면 화면에서 몇 줄 고른 클릭 한 번이
  백엔드에 동시 요청 여러 개를 낸다. 어드민의 일괄 삭제는 그것을 의도적으로
  하는 기능이므로 상한이 기능의 일부다 - `MAX_BULK_ITEMS`(50)는 `executor.ts`
  단 한 자리에 선언되어 있고, `runBulk`는 앞선 요청이 끝난 뒤에만 다음 요청을
  낸다(`Promise.all`로 흩뿌리지 않는다).
- **부분 실패는 1급 결과다.** 하나가 실패해도 나머지를 계속 보낸다. 실패를
  이유로 멈추면 열두 건 중 이미 지워진 아홉 건까지 모호해진다 - 그래서
  실행기는 성공이든 실패든 행마다 `BulkOutcome` 하나씩을 모아 전부 돌려준다.
- **취소는 남은 요청만 막는다.** `options.signal`이 끊기면 다음 요청을 내지
  않을 뿐, 이미 보낸 요청은 되돌리지 않는다 - 되돌릴 라우트가 없어서다.
  보상 트랜잭션을 만들면 존재하지 않는 백엔드 계약을 흉내 내는 셈이 된다.

## 무엇이 실제로 실패하는가 - 422 픽스처를 지어내지 마라

실측(`app/controllers/concerns/crud_actions.py`의 `destroy`): 성공은 204다.
거절 경로는 `reject_query_parameters` → `_find_resource`(없으면 404) →
`before_destroy` 훅 → 삭제 순이고, `examples`는 그 훅을 재정의하지 않는다.
`example_tags`가 `ondelete="CASCADE"`라 태그가 붙은 행도 그냥 지워진다 -
참조 무결성 때문에 거절되는 경로가 없다. 그래서 삭제는 **422를 내지 않는다.**

실행 중 세션이 만료되면 401도 온다. 그래도 반복되는 실패의 대부분은
404다 - 다른 운영자가 먼저 지웠거나 그리드가 낡았다는 뜻이고, 화면이 그 문구를
지어내지 않고 오류 배열을 그대로 들고 가야 하는 이유이기도 하다(아래).

## 실행기는 순수 함수다 - `run`이 무엇을 하는지 모른다

`runBulk`은 `id` 하나를 받아 `Promise<BulkOutcome>`을 돌려주는 콜백만 받는다.
`BulkOutcome.errors`는 백엔드가 낸 오류 배열을 그대로 들고 간다 - `status`·
`detail`만 뽑아 새 객체로 옮기지 않는다. 그러면 `code`가 사라지는데, `code`는
`lib/jsonapi/errors.ts`의 오류 라우팅 전체가 기대는 유일한 필드다. 그것을
버리면 소비자가 HTTP 상태 문자열로 정책을 다시 판단하게 되어 이미 있는 결정을
둘로 나눈다.

위반의 정의 - 다음 중 하나라도 코드에 나타나면 위반이다(규칙 자체를 설명하는
문장 안의 예시는 대상이 아니다):

- `lib/bulk/*.ts`에서 `fetch`를 부르거나 `lib/jsonapi/client.ts`를 값으로
  import하면 위반이다 - 요청을 만드는 것은 이 디렉터리의 일이 아니다.
- `examples`처럼 이 저장소의 실제 자원 이름을 가리키는 문자열 리터럴이
  코드로 나타나면 위반이다 - `runBulk`은 어떤 자원의 무엇을 실행하는지 몰라야
  한다.
- `lib/bulk/*.ts`에 JSX가 있으면 위반이다 - 렌더링은 이 실행기를 부르는
  화면의 몫이다.
- `BulkOutcome`을 만들 때 오류 배열의 일부 필드만(`status`·`detail`) 뽑아 새
  객체로 옮겨 담으면 위반이다 - `code`가 빠진다.

## 값 import 를 두지 않는다 - `import type`은 허용한다

`lib/auth/form-state.ts`·`lib/form/form-state.ts`는 다른 모듈의
타입을 쓸 일이 없어서 애초에 import 문이 없다. `executor.ts`는 사정이
다르다 - `BulkOutcome.errors`가 `lib/jsonapi/document.ts`의 `ErrorObject`를
그대로 들고 가야 해서 다른 파일의 타입이 실제로 필요하다. 이 타입은
`import type { ErrorObject } from '@/lib/jsonapi/document'`로 가져온다 -
`lib/jsonapi/errors.ts`·`lib/auth/flow.ts`·`lib/auth/credentials.ts`·
`lib/form/flow.ts`가 이미 같은 타입을 같은 방식으로 가져오는
그대로다.

지켜야 할 성질은 **값 import가 없다**이지 "import 문이 없다"가 아니다 -
`import type` 문은 컴파일에서 완전히 지워져 런타임에 어떤 모듈도 끌어들이지
않으므로, `lib/jsonapi/client.ts`(그리고 그 너머 `process.env`를 읽는
`lib/config/settings.ts`)를 클라이언트 번들에 끌어들일 수 없다. 읽는 사람이
확인할 것은 **이 파일의 import 줄이 전부 `import type`으로 시작하는가**
하나다 - 빌드도 번들도 없이 파일을 읽는 것만으로 확인된다.

위반의 정의: `executor.ts`에 값 import(예: `import { request } from
'@/lib/jsonapi/client'`)가 하나라도 생기면 위반이다. `import type` 문을
추가하는 것은 위반이 아니다.

## 주요 파일

| 파일          | 역할                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| `executor.ts` | `runBulk()` - 순차 실행·상한·부분 실패 집계·취소. `MAX_BULK_ITEMS` 선언. |

## 검증과 의존성

순수 함수라 `test/unit/bulk/`가 전부 확인한다. 최종 검증은 `./scripts/check.sh`
다.

내부 의존성은 `lib/jsonapi/document.ts`의 `ErrorObject` 타입 하나뿐이고,
위에서 설명한 이유로 `import type`으로 가져온다(값 import는 아니다). 그 밖의
`lib/`·`app/`은 import하지 않는다. 소비자는 JSON:API 결과를
`BulkOutcome`으로 바꾸는 `run` 콜백을 채워 `runBulk`을 부르는 Server
Action(`app/(admin)/examples/actions.ts`)과 그 결과를 그리는 화면이다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
