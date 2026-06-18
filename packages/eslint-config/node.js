import base from './base.js';
import globals from 'globals';

/** Node service preset (backend). */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
