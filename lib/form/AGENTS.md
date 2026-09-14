<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-14 | Updated: 2026-09-14 -->

# lib/form/ 작업 지침

폼과 백엔드 문서 사이의 순수 변환을 소유한다 - 선언 + `FormData` → JSON:API
쓰기 문서, 응답 문서 → 폼 초기값·선택 목록, 오류 배열 → 폼 상태.
`lib/grid/` 가 "URL 이 말하는 것을 백엔드에게 묻는다"는 경계 하나를 갖듯,
이 디렉터리는 "폼이 말하는 것을 백엔드 문서로, 백엔드 문서를 폼이 드는
값으로" 바꾸는 경계 하나를 갖는다.

## 자원을 모른다

이 디렉터리는 이 저장소의 실제 자원이 무엇인지 몰라야 한다. 함수는 전부
`ResourceDef` 를 인자로 받고, 그 값이 건네주는 속성·관계 선언만 읽는다 -
자원이 `examples` 든 다른 무엇이든 이 디렉터리의 코드는 똑같이 동작해야
한다. 위반의 정의는 `lib/grid/AGENTS.md` 와 같다 - 실제 자원 이름·필드
이름(`title`·`category` 등)을 가리키는 문자열 리터럴이나 그 이름에 의존하는
분기가 코드에 나타나면 위반이다. 종류(`kind`)·cardinality 로 분기하는 것은
자원 분기가 아니다.

JSX 를 두지 않는다. `fetch` 도 `request()` 도 부르지 않는다 - 보낼 문서를
조립하고 받은 문서를 해석할 뿐이고, 실제로 부르는 것은 `app/` 의 Server
Action 과 화면이다.

## 주요 파일

| 파일            | 역할                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-state.ts` | `ResourceFormState`·`IDLE_RESOURCE_FORM_STATE`·`ResourceFormAction`·`UNUSABLE_RESOURCE_MESSAGE`. **런타임 import 0개** - 클라이언트 폼이 값으로 가져간다. |
| `flow.ts`       | `resourceFormState(errors)` - 오류 배열 → 폼 상태. `lib/auth/flow.ts` 와 같은 분리.                                                                       |
| `write.ts`      | `writeDocument(resource, formData, id?)` - `formAttributes` 로 화이트리스트 조립. 빈 값·종류별 규칙은 파일 머리말.                                        |
| `values.ts`     | `headingLabel(target, headingKey)`·`initialFormValues(resource, object)` - 응답 → 폼 값.                                                                  |
| `options.ts`    | `OptionItem`·`optionsFromDocument(resource, document)` - 대상 자원의 `heading` 으로 선택 목록.                                                            |

## `form-state.ts` 에 import 를 추가하지 마라

`components/resource/resource-form.tsx`(`'use client'`)가 이 파일의 값을
가져간다. import 가 하나라도 생기면 그 사슬이 클라이언트 번들에 들어온다 -
`lib/jsonapi/errors` → `lib/jsonapi/client` → `lib/config/settings.ts`
(`process.env` 를 읽는 서버 전용 코드)까지 닿는 것이 한 줄이면 충분하다.
`test/unit/components/boundary-policy.test.ts` 의 둘째 방향이 이것을 잰다.
같은 이유로 이 디렉터리의 어떤 파일도 `lib/jsonapi/client.ts` 를 쓰지
않는다 - `[path, options]` 튜플 조립은 `app/(admin)/…/write.ts` 가 갖는다.

## 검증과 의존성

순수 변환은 `test/unit/form/` 이 확인한다. 최종 검증은 `./scripts/check.sh` 다.

내부 의존성은 `lib/resources/`(타입과 `formAttributes` 등 값),
`lib/jsonapi/document.ts`(타입), `lib/jsonapi/normalize.ts`·
`lib/jsonapi/errors.ts`(값)다(`lib/AGENTS.md` 의 의존 방향 표). 소비자는
`components/resource/`·`components/grid/format.ts`·`app/` 이다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
