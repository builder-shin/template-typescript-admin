/**
 * 로그인 화면이 쓰는 껍데기 - 헤더도 사이드바도 없는 뷰포트 전체.
 *
 * `(auth)`는 라우트 그룹이라 URL 에 세그먼트를 더하지 않는다 - 경로는
 * `/login` 그대로다.
 *
 * **이 위에는 아무것도 없어야 한다.** `min-h-svh`가 뷰포트 전체를 그대로
 * 차지하는 것이 이 레이아웃의 전제다 - 위에 헤더나 세션 바가 얹히면
 * `헤더 + 100svh`가 되어 그 높이만큼 세로 스크롤이 생긴다. `(admin)` 그룹의
 * 사이드바·헤더 셸(`app/(admin)/layout.tsx`)은 이 그룹 밖에 있다.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-svh flex-col items-center justify-center p-8">{children}</main>
}
