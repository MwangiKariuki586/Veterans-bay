export type EngagementContextType =
  | "SERVICE_REQUEST"
  | "QUOTATION"
  | "BOOKING"
  | "JOB"
  | "WARRANTY_CLAIM"
  | "DISPUTE";

export interface ConversationAttachment {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConversationMessageItem {
  kind: "MESSAGE";
  id: string;
  authorDisplayName: string;
  authorRole: "CLIENT" | "PROFESSIONAL";
  isOwn: boolean;
  body: string;
  attachments: ConversationAttachment[];
  occurredAt: string;
}

export interface ConversationActivityItem {
  kind: "ACTIVITY";
  id: string;
  action: string;
  summary: string;
  actorDisplayName: string | null;
  occurredAt: string;
}

export type ConversationTimelineItem =
  | ConversationMessageItem
  | ConversationActivityItem;

export interface EngagementConversation {
  conversationId: string;
  contextType: EngagementContextType;
  contextId: string;
  unreadCount: number;
  items: ConversationTimelineItem[];
  refreshedAt: string;
}
