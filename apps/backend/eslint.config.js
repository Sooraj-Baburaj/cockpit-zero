import node from '@cockpitzero/eslint-config/node';

export default [...node, { ignores: ['tsup.config.ts', 'drizzle.config.ts', 'drizzle/**'] }];
