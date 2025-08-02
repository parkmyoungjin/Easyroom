// jest.setup.js - 작전명: 환경 변수 제어

// Node.js의 'util' 모듈에서 TextEncoder와 TextDecoder를 가져옵니다.
import { TextEncoder, TextDecoder } from 'util';

// Jest의 전역(global) 객체에 TextEncoder와 TextDecoder를 할당하여
// 테스트 환경에서 브라우저 API처럼 사용할 수 있도록 만듭니다.
Object.assign(global, { TextEncoder, TextDecoder });

// 테스트 환경에서는 기본적으로 모든 로그를 비활성화한다.
// 'DEBUG' 환경 변수가 설정된 경우에만 로그를 출력하도록 한다.
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// 기존에 있던 jest-dom 설정을 유지합니다.
import '@testing-library/jest-dom';