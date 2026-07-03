import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'supabase',
    'tools',
    'scripts',
    'api',
    'api-handlers',
    'workers',
    'server',
    'jobs',
    'lib',
    'scratch'
  ]),
  // 1. Configuração geral para JavaScript
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly'
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
    }
  },
  // 2. Configuração específica para componentes e hooks React
  {
    files: [
      'src/components/**/*.js',
      'src/components/**/*.jsx',
      'src/hooks/**/*.js',
      'src/contexts/**/*.js',
      'src/contexts/**/*.jsx',
      'src/pages/**/*.js',
      'src/pages/**/*.jsx'
    ],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'off',
    }
  }
])
