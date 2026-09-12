import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs', 'postcss.config.mjs'] },
      },
    },
  },
  {
    // (D4 Task 6·7) `useActionState` 가 요구하는 `(state, formData)` 자리를
    // 채우기 위해 일부러 안 쓰는 인자에 관례상 밑줄을 붙인다(이 저장소
    // 전역에서 이미 쓰던 관례 - `_state`·`_previous`·`_formData` 등,
    // app/(auth)/actions.ts 의 loginAction/registerAction 이 먼저 썼다).
    // 지금까지는 그 인자들이 우연히 "마지막으로 쓰인 인자 앞"이라는
    // 위치적 예외(`args: 'after-used'`)로만 통과했을 뿐, 이 옵션이 없어
    // 실제로 지켜지지는 않았다 - `deleteExampleAction`(둘 다 뒤쪽이라
    // 위치 예외가 없다)에서 처음 드러났다.
    //
    // **`files:` 로 스코프를 좁힌 별도 블록이다**(브랜치 리뷰 Minor-5).
    // 규칙 옵션은 통째로 재지정되므로 - `argsIgnorePattern` 하나만 넘겨도
    // `varsIgnorePattern`·`caughtErrors` 가 typescript-eslint 기본값으로
    // 되돌아간다 - 이 완화가 걸리는 범위를 실제로 필요한 자리로 줄인다.
    // 필요한 곳은 `useActionState` 가 모양을 정하는 Server Action 파일들뿐이고,
    // 나머지 저장소(테스트 포함)는 recommendedTypeChecked 의 기본 규칙을
    // 그대로 받는다.
    files: ['app/**/actions.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
)
