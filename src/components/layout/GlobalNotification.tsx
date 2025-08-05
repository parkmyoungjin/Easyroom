'use client';

import { Notification } from '@mantine/core';
import { IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';
import { useNotificationStore } from '@/store/notificationStore';

export function GlobalNotification() {
  const { isOpen, title, message, type, hideNotification } = useNotificationStore();

  if (!isOpen) {
    return null;
  }

  const icons = {
    success: <IconCheck />,
    error: <IconX />,
    info: <IconInfoCircle />,
  };

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2000 }}>
      <Notification
        icon={icons[type]}
        color={type === 'success' ? 'teal' : type === 'error' ? 'red' : 'blue'}
        title={title}
        onClose={hideNotification}
        withCloseButton
      >
        {message}
      </Notification>
    </div>
  );
}