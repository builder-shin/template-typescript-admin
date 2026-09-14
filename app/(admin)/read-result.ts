import type { ErrorObject } from '@/lib/jsonapi/document'
import { actionForErrors } from '@/lib/jsonapi/errors'

/**
 * 읽기 화면(대시보드·목록·상세·선택 목록) 공통의 "실패를 어떻게 보여줄지" 판단.
 *
 * `app/error.tsx` 자신의 주석은 그 파일에 transport(client.ts 가 합성한 오류 -
 * 실제로 백엔드에 못 닿은 경우)만 온다고 적어 두었지만, 이 저장소의 네 읽기
 * 호출부(`app/(admin)/page.tsx`·`[slug]/page.tsx`·`[slug]/options.ts`·
 * `[slug]/[id]/page.tsx`)는 전부 `!result.ok` 를 무조건 던졌다 - 진짜
 * 백엔드가 응답해 거절한 경우(검증 오류·500 등)까지 전부 error.tsx 로
 * 갔고, 그 파일은 `error.message`(백엔드가 준 진짜 설명)를 읽지 않고 고정
 * 문구 "백엔드에 연결할 수 없습니다"를 그린다 - 백엔드가 실제로 응답했는데도
 * "연결할 수 없다"고 말하는 거짓 진단이었다.
 *
 * `error.tsx` 가 `error.message` 를 읽게 고치지 않는다 - transport 오류의
 * `detail` 은 client.ts 가 합성한 영어 고정 문구라(client.ts:78-83) 그대로
 * 보여주면 안 된다. 대신 여기서 갈라 던진다: transport 만 던져 error.tsx 로
 * 보낸다(그 파일의 고정 문구가 참이 되는 유일한 경우) - 나머지(백엔드가
 * 실제로 낸 오류)는 던지지 않고 메시지를 돌려주므로 호출부가 화면 안에서
 * 직접 그린다(`components/form/form-banner.tsx` 재사용 - 폼이 이미 하는
 * 것과 같은 "백엔드 문구를 그대로 보여준다, 새로 짓지 않는다"는 원칙).
 *
 * `notFound`(RESOURCE_NOT_FOUND)는 이 함수가 다루지 않는다 - 호출부
 * (`[id]/page.tsx`)가 이미 `actionForErrors(...) === 'notFound'` 를 이 함수보다
 * 먼저 확인해 `notFound()` 로 보낸다. 이 함수에 들어오는 시점에는 그
 * 갈래가 이미 걸러져 있다고 가정한다.
 */
export function messageForReadFailure(errors: readonly ErrorObject[], fallback: string): string {
  if (actionForErrors(errors) === 'transport') {
    // 메시지 내용 자체는 중요하지 않다 - error.tsx 는 error.message 를
    // 사용자에게 보여주지 않는다(콘솔에만 남긴다, 그 파일 주석). 그래도
    // client.ts 가 합성한 영어 detail 을 그대로 실어 두 번째 경로로라도
    // 새어 나가는 것을 막기 위해 여기서 새 문자열로 다시 쓴다.
    throw new Error('백엔드에 연결하지 못했습니다.')
  }
  return errors[0]?.detail ?? errors[0]?.title ?? errors[0]?.code ?? fallback
}
