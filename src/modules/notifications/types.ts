export interface NotificationItem {
  id: string;
  sourceEventType: string;
  title: string;
  body: string;
  actionTarget: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationCount {
  unreadCount: number;
}
