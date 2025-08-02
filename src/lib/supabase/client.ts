/**
 * @deprecated This file is deprecated and should not be used directly.
 * 
 * IMPORTANT: Do not import createClient from this file!
 * 
 * Instead, use the centralized SupabaseProvider:
 * 
 * ```typescript
 * import { useSupabaseClient } from '@/contexts/SupabaseProvider';
 * 
 * export function MyComponent() {
 *   const supabase = useSupabaseClient();
 *   
 *   if (!supabase) {
 *     return <div>Loading...</div>;
 *   }
 *   
 *   // Use supabase client here
 * }
 * ```
 * 
 * This ensures:
 * - Single shared client instance across the app
 * - Consistent authentication state management
 * - Proper session synchronization between tabs
 * - Automatic token refresh handling
 * 
 * Direct usage of createClient() creates fragmented client instances
 * that can lead to authentication state inconsistencies and session
 * management issues.
 */

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Typed Supabase client for better type safety
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * @deprecated Use useSupabaseClient() hook from SupabaseProvider instead
 * 
 * This function creates isolated client instances which can cause
 * authentication state fragmentation. Use the centralized provider instead.
 */
export function createClient(): TypedSupabaseClient {
  console.warn(
    '⚠️  DEPRECATED: Direct usage of createClient() is deprecated.\n' +
    'Use useSupabaseClient() from @/contexts/SupabaseProvider instead.\n' +
    'This ensures consistent authentication state across your app.'
  );
  
  return createPagesBrowserClient<Database>() as TypedSupabaseClient;
}



