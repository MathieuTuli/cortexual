import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'data', 'eval-*', '*.cjs'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Most `any`s live in vite.config.ts's Connect middleware signatures and
      // api.ts's fetch wrappers. Both are slated for replacement by the
      // standalone server (plan node D1), so warn rather than block.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'postcss.config.js', 'tailwind.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
