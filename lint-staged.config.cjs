const base = require('@devground/lint-staged-config');

module.exports = {
  ...base,
  '*.{js,mjs,cjs,jsx}': ['eslint --fix', 'prettier --write'],
};
