import "server-only";

import { 
  createRouteHandlerClient, 
  createServerActionClient 
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Typed Supabase client for better type safety
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Create Supabase client for API route handlers
 * 
 * This function creates a Supabase client optimized for API route handlers
 * in Next.js 13+ App Router applications. It uses createRouteHandlerClient
 * from @supabase/auth-helpers-nextjs to ensure proper cookie handling and
 * session management in API routes.
 * 
 * @returns A fully typed Supabase client instance
 * 
 * @example
 * ```typescript
 * // In an API route handler
 * import { createRouteClient } from '@/lib/supabase/actions';
 * 
 * export async function GET(request: NextRequest) {
 *   const supabase = createRouteClient();
 *   
 *   // Check authentication
 *   const { data: { session } } = await supabase.auth.getSession();
 *   if (!session) {
 *     return new NextResponse('Unauthorized', { status: 401 });
 *   }
 *   
 *   // Fetch user-specific data with RLS
 *   const { data } = await supabase
 *     .from('reservations')
 *     .select('*')
 *     .eq('user_id', session.user.id);
 *   
 *   return NextResponse.json(data);
 * }
 * ```
 */
export function createRouteClient(): TypedSupabaseClient {
  return createRouteHandlerClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * Create Supabase client for server actions
 * 
 * This function creates a Supabase client optimized for server actions
 * in Next.js 13+ App Router applications. It uses createServerActionClient
 * from @supabase/auth-helpers-nextjs to ensure proper cookie handling and
 * session management in server actions.
 * 
 * @returns A fully typed Supabase client instance
 */
export async function createActionClient(): Promise<TypedSupabaseClient> {
  return createServerActionClient<Database>({ cookies }) as TypedSupabaseClient;
}

/**
 * Create Supabase admin client for privileged API operations
 * 
 * This function creates a Supabase client with service role privileges
 * for use in API routes that require administrative access. It bypasses
 * Row Level Security (RLS) policies and should only be used for trusted
 * operations.
 * 
 * @param context - Optional context information for logging and security
 * @returns A Supabase client with service role access
 * 
 * @example
 * ```typescript
 * // In an admin API route
 * import { createAdminRouteClient } from '@/lib/supabase/actions';
 * 
 * export async function GET(request: NextRequest) {
 *   // First check if user has admin permissions
 *   const supabase = createRouteClient();
 *   const { data: { session } } = await supabase.auth.getSession();
 *   
 *   if (!session || !isAdmin(session.user)) {
 *     return new NextResponse('Forbidden', { status: 403 });
 *   }
 *   
 *   // Use admin client for privileged operations
 *   const supabaseAdmin = createAdminRouteClient({
 *     endpoint: '/api/admin/users',
 *     userId: session.user.id
 *   });
 *   
 *   // Admin operations bypass RLS
 *   const { data: allUsers } = await supabaseAdmin
 *     .from('users')
 *     .select('*'); // Can access all users regardless of RLS
 *   
 *   return NextResponse.json(allUsers);
 * }
 * ```
 * 
 * @security_warnings
 * ⚠️ CRITICAL SECURITY CONSIDERATIONS:
 * - This client bypasses ALL Row Level Security (RLS) policies
 * - Can read, write, and delete ANY data in the database
 * - Should only be used in trusted server-side contexts
 * - Always validate user permissions before admin operations
 * - Log all admin operations for security auditing
 */
export function createAdminRouteClient(context?: { endpoint?: string; userId?: string }): TypedSupabaseClient {
  const { createClient } = require("@supabase/supabase-js");
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  return client as TypedSupabaseClient;
}