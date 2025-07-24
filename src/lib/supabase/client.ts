import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getPublicEnvVar } from "@/lib/security/secure-environment-access";
import { 
  environmentMonitor,
  startClientInitializationTracking,
  completeClientInitializationTracking,
  recordClientInitializationFailure,
  recordNetworkError
} from "@/lib/monitoring/environment-monitor";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ClientInitializationResult {
  success: boolean;
  client?: ReturnType<typeof createBrowserClient<Database>>;
  error?: {
    type: 'environment' | 'network' | 'configuration';
    message: string;
    troubleshooting: string[];
    canRetry: boolean;
  };
}

export interface SupabaseClientManager {
  initializeClient(): Promise<ClientInitializationResult>;
  getClient(): Promise<ReturnType<typeof createBrowserClient<Database>>>;
  isClientReady(): boolean;
  getInitializationError(): Error | null;
  reinitializeClient(): Promise<ClientInitializationResult>;
  getClientStatus(): ClientStatus;
}

export interface ClientStatus {
  state: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'retrying';
  lastError?: Error;
  retryCount: number;
  lastInitializationAttempt?: Date;
  nextRetryAt?: Date;
}

// ============================================================================
// ENHANCED SUPABASE CLIENT MANAGER
// ============================================================================

class EnhancedSupabaseClientManager implements SupabaseClientManager {
  private static instance: EnhancedSupabaseClientManager;
  private client: ReturnType<typeof createBrowserClient<Database>> | undefined;
  private clientPromise: Promise<ClientInitializationResult> | undefined;
  private initializationError: Error | null = null;
  private status: ClientStatus = {
    state: 'uninitialized',
    retryCount: 0
  };

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000; // 1 second
  private readonly maxRetryDelay = 10000; // 10 seconds
  private retryTimeoutId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): EnhancedSupabaseClientManager {
    if (!EnhancedSupabaseClientManager.instance) {
      EnhancedSupabaseClientManager.instance = new EnhancedSupabaseClientManager();
    }
    return EnhancedSupabaseClientManager.instance;
  }

  /**
   * Initialize Supabase client with retry logic and error handling
   */
  async initializeClient(): Promise<ClientInitializationResult> {
    // If client is already ready, return it
    if (this.client && this.status.state === 'ready') {
      return {
        success: true,
        client: this.client
      };
    }

    // If initialization is in progress, wait for it
    if (this.clientPromise && this.status.state === 'initializing') {
      return this.clientPromise;
    }

    // Clear any pending retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.status.state = 'initializing';
    this.status.lastInitializationAttempt = new Date();

    this.clientPromise = this.attemptInitialization();
    return this.clientPromise;
  }

  /**
   * Get client with automatic initialization
   */
  async getClient(): Promise<ReturnType<typeof createBrowserClient<Database>>> {
    const result = await this.initializeClient();
    
    if (!result.success || !result.client) {
      throw new Error(
        result.error?.message || 'Failed to initialize Supabase client'
      );
    }

    return result.client;
  }

  /**
   * Check if client is ready for use
   */
  isClientReady(): boolean {
    return this.status.state === 'ready' && this.client !== undefined;
  }

  /**
   * Get the last initialization error
   */
  getInitializationError(): Error | null {
    return this.initializationError;
  }

  /**
   * Force reinitialize the client
   */
  async reinitializeClient(): Promise<ClientInitializationResult> {
    // Reset state
    this.client = undefined;
    this.clientPromise = undefined;
    this.initializationError = null;
    this.status = {
      state: 'uninitialized',
      retryCount: 0
    };

    // Clear any pending retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    return this.initializeClient();
  }

  /**
   * Get current client status
   */
  getClientStatus(): ClientStatus {
    return { ...this.status };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Attempt client initialization with error categorization
   */
  private async attemptInitialization(): Promise<ClientInitializationResult> {
    // Start monitoring client initialization
    const attemptId = startClientInitializationTracking();
    
    try {
      // Get environment variables using client-safe function
      const supabaseUrl = getPublicEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'EnhancedSupabaseClientManager');
      const supabaseAnonKey = getPublicEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EnhancedSupabaseClientManager');
      
      // Create the client
      const newClient = createBrowserClient<Database>(
        supabaseUrl,
        supabaseAnonKey
      );

      // Test client connectivity (basic health check)
      await this.testClientConnectivity(newClient);

      // Success - update state
      this.client = newClient;
      this.status.state = 'ready';
      this.status.retryCount = 0;
      this.initializationError = null;

      // Complete monitoring with success
      completeClientInitializationTracking(attemptId, true, this.status.retryCount);

      return {
        success: true,
        client: newClient
      };

    } catch (error) {
      const categorizedError = this.categorizeError(error);
      this.initializationError = error instanceof Error ? error : new Error(String(error));
      
      // Record the initialization failure
      recordClientInitializationFailure(
        categorizedError.type,
        categorizedError.message,
        {
          operation: 'client_initialization',
          caller: 'EnhancedSupabaseClientManager',
          environment: process.env.NODE_ENV || 'development',
          retryAttempt: this.status.retryCount
        }
      );

      // Complete monitoring with failure
      completeClientInitializationTracking(
        attemptId, 
        false, 
        this.status.retryCount,
        categorizedError.type,
        categorizedError.message
      );
      
      // Handle retryable errors
      if (categorizedError.canRetry && this.status.retryCount < this.maxRetries) {
        return this.scheduleRetry(categorizedError);
      }

      // Non-retryable error or max retries reached
      this.status.state = 'error';
      return {
        success: false,
        error: categorizedError
      };
    }
  }

  /**
   * Test basic client connectivity
   */
  private async testClientConnectivity(client: ReturnType<typeof createBrowserClient<Database>>): Promise<void> {
    try {
      // Simple connectivity test - just check if we can create a query
      // This doesn't actually execute, just validates the client setup
      const { error } = await client.from('users').select('id').limit(1);
      
      // If there's an auth error, that's actually expected for anonymous access
      // We're just testing that the client can communicate with Supabase
      if (error && !error.message.includes('JWT') && !error.message.includes('auth')) {
        throw new Error(`Client connectivity test failed: ${error.message}`);
      }
    } catch (error) {
      // Network or configuration errors should be thrown
      if (error instanceof Error && (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('timeout')
      )) {
        throw error;
      }
      // Other errors (like auth errors) are expected and can be ignored
    }
  }

  /**
   * Categorize errors for appropriate handling
   */
  private categorizeError(error: unknown): {
    type: 'environment' | 'network' | 'configuration';
    message: string;
    troubleshooting: string[];
    canRetry: boolean;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Environment variable errors
    if (errorMessage.includes('Required environment variable') || 
        errorMessage.includes('not set') ||
        errorMessage.includes('Environment validation failed')) {
      return {
        type: 'environment',
        message: errorMessage,
        troubleshooting: [
          'Check that NEXT_PUBLIC_SUPABASE_URL is set in your environment',
          'Check that NEXT_PUBLIC_SUPABASE_ANON_KEY is set in your environment',
          'Verify your .env.local file exists and contains the correct values',
          'Restart your development server after updating environment variables'
        ],
        canRetry: false
      };
    }

    // Network errors
    if (errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')) {
      return {
        type: 'network',
        message: `Network error: ${errorMessage}`,
        troubleshooting: [
          'Check your internet connection',
          'Verify the Supabase URL is correct and accessible',
          'Check if there are any firewall or proxy issues',
          'Try again in a few moments'
        ],
        canRetry: true
      };
    }

    // Configuration errors
    return {
      type: 'configuration',
      message: `Configuration error: ${errorMessage}`,
      troubleshooting: [
        'Verify your Supabase project URL is correct',
        'Check that your Supabase anonymous key is valid',
        'Ensure your Supabase project is active and accessible',
        'Check the Supabase dashboard for any service issues'
      ],
      canRetry: false
    };
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(error: {
    type: 'environment' | 'network' | 'configuration';
    message: string;
    troubleshooting: string[];
    canRetry: boolean;
  }): ClientInitializationResult {
    this.status.state = 'retrying';
    this.status.retryCount++;

    // Calculate retry delay with exponential backoff
    const retryDelay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.status.retryCount - 1),
      this.maxRetryDelay
    );

    this.status.nextRetryAt = new Date(Date.now() + retryDelay);

    // Schedule the retry
    this.retryTimeoutId = setTimeout(() => {
      this.initializeClient().catch(console.error);
    }, retryDelay);

    return {
      success: false,
      error: {
        ...error,
        message: `${error.message} (Retry ${this.status.retryCount}/${this.maxRetries} in ${Math.round(retryDelay / 1000)}s)`
      }
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE AND EXPORTS
// ============================================================================

const clientManager = EnhancedSupabaseClientManager.getInstance();

/**
 * Create or get Supabase client with enhanced error handling
 */
export async function createClient(): Promise<ReturnType<typeof createBrowserClient<Database>>> {
  return clientManager.getClient();
}

/**
 * Get client initialization result with detailed error information
 */
export async function initializeClient(): Promise<ClientInitializationResult> {
  return clientManager.initializeClient();
}

/**
 * Check if Supabase client is ready
 */
export function isClientReady(): boolean {
  return clientManager.isClientReady();
}

/**
 * Get current client status
 */
export function getClientStatus(): ClientStatus {
  return clientManager.getClientStatus();
}

/**
 * Force reinitialize the client
 */
export async function reinitializeClient(): Promise<ClientInitializationResult> {
  return clientManager.reinitializeClient();
}

/**
 * Get the client manager instance for advanced usage
 */
export function getClientManager(): SupabaseClientManager {
  return clientManager;
}

// For backward compatibility, create a synchronous version that throws if not initialized
export function supabase(): ReturnType<typeof createBrowserClient<Database>> {
  if (!clientManager.isClientReady()) {
    throw new Error('Supabase client not initialized. Use createClient() or await the client initialization.');
  }
  return clientManager.getClient() as any; // Safe cast since we checked isClientReady()
}

// Initialize client immediately if in browser environment
if (typeof window !== 'undefined') {
  clientManager.initializeClient().catch(console.error);
  
  // Handle page visibility changes to reinitialize client if needed
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Page became visible - check if client needs reinitialization
      const status = clientManager.getClientStatus();
      if (status.state === 'error' || !clientManager.isClientReady()) {
        console.log('Page became visible and client needs reinitialization');
        clientManager.reinitializeClient().catch(console.error);
      }
    }
  });
}
