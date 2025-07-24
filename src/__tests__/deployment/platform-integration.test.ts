/**
 * Platform Integration Tests
 * 
 * Tests for platform-specific deployment configurations and integrations
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock fs for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Platform Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Vercel Platform Integration', () => {
    test('should detect Vercel platform correctly', () => {
      // Arrange
      const originalEnv = process.env.VERCEL;
      process.env.VERCEL = '1';
      mockFs.existsSync.mockReturnValue(true);

      // Act
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(platforms.some((p: any) => p.name === 'Vercel')).toBe(true);

      // Cleanup
      process.env.VERCEL = originalEnv;
    });

    test('should validate vercel.json configuration', async () => {
      // Arrange
      const mockVercelConfig = {
        env: {
          CUSTOM_VAR: 'value'
        },
        build: {
          env: {
            NODE_ENV: 'production'
          }
        }
      };

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'vercel.json';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'vercel.json') {
          return JSON.stringify(mockVercelConfig);
        }
        return '';
      });

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.vercel.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.some((r: any) => r.check === 'Vercel Configuration')).toBe(true);
    });

    test('should handle missing vercel.json gracefully', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.vercel.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Netlify Platform Integration', () => {
    test('should detect Netlify platform correctly', () => {
      // Arrange
      const originalEnv = process.env.NETLIFY;
      process.env.NETLIFY = '1';

      // Act
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(platforms.some((p: any) => p.name === 'Netlify')).toBe(true);

      // Cleanup
      process.env.NETLIFY = originalEnv;
    });

    test('should validate netlify.toml configuration', async () => {
      // Arrange
      const mockNetlifyConfig = `
[build.environment]
  NODE_ENV = "production"
  CUSTOM_VAR = "value"

[context.production.environment]
  NODE_ENV = "production"
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'netlify.toml';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'netlify.toml') {
          return mockNetlifyConfig;
        }
        return '';
      });

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.netlify.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.some((r: any) => r.check === 'Netlify Configuration')).toBe(true);
    });
  });

  describe('Docker Platform Integration', () => {
    test('should detect Docker platform correctly', () => {
      // Arrange
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'Dockerfile' || filePath === 'docker-compose.yml';
      });

      // Act
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(platforms.some((p: any) => p.name === 'Docker')).toBe(true);
    });

    test('should validate Dockerfile configuration', async () => {
      // Arrange
      const mockDockerfile = `
FROM node:18-alpine
ENV NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=example-key
ARG NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'Dockerfile';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'Dockerfile') {
          return mockDockerfile;
        }
        return '';
      });

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.docker.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.some((r: any) => r.check === 'Dockerfile')).toBe(true);
      expect(results.some((r: any) => r.check === 'Docker Environment Variables')).toBe(true);
    });

    test('should validate docker-compose.yml configuration', async () => {
      // Arrange
      const mockDockerCompose = `
version: '3.8'
services:
  app:
    build: .
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=example-key
      - NODE_ENV=production
    ports:
      - "3000:3000"
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'docker-compose.yml';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'docker-compose.yml') {
          return mockDockerCompose;
        }
        return '';
      });

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.docker.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.some((r: any) => r.check === 'Docker Compose')).toBe(true);
      expect(results.some((r: any) => r.check === 'Docker Compose Environment')).toBe(true);
    });
  });

  describe('Generic Platform Integration', () => {
    test('should always detect generic platform as fallback', () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      const originalVercel = process.env.VERCEL;
      const originalNetlify = process.env.NETLIFY;
      delete process.env.VERCEL;
      delete process.env.NETLIFY;

      // Act
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(platforms.some((p: any) => p.name === 'Generic/Self-hosted')).toBe(true);

      // Cleanup
      if (originalVercel) process.env.VERCEL = originalVercel;
      if (originalNetlify) process.env.NETLIFY = originalNetlify;
    });

    test('should validate Node.js version', async () => {
      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.generic.verify();

      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.some((r: any) => r.check === 'Node.js Version')).toBe(true);
    });

    test('should check for package.json and dependencies', async () => {
      // Arrange
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'package.json' || filePath === 'node_modules';
      });

      // Act
      const { PLATFORM_HANDLERS } = require('../../../scripts/deployment-config-verifier');
      const results = await PLATFORM_HANDLERS.generic.verify();

      // Assert
      expect(results).toBeDefined();
      expect(results.some((r: any) => r.check === 'Dependencies')).toBe(true);
    });
  });

  describe('Multi-Platform Detection', () => {
    test('should detect multiple platforms when present', () => {
      // Arrange
      process.env.VERCEL = '1';
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'vercel.json' || filePath === 'Dockerfile';
      });

      // Act
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      const platforms = verifier.detectPlatforms();

      // Assert
      expect(platforms.length).toBeGreaterThan(1);
      expect(platforms.some((p: any) => p.name === 'Vercel')).toBe(true);
      expect(platforms.some((p: any) => p.name === 'Docker')).toBe(true);

      // Cleanup
      delete process.env.VERCEL;
    });

    test('should handle platform verification failures gracefully', async () => {
      // Arrange
      const { DeploymentConfigVerifier } = require('../../../scripts/deployment-config-verifier');
      const verifier = new DeploymentConfigVerifier();
      
      // Mock a platform handler that throws an error
      const originalVerify = verifier.detectPlatforms()[0]?.verify;
      if (originalVerify) {
        verifier.detectPlatforms()[0].verify = jest.fn().mockRejectedValue(new Error('Test error'));
      }

      // Act & Assert
      await expect(verifier.verifyAllPlatforms()).resolves.not.toThrow();
    });
  });

  describe('Configuration File Validation', () => {
    test('should validate Next.js configuration files', () => {
      // Arrange
      const mockNextConfig = `
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  publicRuntimeConfig: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
}

module.exports = nextConfig
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'next.config.js';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'next.config.js') {
          return mockNextConfig;
        }
        return '';
      });

      // Act
      const { EnvironmentConfigChecker } = require('../../../scripts/environment-config-checker');
      const checker = new EnvironmentConfigChecker();
      checker.checkNextJsConfig();

      // Assert
      expect(checker.results.passed.length).toBeGreaterThan(0);
    });

    test('should validate package.json scripts', () => {
      // Arrange
      const mockPackageJson = {
        name: 'test-app',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          'validate:env': 'node scripts/validate-deployment-config.js'
        },
        dependencies: {
          next: '^13.0.0',
          react: '^18.0.0'
        }
      };

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'package.json';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'package.json') {
          return JSON.stringify(mockPackageJson);
        }
        return '';
      });

      // Act
      const { EnvironmentConfigChecker } = require('../../../scripts/environment-config-checker');
      const checker = new EnvironmentConfigChecker();
      checker.checkPackageScripts();

      // Assert
      expect(checker.results.passed.some((r: any) => r.check === 'Package Scripts')).toBe(true);
      expect(checker.results.passed.some((r: any) => r.check === 'Environment Validation Script')).toBe(true);
    });

    test('should validate TypeScript configuration', () => {
      // Arrange
      const mockTsConfig = {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'es6'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules']
      };

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === 'tsconfig.json';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === 'tsconfig.json') {
          return JSON.stringify(mockTsConfig);
        }
        return '';
      });

      // Act
      const { EnvironmentConfigChecker } = require('../../../scripts/environment-config-checker');
      const checker = new EnvironmentConfigChecker();
      checker.checkTypeScriptConfig();

      // Assert
      expect(checker.results.passed.some((r: any) => r.check === 'TypeScript Configuration')).toBe(true);
      expect(checker.results.passed.some((r: any) => r.check === 'TypeScript Strict Mode')).toBe(true);
    });
  });

  describe('Security Configuration Validation', () => {
    test('should validate .gitignore security settings', () => {
      // Arrange
      const mockGitignore = `
# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build output
.next/
out/

# Logs
*.log
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '.git' || filePath === '.gitignore';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === '.gitignore') {
          return mockGitignore;
        }
        return '';
      });

      // Act
      const { EnvironmentConfigChecker } = require('../../../scripts/environment-config-checker');
      const checker = new EnvironmentConfigChecker();
      checker.checkGitConfig();

      // Assert
      expect(checker.results.passed.some((r: any) => r.check === 'Environment Security')).toBe(true);
    });

    test('should detect missing security configurations', () => {
      // Arrange
      const mockGitignore = `
# Dependencies
node_modules/

# Build output
.next/
out/
`;

      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '.git' || filePath === '.gitignore';
      });
      
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath === '.gitignore') {
          return mockGitignore;
        }
        return '';
      });

      // Act
      const { EnvironmentConfigChecker } = require('../../../scripts/environment-config-checker');
      const checker = new EnvironmentConfigChecker();
      checker.checkGitConfig();

      // Assert
      expect(checker.results.failed.some((r: any) => r.check === 'Environment Security')).toBe(true);
    });
  });
});