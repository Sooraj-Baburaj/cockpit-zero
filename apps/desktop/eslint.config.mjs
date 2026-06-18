import react from '@cockpitzero/eslint-config/react';

// The react preset extends the base (TS) config and layers React rules onto
// .tsx files; main/preload .ts files just get the base rules.
export default [...react, { ignores: ['out/**', 'release/**'] }];
