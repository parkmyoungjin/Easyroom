/**
 * Type Conversion Utilities
 * Bridge between existing database types and enhanced branded types
 * Requirements: 1.1, 1.5
 */

import type {
  User,
  Reservation,
  PublicReservation,
  ReservationInsert,
  ReservationUpdate,
  EnhancedUser,
  EnhancedReservation,
  EnhancedPublicReservation,
  EnhancedReservationInsert,
  EnhancedReservationUpdate,
  DatabaseTypeConverters
} from '@/types/database';

import {
  createAuthId,
  createDatabaseUserId,
  databaseUserIdToString,
  authIdToString,
  type AuthId,
  type DatabaseUserId
} from '@/types/enhanced-types';

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert database User to EnhancedUser with branded types
 */
function userFromDatabase(user: User): EnhancedUser {
  return {
    id: createDatabaseUserId(user.id),
    auth_id: createAuthId(user.auth_id),
    employee_id: user.employee_id,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    created_at: new Date(user.created_at),
    updated_at: new Date(user.updated_at)
  };
}

/**
 * Convert EnhancedUser back to database User format
 */
function userToDatabase(enhancedUser: EnhancedUser): User {
  return {
    id: databaseUserIdToString(enhancedUser.id),
    auth_id: authIdToString(enhancedUser.auth_id),
    employee_id: enhancedUser.employee_id,
    name: enhancedUser.name,
    email: enhancedUser.email,
    department: enhancedUser.department,
    role: enhancedUser.role,
    created_at: enhancedUser.created_at.toISOString(),
    updated_at: enhancedUser.updated_at.toISOString()
  };
}

/**
 * Convert database Reservation to EnhancedReservation with branded types
 */
function reservationFromDatabase(reservation: Reservation): EnhancedReservation {
  return {
    id: reservation.id,
    room_id: reservation.room_id,
    user_id: createDatabaseUserId(reservation.user_id),
    title: reservation.title,
    purpose: reservation.purpose,
    start_time: new Date(reservation.start_time),
    end_time: new Date(reservation.end_time),
    status: reservation.status,
    cancellation_reason: reservation.cancellation_reason,
    created_at: new Date(reservation.created_at),
    updated_at: new Date(reservation.updated_at)
  };
}

/**
 * Convert EnhancedReservation back to database Reservation format
 */
function reservationToDatabase(enhancedReservation: EnhancedReservation): Reservation {
  return {
    id: enhancedReservation.id,
    room_id: enhancedReservation.room_id,
    user_id: databaseUserIdToString(enhancedReservation.user_id),
    title: enhancedReservation.title,
    purpose: enhancedReservation.purpose,
    start_time: enhancedReservation.start_time.toISOString(),
    end_time: enhancedReservation.end_time.toISOString(),
    status: enhancedReservation.status,
    cancellation_reason: enhancedReservation.cancellation_reason,
    created_at: enhancedReservation.created_at.toISOString(),
    updated_at: enhancedReservation.updated_at.toISOString()
  };
}

/**
 * Convert database PublicReservation to EnhancedPublicReservation with branded types
 */
function publicReservationFromDatabase(reservation: PublicReservation): EnhancedPublicReservation {
  return {
    id: reservation.id,
    room_id: reservation.room_id,
    user_id: createDatabaseUserId(reservation.user_id),
    title: reservation.title,
    purpose: reservation.purpose,
    department: reservation.department,
    user_name: reservation.user_name,
    start_time: new Date(reservation.start_time),
    end_time: new Date(reservation.end_time),
    is_mine: reservation.is_mine
  };
}

/**
 * Convert EnhancedPublicReservation back to database PublicReservation format
 */
function publicReservationToDatabase(enhancedReservation: EnhancedPublicReservation): PublicReservation {
  return {
    id: enhancedReservation.id,
    room_id: enhancedReservation.room_id,
    user_id: databaseUserIdToString(enhancedReservation.user_id),
    title: enhancedReservation.title,
    purpose: enhancedReservation.purpose,
    department: enhancedReservation.department,
    user_name: enhancedReservation.user_name,
    start_time: enhancedReservation.start_time.toISOString(),
    end_time: enhancedReservation.end_time.toISOString(),
    is_mine: enhancedReservation.is_mine
  };
}

/**
 * Convert EnhancedReservationInsert to database ReservationInsert format
 */
function reservationToInsert(reservation: EnhancedReservationInsert): ReservationInsert {
  return {
    room_id: reservation.room_id,
    user_id: databaseUserIdToString(reservation.user_id),
    title: reservation.title,
    purpose: reservation.purpose,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    status: reservation.status,
    cancellation_reason: reservation.cancellation_reason
  };
}

/**
 * Convert database ReservationInsert to EnhancedReservationInsert format
 */
function reservationFromInsert(reservation: ReservationInsert): EnhancedReservationInsert {
  return {
    room_id: reservation.room_id,
    user_id: createDatabaseUserId(reservation.user_id),
    title: reservation.title,
    purpose: reservation.purpose,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    status: reservation.status,
    cancellation_reason: reservation.cancellation_reason
  };
}

/**
 * Convert EnhancedReservationUpdate to database ReservationUpdate format
 */
function reservationToUpdate(reservation: EnhancedReservationUpdate): ReservationUpdate {
  return {
    room_id: reservation.room_id,
    user_id: reservation.user_id ? databaseUserIdToString(reservation.user_id) : undefined,
    title: reservation.title,
    purpose: reservation.purpose,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    status: reservation.status,
    cancellation_reason: reservation.cancellation_reason
  };
}

/**
 * Convert database ReservationUpdate to EnhancedReservationUpdate format
 */
function reservationFromUpdate(reservation: ReservationUpdate): EnhancedReservationUpdate {
  return {
    room_id: reservation.room_id,
    user_id: reservation.user_id ? createDatabaseUserId(reservation.user_id) : undefined,
    title: reservation.title,
    purpose: reservation.purpose,
    start_time: reservation.start_time,
    end_time: reservation.end_time,
    status: reservation.status,
    cancellation_reason: reservation.cancellation_reason
  };
}

// ============================================================================
// BATCH CONVERSION UTILITIES
// ============================================================================

/**
 * Convert array of database Users to EnhancedUsers
 */
function usersFromDatabase(users: User[]): EnhancedUser[] {
  return users.map(userFromDatabase);
}

/**
 * Convert array of EnhancedUsers to database Users
 */
function usersToDatabase(enhancedUsers: EnhancedUser[]): User[] {
  return enhancedUsers.map(userToDatabase);
}

/**
 * Convert array of database Reservations to EnhancedReservations
 */
function reservationsFromDatabase(reservations: Reservation[]): EnhancedReservation[] {
  return reservations.map(reservationFromDatabase);
}

/**
 * Convert array of EnhancedReservations to database Reservations
 */
function reservationsToDatabase(enhancedReservations: EnhancedReservation[]): Reservation[] {
  return enhancedReservations.map(reservationToDatabase);
}

/**
 * Convert array of database PublicReservations to EnhancedPublicReservations
 */
function publicReservationsFromDatabase(reservations: PublicReservation[]): EnhancedPublicReservation[] {
  return reservations.map(publicReservationFromDatabase);
}

/**
 * Convert array of EnhancedPublicReservations to database PublicReservations
 */
export function publicReservationsToDatabase(enhancedReservations: EnhancedPublicReservation[]): PublicReservation[] {
  return enhancedReservations.map(publicReservationToDatabase);
}

// ============================================================================
// SAFE CONVERSION UTILITIES WITH ERROR HANDLING
// ============================================================================

/**
 * Safely convert database User to EnhancedUser with error handling
 */
export function safeUserFromDatabase(user: User): { success: true; data: EnhancedUser } | { success: false; error: string } {
  try {
    const enhancedUser = userFromDatabase(user);
    return { success: true, data: enhancedUser };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to convert user: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Safely convert database Reservation to EnhancedReservation with error handling
 */
export function safeReservationFromDatabase(reservation: Reservation): { success: true; data: EnhancedReservation } | { success: false; error: string } {
  try {
    const enhancedReservation = reservationFromDatabase(reservation);
    return { success: true, data: enhancedReservation };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to convert reservation: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Safely convert database PublicReservation to EnhancedPublicReservation with error handling
 */
export function safePublicReservationFromDatabase(reservation: PublicReservation): { success: true; data: EnhancedPublicReservation } | { success: false; error: string } {
  try {
    const enhancedReservation = publicReservationFromDatabase(reservation);
    return { success: true, data: enhancedReservation };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to convert public reservation: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// ============================================================================
// TYPE CONVERTER IMPLEMENTATION
// ============================================================================

/**
 * Implementation of DatabaseTypeConverters interface
 */
export const databaseTypeConverters: DatabaseTypeConverters = {
  reservationToInsert,
  reservationToUpdate,
  userFromDatabase,
  reservationFromDatabase,
  publicReservationFromDatabase
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that a user ID string can be safely converted to DatabaseUserId
 */
export function validateDatabaseUserId(userId: string): { isValid: true; userId: DatabaseUserId } | { isValid: false; error: string } {
  try {
    const databaseUserId = createDatabaseUserId(userId);
    return { isValid: true, userId: databaseUserId };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid DatabaseUserId format' 
    };
  }
}

/**
 * Validate that an auth ID string can be safely converted to AuthId
 */
export function validateAuthId(authId: string): { isValid: true; authId: AuthId } | { isValid: false; error: string } {
  try {
    const validAuthId = createAuthId(authId);
    return { isValid: true, authId: validAuthId };
  } catch (error) {
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Invalid AuthId format' 
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Individual conversion functions
  userFromDatabase,
  userToDatabase,
  reservationFromDatabase,
  reservationToDatabase,
  publicReservationFromDatabase,
  publicReservationToDatabase,
  reservationToInsert,
  reservationFromInsert,
  reservationToUpdate,
  reservationFromUpdate,
  
  // Batch conversion functions
  usersFromDatabase,
  usersToDatabase,
  reservationsFromDatabase,
  reservationsToDatabase,
  publicReservationsFromDatabase,
};