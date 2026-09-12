# syntax=docker/dockerfile:1
#
# E2E 스택의 `web` 서비스가 빌드하는 이 앱의 프로덕션 이미지.
# 스테이지 이름(base·deps·build·runtime)은 형제 저장소
# (template-typescript-nextjs)의 Dockerfile을 그대로 미러링한다 -
# docker-compose.e2e.yml의 `web.build.target: runtime`이 마지막 스테이지
# 이름으로 이 값을 그대로 기대한다.

FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build 는 이 저장소에서 BACKEND_URL 을 읽지 않는다(모든 읽기가 요청
# 시점의 getSettings() 다 - lib/config/settings.ts). 그래도 빌드가 설정 로딩
# 경로를 건드리게 되면 여기서 자리표시자를 준다 - 형제 저장소와 같은 이유의
# 같은 방어다.
ENV BACKEND_URL=http://build-time-placeholder.invalid
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# Next standalone 의 server.js 는 `process.env.HOSTNAME || '0.0.0.0'`로 바인드
# 주소를 정한다. Docker 가 컨테이너마다 HOSTNAME 을 컨테이너 ID로 자동 채워
# 넣으므로 `|| '0.0.0.0'` 폴백이 발동하지 않아, 이 줄이 없으면 서버가
# 0.0.0.0 이 아니라 컨테이너 자신의 브리지 네트워크 IP 하나에만 바인드된다 -
# 호스트에서 퍼블리시된 포트로는 여전히 붙지만, 컨테이너 내부에서 127.0.0.1
# 로 찌르는 아래 HEALTHCHECK 는 ECONNREFUSED 로 죽는다. 이 ENV 가 Docker 의
# 자동 HOSTNAME 을 이 값으로 덮어써서 폴백이 아니라 이 리터럴이 쓰이게 한다.
ENV HOSTNAME="0.0.0.0"
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# 정본(template-typescript-nextjs)은 여기 `public/`도 복사한다. 이 저장소는
# `public/` 디렉터리 자체가 없다(실측: `git ls-files public` 0건 - 빈
# 디렉터리는 git이 추적하지 않는다, `proxy.ts`의 "지금은 public/이 비어
# 있어 무해하지만" 절이 이미 그 상태를 전제한다) - 없는 경로를 COPY하면
# 빌드가 그 자리에서 죽는다. `public/`이 생기면(로고·favicon 등) 이 줄을
# 그대로 되돌린다.
EXPOSE 3000
# node server.js 가 뜨는 것과 Next 가 실제로 포트를 listen 하는 것은 다른
# 순간이다 - 헬스체크가 없으면 `docker compose up --wait` 가 프로세스 기동만
# 보고 먼저 돌아와, 콜드 스타트 중인 컨테이너에 Playwright 가 ECONNREFUSED 로
# 튈 수 있다. curl/wget 이 alpine 베이스에 기본으로 없어 Node 내장 fetch 로
# 대체한다.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const p = process.env.PORT ?? 3000; fetch('http://127.0.0.1:' + p + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
