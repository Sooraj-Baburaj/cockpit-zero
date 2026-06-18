/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      ['desktop', 'backend', 'web', 'shared', 'eslint-config', 'tsconfig', 'repo', 'deps'],
    ],
  },
};
