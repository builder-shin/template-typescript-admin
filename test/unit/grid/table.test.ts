import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { serverDrivenTableOptions } from '@/lib/grid/table'

const TABLE = 'components/data-table.tsx'

describe('serverDrivenTableOptions', () => {
  it('페이지를 서버에 맡기고 총합을 함께 넘긴다', () => {
    expect(serverDrivenTableOptions(1284)).toEqual({ manualPagination: true, rowCount: 1284 })
  })

  it('v9 에 없는 옵션 이름을 만들어 내지 않는다', () => {
    const keys = Object.keys(serverDrivenTableOptions(0))
    expect(keys).not.toContain('manualSorting')
    expect(keys).not.toContain('manualFiltering')
  })
})

describe('DataTable 배선', () => {
  it('표가 serverDrivenTableOptions 를 실제로 펼쳐 넣는다', () => {
    expect(readFileSync(TABLE, 'utf8')).toMatch(/\.\.\.serverDrivenTableOptions\(/)
  })

  it('클라이언트 정렬·필터·페이지 행 모델을 등록하지 않는다', () => {
    const source = readFileSync(TABLE, 'utf8')
    expect(source).not.toMatch(
      /createSortedRowModel|createFilteredRowModel|createPaginatedRowModel/,
    )
  })
})
