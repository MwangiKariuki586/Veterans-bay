import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import type { NotificationsRepository } from "./repository";
import type {
  NotificationCount,
  NotificationListResult,
} from "./types";

export class NotificationsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly repository: NotificationsRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  async list(input: {
    authUserId: string;
    filter: "all" | "unread";
    page: number;
    pageSize: number;
  }): Promise<NotificationListResult> {
    const account = await this.activeAccount(input.authUserId);
    return this.repository.list({
      recipientAccountId: account.id,
      unreadOnly: input.filter === "unread",
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async unreadCount(authUserId: string): Promise<NotificationCount> {
    const account = await this.activeAccount(authUserId);
    return {
      unreadCount: await this.repository.unreadCount(account.id),
    };
  }

  async markRead(input: {
    authUserId: string;
    notificationId: string;
    correlationId?: string;
  }): Promise<NotificationCount> {
    const account = await this.activeAccount(input.authUserId);
    if (
      !(await this.repository.markRead({
        recipientAccountId: account.id,
        notificationId: input.notificationId,
        correlationId: input.correlationId,
      }))
    ) {
      throw notificationNotFound();
    }
    return {
      unreadCount: await this.repository.unreadCount(account.id),
    };
  }

  async markAllRead(input: {
    authUserId: string;
    correlationId?: string;
  }): Promise<NotificationCount & { markedRead: number }> {
    const account = await this.activeAccount(input.authUserId);
    const markedRead = await this.repository.markAllRead({
      recipientAccountId: account.id,
      correlationId: input.correlationId,
    });
    return {
      markedRead,
      unreadCount: await this.repository.unreadCount(account.id),
    };
  }

  private async activeAccount(authUserId: string) {
    const { profile } =
      await this.identity.requireActiveAccount(authUserId);
    return profile;
  }
}

function notificationNotFound() {
  return new AppError({
    code: "NOTIFICATION_NOT_FOUND",
    message: "The requested notification was not found.",
    status: 404,
  });
}
