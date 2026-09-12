import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    /*
     * 러너의 타임존을 **프로덕션 표시값과 다른 값**으로 고정한다.
     *
     * 서버 렌더링은 보는 사람의 타임존을 알 수 없으므로, 날짜·시각을
     * 고정된 타임존(예: UTC)으로 표시하는 코드가 이 저장소에 들어올 수
     * 있다. 그것을 지키는 테스트가 러너의 로컬 타임존과 그 고정값이
     * 우연히 같으면(예: 둘 다 UTC) "고정 타임존으로 그린다"와 "러너의
     * 로컬 시각으로 그린다"가 같은 세계가 되어 버려, 로컬 시각을 쓰는
     * 회귀를 잡지 못한다. CI(`ubuntu-latest`)가 정확히 UTC 라, 그대로
     * 두면 이런 회귀가 **게이트가 실제로 도는 곳에서만** 드러나지 않는다.
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
