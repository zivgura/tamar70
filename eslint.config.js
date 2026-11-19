import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'

// Google Apps Script services used by apps-script/ (it runs as plain script files, not modules).
const appsScriptGlobals = Object.fromEntries(
  [
    'CacheService',
    'ContentService',
    'DriveApp',
    'HtmlService',
    'LockService',
    'Logger',
    'MailApp',
    'PropertiesService',
    'ScriptApp',
    'Session',
    'SpreadsheetApp',
    'UrlFetchApp',
    'Utilities',
  ].map((name) => [name, 'readonly']),
)

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', '**/node_modules', '.firebase']),

  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Node-side config files at the root and in each package.
  {
    files: ['*.config.js', '*/*.config.js'],
    languageOptions: { globals: globals.node },
  },

  // React app.
  {
    files: ['web/src/**/*.{js,jsx}'],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Plain JS project: no prop-types, Zod validates data at the edges instead.
      'react/prop-types': 'off',
    },
  },

  // Apps Script: classic scripts sharing one global scope. Top-level functions like
  // doPost() and setup() are entry points called by Google, so they look unused here.
  {
    files: ['apps-script/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: appsScriptGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_' }],
    },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
])
