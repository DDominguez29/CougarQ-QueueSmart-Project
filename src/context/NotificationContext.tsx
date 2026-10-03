import { createContext, useContext, useState } from 'react';

type NotificationItem = {
  id: number;
  message: string;
};

type NotificationContextType = {
  notifications: NotificationItem[];
  addNotification: (message: string) => void;
  removeNotification: (id: number) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = (message: string) => {
    setNotifications((current) => [
      ...current,
      {
        id: Date.now(),
        message,
      },
    ]);
  };

  const removeNotification = (id: number) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id)
    );
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider'
    );
  }

  return context;
}