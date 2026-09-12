import { describe, expect, it } from 'vitest'
import { ROW_CLICK_IGNORED_SELECTOR, shouldNavigateFromRowClick } from '@/components/grid/row-click'

/**
 * 행 전체를 누르면 상세로 가지만, 행 안의 컨트롤을 누른 것은 그 컨트롤의
 * 일이다. 이 판정을 컴포넌트에서 떼어낸 이유는 이 저장소에 DOM 테스트
 * 하네스가 없어서다(test/AGENTS.md) - `closest()` 호출 자체는 컴포넌트에
 * 남고, **무엇을 무시하는가**와 **언제 이동하는가**만 여기서 잰다.
 */

describe('ROW_CLICK_IGNORED_SELECTOR', () => {
  /**
   * 회귀가 실제로 일어나는 모양: 누군가 행에 컨트롤을 하나 더 붙이고 이
   * 목록에 추가하는 것을 잊는다. 그러면 그 컨트롤을 누를 때마다 상세로
   * 튕겨 나간다 - 선택 체크박스가 그 첫 번째 후보다.
   */
  it('행이 실제로 담는 컨트롤을 전부 덮는다', () => {
    for (const selector of ['button', 'a', 'input', 'label', '[role="checkbox"]']) {
      expect(ROW_CLICK_IGNORED_SELECTOR).toContain(selector)
    }
  })

  it('쉼표로 이어진 유효한 선택자 목록이다 - 빈 조각이 없다', () => {
    // 빈 조각이 하나라도 있으면 `closest()` 가 던지고 행 클릭이 통째로 죽는다.
    const parts = ROW_CLICK_IGNORED_SELECTOR.split(',').map((part) => part.trim())
    expect(parts.length).toBeGreaterThan(0)
    for (const part of parts) expect(part).not.toBe('')
  })
})

describe('shouldNavigateFromRowClick', () => {
  it('빈 자리를 누르면 이동한다', () => {
    expect(shouldNavigateFromRowClick({ insideIgnored: false, selectedText: '' })).toBe(true)
  })

  it('컨트롤 안을 누르면 이동하지 않는다 - 체크박스는 선택이지 이동이 아니다', () => {
    expect(shouldNavigateFromRowClick({ insideIgnored: true, selectedText: '' })).toBe(false)
  })

  it('글자를 드래그해 고른 뒤 놓은 것은 이동이 아니다', () => {
    // 셀의 텍스트를 복사하려고 드래그하면 mouseup 이 행에서 일어난다.
    // 그것을 이동으로 읽으면 복사가 불가능해진다.
    expect(shouldNavigateFromRowClick({ insideIgnored: false, selectedText: 'probe-seed' })).toBe(
      false,
    )
  })

  it('공백만 고른 것은 고른 것으로 세지 않는다', () => {
    // getSelection().toString() 은 클릭만 해도 빈 문자열이 아닌 공백을
    // 돌려주는 경우가 있다(실측: 브라우저·요소에 따라 다르다).
    expect(shouldNavigateFromRowClick({ insideIgnored: false, selectedText: '   ' })).toBe(true)
  })
})
