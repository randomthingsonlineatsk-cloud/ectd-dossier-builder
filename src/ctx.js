import { createContext, useContext } from 'react';
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
export const MODULE_VAR = { 1: 'var(--m1)', 2: 'var(--m2)', 3: 'var(--m3)', 4: 'var(--m4)', 5: 'var(--m5)' };
export const modColor = (code) => MODULE_VAR[String(code).replace(/^eu:/, '').split('.')[0]] ?? (String(code).startsWith('eu:') ? MODULE_VAR[1] : 'var(--ink-3)');
