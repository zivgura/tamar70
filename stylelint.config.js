// Enforces the design system: colors, fonts, font sizes, radii and shadows come from
// web/src/theme/tokens.css. That file is the only place raw values may appear.
const fromToken = (prefix) => [new RegExp(`^var\\(--${prefix}`), 'inherit']

export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // No raw colors anywhere: use var(--color-*), or var(--tone-*) for category accents.
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': [
      'rgb',
      'rgba',
      'hsl',
      'hsla',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
    ],

    'declaration-property-value-allowed-list': {
      'font-family': fromToken('font-'),
      'font-size': fromToken('text-'),
      'font-weight': fromToken('weight-'),
      'line-height': [...fromToken('leading-'), '1', '0'],
      'border-radius': [...fromToken('radius-'), '0', '50%'],
      'box-shadow': [...fromToken('shadow-'), 'none'],
    },

    // CSS Modules use camelCase class names (styles.storyCard).
    'selector-class-pattern': [
      '^[a-z][a-zA-Z0-9]*$|^visually-hidden$',
      { message: 'Use camelCase class names (CSS Modules)' },
    ],
    // Tokens use --palette-cream-50 style names, grouped with blank lines.
    'custom-property-pattern': '^[a-z][a-z0-9-]*$',
    'custom-property-empty-line-before': null,
  },
  overrides: [
    {
      files: ['web/src/theme/tokens.css'],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
        'declaration-property-value-allowed-list': null,
      },
    },
    {
      // The styleguide displays each token through var(--swatch), which is set to a token.
      files: ['web/src/pages/Styleguide.module.css'],
      rules: { 'declaration-property-value-allowed-list': null },
    },
  ],
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
}
