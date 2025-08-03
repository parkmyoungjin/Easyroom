/**
 * Demo script showing the enhanced email validation service capabilities
 * This file demonstrates the improved error handling and user-friendly messages
 */

import { checkEmailExists, validateEmailFormat } from './email-validation-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Create a mock SupabaseClient for demo purposes
const createDemoSupabaseClient = (): SupabaseClient<Database> => {
  const mockClient = {
    rpc: async (functionName: string, params: any) => {
      // Mock implementation for demo
      if (functionName === 'check_email_exists') {
        // Simulate different responses based on email
        const email = params.p_email;
        if (email === 'existing@example.com') {
          return { data: true, error: null };
        } else if (email.includes('error')) {
          return { data: null, error: { message: 'Demo database error', code: 'DEMO_ERROR' } };
        }
        return { data: false, error: null };
      }
      return { data: null, error: null };
    },
    // Add minimal required properties to satisfy TypeScript
    auth: {} as any,
    storage: {} as any,
    realtime: {} as any,
    rest: {} as any,
    functions: {} as any,
    from: jest.fn() as any,
    channel: jest.fn() as any,
    getChannels: jest.fn() as any,
    removeChannel: jest.fn() as any,
    removeAllChannels: jest.fn() as any,
  };
  
  return mockClient as unknown as SupabaseClient<Database>;
};

// Demo function to showcase email validation features
export async function demonstrateEmailValidation() {
  console.log('=== Enhanced Email Validation Service Demo ===\n');
  
  // Create demo Supabase client
  const demoSupabase = createDemoSupabaseClient();

  // 1. Basic email format validation
  console.log('1. Email Format Validation:');
  const testEmails = [
    'valid@example.com',
    'user.name@domain.co.kr',
    'test+tag@example.org',
    'invalid-email',
    'test@',
    '@example.com',
    'test..email@example.com',
    'test@example', // Missing TLD
    'a'.repeat(250) + '@example.com' // Too long
  ];

  testEmails.forEach(email => {
    const isValid = validateEmailFormat(email);
    console.log(`  ${email.padEnd(30)} -> ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  console.log('\n2. Enhanced Error Handling:');
  
  // 2. Demonstrate validation errors
  try {
    const result = await checkEmailExists(demoSupabase, 'invalid-email-format');
    console.log('  Result:', result);
  } catch (error) {
    console.log('  This should not happen - errors are returned in result object');
  }

  // 3. Show validation error details
  const validationResult = await checkEmailExists(demoSupabase, '');
  if (validationResult.error) {
    console.log('  Empty email validation error:');
    console.log(`    Type: ${validationResult.error.type}`);
    console.log(`    Message: ${validationResult.error.message}`);
    console.log(`    User Message: ${validationResult.error.userMessage}`);
    console.log(`    Can Retry: ${validationResult.error.canRetry}`);
  }

  // 4. Show long email validation
  const longEmailResult = await checkEmailExists(demoSupabase, 'a'.repeat(300) + '@example.com');
  if (longEmailResult.error) {
    console.log('\n  Long email validation error:');
    console.log(`    Type: ${longEmailResult.error.type}`);
    console.log(`    User Message: ${longEmailResult.error.userMessage}`);
  }

  // 5. Demonstrate client validation
  console.log('\n  Client validation error:');
  const clientErrorResult = await checkEmailExists(null as any, 'test@example.com');
  if (clientErrorResult.error) {
    console.log(`    Type: ${clientErrorResult.error.type}`);
    console.log(`    Message: ${clientErrorResult.error.message}`);
    console.log(`    User Message: ${clientErrorResult.error.userMessage}`);
  }

  // 6. Show successful database check
  console.log('\n  Successful database check:');
  const successResult = await checkEmailExists(demoSupabase, 'existing@example.com');
  console.log(`    Email exists: ${successResult.exists}`);
  console.log(`    Error: ${successResult.error ? 'Yes' : 'None'}`);

  // 7. Show database error handling
  console.log('\n  Database error handling:');
  const dbErrorResult = await checkEmailExists(demoSupabase, 'error@example.com');
  if (dbErrorResult.error) {
    console.log(`    Type: ${dbErrorResult.error.type}`);
    console.log(`    User Message: ${dbErrorResult.error.userMessage}`);
  }

  console.log('\n3. Key Features:');
  console.log('  ✅ Comprehensive email format validation');
  console.log('  ✅ Enhanced error categorization (client_not_ready, network_error, database_error, validation_error)');
  console.log('  ✅ User-friendly Korean error messages');
  console.log('  ✅ Retry capability for transient failures');
  console.log('  ✅ Detailed technical information for debugging');
  console.log('  ✅ Singleton service pattern for consistent behavior');
  console.log('  ✅ Dependency injection pattern for better testability');
  console.log('  ✅ Environment-agnostic design (works in server and client)');

  console.log('\n=== Demo Complete ===');
}

// Export for potential use in other parts of the application
export const emailValidationFeatures = {
  formatValidation: 'Comprehensive regex-based email format validation with edge case handling',
  errorCategorization: 'Categorizes errors into client_not_ready, network_error, database_error, and validation_error',
  userFriendlyMessages: 'Provides Korean user-friendly error messages for better UX',
  retryLogic: 'Implements exponential backoff retry for transient network and database errors',
  technicalDetails: 'Includes detailed technical information for debugging and monitoring',
  singletonPattern: 'Uses singleton pattern for consistent service behavior across the application',
  dependencyInjection: 'Uses dependency injection pattern for better testability and environment independence',
  environmentAgnostic: 'Works consistently in both server-side and client-side environments'
};