'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import AppLayout from '@/components/layout/AppLayout';
import {
  Container,
  Stack,
  Paper,
  Group,
  ThemeIcon,
  Title,
  Text,
  Button,
  TextInput,
  Divider,
  Alert
} from '@mantine/core';
import { User, Save, AlertCircle } from 'lucide-react';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

export default function ProfilePage() {
  const { userProfile } = useAuth();
  const { updateProfile, isLoading } = useUpdateProfile();
  const [isEditing, setIsEditing] = useState(false);
  
  // AuthGatekeeper에서 모든 인증 및 리디렉션을 처리하므로
  // 여기서는 단순히 userProfile 존재 여부만 확인
  if (!userProfile) {
    return null;
  }

  // 편집 상태 관리 - userProfile이 확인된 후 초기화
  const [editForm, setEditForm] = useState({
    name: userProfile.name,
    department: userProfile.department
  });

  // 편집 모드 토글
  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 취소 시 원래 값으로 복원
      setEditForm({
        name: userProfile.name,
        department: userProfile.department
      });
    } else {
      // 편집 시작 시 현재 값으로 초기화
      setEditForm({
        name: userProfile.name,
        department: userProfile.department
      });
    }
    setIsEditing(!isEditing);
  };

  // 저장 처리 - 실제 API 연동
  const handleSave = async () => {
    const result = await updateProfile({
      name: editForm.name,
      department: editForm.department
    });
    
    if (result.success) {
      setIsEditing(false);
      // AuthContext가 자동으로 업데이트되므로 페이지 새로고침 불필요
    }
    // 에러 처리는 useUpdateProfile 훅에서 처리됨
  };

  return (
    <AppLayout headerTitle="내 정보 관리">
      <Container my="xl" size="md">
        <Stack gap="xl">
          {/* 헤더 섹션 */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: 'white'
            }}
          >
            <Group align="center" gap="md">
              <ThemeIcon size="lg" radius="xl" color="white" variant="light" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <User size={24} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={2} c="white">
                  내 정보 관리
                </Title>
                <Text c="rgba(255,255,255,0.8)" size="sm">
                  개인 정보를 확인하고 수정할 수 있습니다
                </Text>
              </Stack>
            </Group>
          </Paper>

          {/* 알림 메시지 */}
          <Alert
            icon={<AlertCircle size={16} />}
            title="안내사항"
            color="blue"
            variant="light"
          >
            이메일 주소는 인증 시스템과 연동되어 있어 변경할 수 없습니다. 
            이름과 부서명만 수정 가능합니다.
          </Alert>

          {/* 프로필 정보 카드 */}
          <Paper p="xl" radius="lg" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <Title order={3}>기본 정보</Title>
                <Button
                  variant={isEditing ? "light" : "filled"}
                  color={isEditing ? "gray" : "blue"}
                  onClick={handleEditToggle}
                  disabled={isLoading}
                >
                  {isEditing ? '취소' : '수정'}
                </Button>
              </Group>

              <Divider />

              <Stack gap="md">
                {/* 이메일 (읽기 전용) */}
                <TextInput
                  label="이메일"
                  value={userProfile.email}
                  disabled
                  description="이메일은 변경할 수 없습니다"
                />

                {/* 이름 */}
                <TextInput
                  label="이름"
                  value={isEditing ? editForm.name : userProfile.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  required
                />

                {/* 부서 */}
                <TextInput
                  label="부서"
                  value={isEditing ? editForm.department : userProfile.department}
                  onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                  disabled={!isEditing}
                  required
                />

                {/* 권한 (읽기 전용) */}
                <TextInput
                  label="권한"
                  value={userProfile.role === 'admin' ? '관리자' : '사용자'}
                  disabled
                  description="권한은 관리자만 변경할 수 있습니다"
                />
              </Stack>

              {/* 저장 버튼 */}
              {isEditing && (
                <>
                  <Divider />
                  <Group justify="flex-end">
                    <Button
                      leftSection={<Save size={16} />}
                      onClick={handleSave}
                      loading={isLoading}
                      disabled={!editForm.name.trim() || !editForm.department.trim()}
                    >
                      저장
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          </Paper>

          {/* 푸시 알림 설정 */}
          <NotificationSettings />

          {/* 계정 정보 */}
          <Paper p="xl" radius="lg" withBorder>
            <Stack gap="md">
              <Title order={4}>계정 정보</Title>
              <Divider />
              
              <Group justify="space-between">
                <Text size="sm" c="dimmed">가입일</Text>
                <Text size="sm">{new Date(userProfile.createdAt).toLocaleDateString('ko-KR')}</Text>
              </Group>
              
              {userProfile.updatedAt && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">최종 수정일</Text>
                  <Text size="sm">{new Date(userProfile.updatedAt).toLocaleDateString('ko-KR')}</Text>
                </Group>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}