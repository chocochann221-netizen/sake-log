import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes, createRequire } from 'node:module';
export const require = createRequire(import.meta.url);
export function edgeModule(file, globals = {}, names = []) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({ Request, Response, Headers, URL, URLSearchParams,
    Error, TypeError, TextEncoder, TextDecoder, Uint8Array, crypto, atob, btoa, console,
    Deno: { env: { get: () => 'test-only' }, serve: fn => { context.handler = fn; } },
    ...globals });
  vm.runInContext(stripTypeScriptTypes(source) + '\nObject.assign(globalThis, {' + names.join(',') + '});', context);
  return context;
}
