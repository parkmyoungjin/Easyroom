import type { User, UserInsert, UserUpdate, Database } from '@/types/database';
import { LoginFormData } from '@/lib/validations/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';

type TypedSupabaseClient = SupabaseClient<Database>;

export class UserService {
  private static instance: UserService;

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async login(supabase: TypedSupabaseClient, data: LoginFormData): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .select()
      .eq('email', data.email)
      .single();

    if (error) {
      throw error;
    }

    return user;
  }

  async createUser(supabase: TypedSupabaseClient, data: UserInsert): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return user;
  }

  async updateUser(supabase: TypedSupabaseClient, id: string, data: UserUpdate): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return user;
  }

  async getUsers(supabase: TypedSupabaseClient): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async getUser(supabase: TypedSupabaseClient, id: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async getUserByEmployeeId(supabase: TypedSupabaseClient, employeeId: string): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async isAdmin(supabase: TypedSupabaseClient, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data.role === 'admin';
  }
}

export const userService = UserService.getInstance(); 