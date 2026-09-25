import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import noUnsanitized from 'eslint-plugin-no-unsanitized';


export default tseslint.config(
  {
    ignores: ['typings/*', 'dist/*', 'main.js', 'styles.css']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      quotes: [
        'error', 'single',
      ],
      'jsx-quotes': [
        'error', 'prefer-double'
      ],
      indent: [
        'error', 2
      ],
      'object-curly-spacing':[
        'error', 'always'
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_'
        }
      ]
    },
  },
  {
    // The community review's config runs this plugin at error level, and it is
    // what rejected the last submission (`import()` of a computed URL). Running
    // it here too means a local `npm run lint` sees what the review sees —
    // without it the two suppressions in `src/backend/{net,languages/python}.ts`
    // would be "unknown rule" errors instead of the reasoned exceptions they
    // are. See author.md, "工具链 / 社区审核".
    plugins: { 'no-unsanitized': noUnsanitized },
    rules: {
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
    },
  },
  {
    files: ['postcss.config.js'],
    rules: {
      'no-undef': 'off'
    }
  },
  {
    // Helper scripts run under Node, not in the page.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  }
);
