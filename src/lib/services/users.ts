import { createClient } from '@/lib/supabase/client';
import type { User, UserInsert, UserUpdate } from '@/types/database';
import { LoginFormData } from '@/lib/validations/schemas';

export class UserService {
  private static instance: UserService;

  private constructor() {}

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async login(data: LoginFormData): Promise<User> {
    const supabase = await createClient();
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

  async createUser(data: UserInsert): Promise<User> {
    const supabase = await createClient();
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

  async updateUser(id: string, data: UserUpdate): Promise<User> {
    const supabase = await createClient();
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

  async getUsers(): Promise<User[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async getUser(id: string): Promise<User> {
    const supabase = await createClient();
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

  async getUserByEmployeeId(employeeId: string): Promise<User> {
    const supabase = await createClient();
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

  async isAdmin(userId: string): Promise<boolean> {
    const supabase = await createClient();
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