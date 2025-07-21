// 서버 환경에서 브라우저 전역 객체 polyfill
if (typeof global !== 'undefined' && typeof self === 'undefined') {
  global.self = global;
}

if (typeof globalThis !== 'undefined' && typeof self === 'undefined') {
  globalThis.self = globalThis;
}