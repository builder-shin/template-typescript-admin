/**
 * 그리드 행 전체를 눌렀을 때 상세로 갈지 말지.
 *
 * `resource-grid.tsx`(`'use client'`)가 아니라 여기 두는 이유는
 * `components/grid/format.ts` 와 같다 - 순수 함수는 지시어가 붙은 파일에
 * 있을 이유가 없고, 거기 두면 나중에 서버 컴포넌트가 값으로 부를 때 죽는
 * 자리가 된다(루트 `AGENTS.md` 규칙 6). 이 저장소에 DOM 테스트 하네스가
 * 없어서(`test/AGENTS.md`) `closest()` 호출은 컴포넌트에 남고, **무엇을
 * 무시하는가**와 **언제 이동하는가**만 잴 수 있게 떼어냈다.
 */

/**
 * 이 선택자에 걸리는 요소 안에서 시작된 클릭은 이동이 아니다 - 그 컨트롤의
 * 일이다.
 *
 * `[role="checkbox"]` 가 목록에 있는 이유: 행의 선택 체크박스는
 * `@base-ui/react` 의 `Checkbox` 이고 네이티브 `<input type=checkbox>` 가
 * 아니라 **`<span>` 에 role 을 붙이고 숨은 `<input>` 을 곁에 렌더한다**
 * (`CheckboxRoot.d.ts`). `input` 만 적으면 눈에 보이는 그 span 을 누르는
 * 실제 경로가 빠진다.
 *
 * **행에 컨트롤을 더할 때 이 목록도 함께 본다.** 빠뜨리면 그 컨트롤을 누를
 * 때마다 상세로 튕겨 나가고, 증상이 "체크박스가 안 눌린다"로 나타나서
 * 원인이 이 파일에 있다는 것을 짐작하기 어렵다.
 */
export const ROW_CLICK_IGNORED_SELECTOR =
  'button, a, input, label, select, textarea, [role="checkbox"], [role="button"], [role="menuitem"]'

/**
 * `insideIgnored` - 클릭이 위 선택자에 걸리는 요소 안에서 시작됐는지.
 * `selectedText` - 그 시점에 사용자가 고른 글자(`getSelection()`).
 *
 * 글자를 고른 상태를 이동에서 빼는 이유: 셀의 텍스트를 복사하려고 드래그하면
 * `mouseup` 이 행에서 일어난다. 그것을 이동으로 읽으면 표에서 값을 복사하는
 * 일이 불가능해진다 - 운영자가 ID 나 제목을 다른 데 옮겨 적는 것은 흔한 일이다.
 */
export function shouldNavigateFromRowClick(input: {
  insideIgnored: boolean
  selectedText: string
}): boolean {
  if (input.insideIgnored) return false
  return input.selectedText.trim() === ''
}
