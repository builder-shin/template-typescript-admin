<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-09-11 | Updated: 2026-09-11 -->

# lib/config/ 작업 지침

`settings.ts`가 환경변수를 읽어 `Settings`로 바꾸는 계약을 소유한다.

| API                  | 역할                                          |
| -------------------- | --------------------------------------------- |
| `loadSettings(env?)` | 주어진 환경 또는 `process.env`를 파싱한다.    |
| `getSettings()`      | 프로세스 환경에서 읽은 설정을 한 번 캐시한다. |

`BACKEND_URL`은 필수 HTTP(S) 절대 URL이며 끝 슬래시를 제거한다.
`SESSION_COOKIE_SECURE`는 `true`·`false`만 받고, 생략하거나 비면
`NODE_ENV === 'production'`을 기본값으로 쓴다. 필수 설정 오류를 임의 기본값이나
요청 실패 결과로 숨기지 않는다.

환경변수와 기본값을 바꾸면 이 파일, 루트 `.env.example`, `README.md`의 환경
변수 표를 함께 맞춘다. 단위 테스트는 명시적인 환경을 `loadSettings`에 넘기는
`test/unit/config/settings.test.ts`를 확인하고, 최종 검증은 `./scripts/check.sh`를 따른다.

소비자는 `lib/jsonapi/client.ts`, 세션 쿠키 작성 코드와 `proxy.ts`다.
외부 설정 라이브러리 없이 Node의 환경과 표준 `URL`을 사용한다.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
