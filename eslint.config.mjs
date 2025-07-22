// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

// Needed because Next's provided configs are still "eslintrc" style
const compat = new FlatCompat({
  // Node 20.11+ supports import.meta.dirname; adjust if older
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended
});

export default [
  // Next.js + Core Web Vitals + TS rules, limited to the Next app
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    ...compat.config({
      extends: ['next/core-web-vitals', 'next/typescript'],
      settings: {
        react: {
          version: 'detect' // Automatically detect React version
        },
        next: {
          // Point the plugin at the Next.js project root (monorepo aware)
          // Could also be an array or a glob: ['apps/web/', 'apps/another-next/']
          rootDir: 'apps/web/'
        }
      }
    })[0] // Get the first (and only) config
  },

  // Additional (non-Next) TS rules for other packages (api, domain, ui-kit)
  {
    files: [
      'apps/api/**/*.ts',
      'packages/domain/**/*.ts',
      'packages/ui-kit/**/*.{ts,tsx,js,jsx}'
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.base.json']
      }
    },
    // You can add extra rules/plugins here if desired
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    settings: {
      react: {
        version: 'detect' // Automatically detect React version
      }
    },
    rules: {
      // Start with base recommended sets
      ...tsPlugin.configs.recommended.rules,
      // Choose whether you want the type-aware set:
      ...tsPlugin.configs['recommended-type-checked'].rules,

      // // Example targeted overrides NOT WORKING BAN-TYPES DOESN'T EXIST:
      // '@typescript-eslint/no-empty-object-type': [
      //   'error',
      //   {
      //     allowInterfaces: 'with-single-extends',
      //     allowObjectTypes: 'never'
      //   }
      // ]
    }
  },

  // Ignore build artefacts
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**']
  }
];
