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
    // `useActionState` 가 요구하는 `(state, formData)` 자리를 채우기 위해
    // 일부러 안 쓰는 인자에 관례상 밑줄을 붙인다(`_state`·`_previous`·
    // `_formData` 등). `no-unused-vars` 의 기본 옵션(`args: 'after-used'`)은
    // 뒤에 쓰이는 인자가 있을 때만 그 앞의 안 쓰는 인자를 봐준다 - 안 쓰는
    // 인자가 맨 뒤에 오면 위치적 예외가 없어 밑줄 관례만으로는 통과하지
    // 않는다.
    //
    // `files:` 로 스코프를 좁힌 별도 블록이다. 규칙 옵션은 통째로
    // 재지정되므로 - `argsIgnorePattern` 하나만 넘겨도 `varsIgnorePattern`·
    // `caughtErrors` 가 typescript-eslint 기본값으로 되돌아간다 - 이 완화가
    // 걸리는 범위를 실제로 필요한 자리로 줄인다. 필요한 곳은
    // `useActionState` 가 모양을 정하는 Server Action 파일들뿐이고, 나머지
    // 저장소(테스트 포함)는 recommendedTypeChecked 의 기본 규칙을 그대로
    // 받는다.
    files: ['app/**/actions.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
)
