import pkg from '../../package.json';

const v = typeof pkg.version === 'string' ? pkg.version : '';
export const APP_VERSION = v;

