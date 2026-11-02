const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', '.tmp/**'] },
  js.configs.recommended,
  { languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: globals.node } },
];
