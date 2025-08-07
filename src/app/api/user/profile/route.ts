import { createClient } from '@/lib/supabase/server';
import { userService } from '@/lib/services/users';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// 사용자 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 사용자 프로필 조회
    const { data, error } = await supabase.rpc('get_current_user_info');
    
    if (error) {
      console.error('Get user profile error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile: data[0] });

  } catch (error) {
    console.error('Get profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 사용자 프로필 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 요청 데이터 검증
    const body = await request.json();
    const { name, department } = body;

    if (!name || !department) {
      return NextResponse.json(
        { error: 'Name and department are required' },
        { status: 400 }
      );
    }

    // 이름과 부서명 유효성 검사
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid name is required' },
        { status: 400 }
      );
    }

    if (typeof department !== 'string' || department.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid department is required' },
        { status: 400 }
      );
    }

    // 현재 사용자의 데이터베이스 ID 조회
    const { data: currentUserData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !currentUserData) {
      console.error('User lookup error:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 사용자 정보 업데이트 (본인만 수정 가능)
    const updateData = {
      name: name.trim(),
      department: department.trim(),
      updated_at: new Date().toISOString()
    };

    const updatedUser = await userService.updateUser(
      supabase, 
      currentUserData.id, 
      updateData
    );

    return NextResponse.json({ 
      success: true,
      profile: updatedUser 
    });

  } catch (error) {
    console.error('Update profile API error:', error);
    
    // Supabase 에러 처리
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found or access denied' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}