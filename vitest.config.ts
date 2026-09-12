import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    /*
     * 러너의 타임존을 **프로덕션 표시값과 다른 값**으로 고정한다.
     *
     * `lib/resources/view.ts` 의 `formatDateTime` 은 표시 타임존을 UTC 로
     * 고정한다(서버 렌더링이라 보는 사람의 타임존을 알 수 없다). 그것을
     * 지키는 테스트가 러너 UTC 에서는 아무것도 재지 못한다 - "UTC 로
     * 그린다" 와 "러너의 로컬 시각으로 그린다" 가 같은 세계가 되기 때문이다.
     * CI(`ubuntu-latest`)가 정확히 UTC 라, 그대로 두면 그 가드가 **게이트가
     * 실제로 도는 곳에서만** 죽어 있다.
     *
     * 실측(2026-09-07): `formatDateTime` 을 로컬 타임존(`getFullYear` ·
     * `getHours` ...)으로 바꾼 뮤턴트를 바깥 셸 `TZ=UTC` 에서 돌렸을 때 -
     * 이 줄이 있으면 4 failed, 없으면 44 passed.
     *
     * "픽스처에 프로덕션 상수와 같은 값을 쓰지 마라" 가 환경 변수로 나타난
     * 자리다. 값 자체에 뜻은 없고 **UTC 가 아니라는 것**이 전부다.
     */
    env: { TZ: 'Asia/Seoul' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
})
