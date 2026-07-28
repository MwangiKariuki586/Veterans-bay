import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EngagementConversation } from "./engagement-conversation";

const requestApi = vi.fn();
const uploadMessageAttachment = vi.fn();

vi.mock("@/components/service-requests/request-api", () => ({
  requestApi: (...args: unknown[]) => requestApi(...args),
  uploadMessageAttachment: (...args: unknown[]) =>
    uploadMessageAttachment(...args),
}));

const conversation = {
  conversationId: "00000000-0000-4000-8000-000000000030",
  contextType: "SERVICE_REQUEST" as const,
  contextId: "00000000-0000-4000-8000-000000000010",
  unreadCount: 0,
  refreshedAt: "2026-07-27T12:00:00.000Z",
  items: [
    {
      kind: "ACTIVITY" as const,
      id: "activity-1",
      action: "SUBMITTED",
      summary: "Submitted. Status changed from draft to submitted.",
      actorDisplayName: "Client",
      occurredAt: "2026-07-27T10:00:00.000Z",
    },
    {
      kind: "MESSAGE" as const,
      id: "message-1",
      authorDisplayName: "Client",
      authorRole: "CLIENT" as const,
      isOwn: false,
      body: "The stop valve is beside the cabinet.",
      attachments: [],
      occurredAt: "2026-07-27T10:05:00.000Z",
    },
  ],
};

describe("EngagementConversation", () => {
  beforeEach(() => {
    requestApi.mockReset();
    requestApi.mockResolvedValue(conversation);
    uploadMessageAttachment.mockReset();
  });

  it("distinguishes structured activity from participant messages", async () => {
    render(
      <EngagementConversation
        requestId={conversation.contextId}
        audience="professional"
      />,
    );

    expect(await screen.findByText("Conversation & activity")).toBeInTheDocument();
    expect(
      screen.getByText("Submitted. Status changed from draft to submitted."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The stop valve is beside the cabinet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("log")).toHaveAttribute(
      "aria-label",
      "Conversation timeline",
    );
  });

  it("sends through the professional request context and preserves structured actions", async () => {
    render(
      <EngagementConversation
        requestId={conversation.contextId}
        audience="professional"
      />,
    );
    await screen.findByText("Conversation & activity");
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "I can attend tomorrow morning." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(requestApi).toHaveBeenCalledWith(
        `/api/v1/professional/enquiries/${conversation.contextId}/conversation/messages`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("I can attend tomorrow morning."),
        }),
      ),
    );
  });
});
