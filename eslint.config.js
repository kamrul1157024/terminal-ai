import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'build/**']
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      // TypeScript specific rules - more lenient during transition
      '@typescript-eslint/no-explicit-any': 'error', // Downgraded from error to warn
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_' 
      }],
      
      // Disable some rules during migration
      'no-unused-vars': 'off', // Let TypeScript handle this
      'no-undef': 'off', // TypeScript handles this better
      'no-useless-escape': 'warn',
      
      // Console warnings during transition
      'no-console': 'off', // Temporarily disable console warnings
      
      // Import rules
      'import/order': [
        'error',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          'alphabetize': { 'order': 'asc', 'caseInsensitive': true }
        }
      ]
    }
  }
]; 