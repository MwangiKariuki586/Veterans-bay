"use client";

import {
  Activity,
  FileText,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { requestApi, uploadMessageAttachment } from "@/components/service-requests/request-api";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { EngagementConversation as Conversation } from "@/modules/conversations/types";

export function EngagementConversation({
  requestId,
  audience,
  basePath: providedBasePath,
  contextLabel = "request",
  allowAttachments = true,
}: {
  requestId?: string;
  audience: "client" | "professional";
  basePath?: string;
  contextLabel?: string;
  allowAttachments?: boolean;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{
    assetId: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"send" | "upload" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const basePath =
    providedBasePath ??
    (audience === "client"
      ? `/api/v1/client/requests/${encodeURIComponent(requestId ?? "")}/conversation`
      : `/api/v1/professional/enquiries/${encodeURIComponent(requestId ?? "")}/conversation`);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!quiet) setBusy("refresh");
      try {
        const next = await requestApi<Conversation>(basePath);
        setConversation(next);
        setError(null);
        if (next.unreadCount > 0) {
          setConversation(
            await requestApi<Conversation>(`${basePath}/read`, {
              method: "POST",
            }),
          );
        }
      } catch (cause) {
        if (!quiet) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The conversation could not be refreshed.",
          );
        }
      } finally {
        setLoading(false);
        if (!quiet) setBusy(null);
      }
    },
    [basePath],
  );

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(true), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 10_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function addAttachment(file: File) {
    setBusy("upload");
    setError(null);
    try {
      setAttachment({
        assetId: await uploadMessageAttachment(file),
        name: file.name,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The attachment could not be uploaded.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (!body.trim()) return;
    setBusy("send");
    setError(null);
    try {
      const next = await requestApi<Conversation>(`${basePath}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          body: body.trim(),
          ...(allowAttachments
            ? { assetIds: attachment ? [attachment.assetId] : [] }
            : {}),
        }),
      });
      setConversation(next);
      setBody("");
      setAttachment(null);
      idempotencyKey.current = crypto.randomUUID();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The message could not be sent.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function openAttachment(assetId: string) {
    setError(null);
    try {
      const delivery = await requestApi<{ url: string }>(
        `${basePath}/attachments/${encodeURIComponent(assetId)}/delivery`,
      );
      window.open(delivery.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The attachment could not be opened.",
      );
    }
  }

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="Loading conversation"
        description="Retrieving messages and engagement activity."
      />
    );
  }

  return (
    <Surface className="overflow-hidden p-0 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-[#5f8d11]" />
            <h2 className="font-bold">Conversation &amp; activity</h2>
            {conversation?.unreadCount ? (
              <span className="rounded-full bg-[#b9eb35] px-2 py-0.5 text-xs font-bold">
                {conversation.unreadCount} unread
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[#68717b]">
            Messages refresh every 10 seconds. Structured actions remain separate.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => void refresh()}
          aria-label="Refresh conversation"
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {error ? (
        <InlineAlert
          className="m-5"
          variant="error"
          title="Conversation needs attention"
          description={error}
        />
      ) : null}

      <div
        className="max-h-[34rem] min-h-64 space-y-4 overflow-y-auto bg-[#f7f9fa] px-4 py-5 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label="Conversation timeline"
      >
        {!conversation?.items.length ? (
          <div className="grid min-h-52 place-items-center text-center">
            <div>
              <MessageCircle className="mx-auto size-8 text-[#8b949d]" />
              <p className="mt-3 font-semibold">No messages yet</p>
              <p className="mt-1 max-w-sm text-sm text-[#68717b]">
                Send the first message to keep service details attached to this
                {` ${contextLabel}.`}
              </p>
            </div>
          </div>
        ) : (
          conversation.items.map((item) =>
            item.kind === "ACTIVITY" ? (
              <div
                key={`activity-${item.id}`}
                className="mx-auto flex max-w-2xl items-start justify-center gap-2 text-center text-xs text-[#68717b]"
              >
                <Activity className="mt-0.5 size-3.5 shrink-0 text-[#5f8d11]" />
                <div>
                  <p>{item.summary}</p>
                  <time dateTime={item.occurredAt}>
                    {new Date(item.occurredAt).toLocaleString()}
                  </time>
                </div>
              </div>
            ) : (
              <article
                key={`message-${item.id}`}
                className={`flex ${item.isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${
                    item.isOwn
                      ? "rounded-br-md bg-[#eafb9b] text-[#102030]"
                      : "rounded-bl-md bg-white"
                  }`}
                >
                  <p className="text-xs font-bold text-[#5f6871]">
                    {item.isOwn ? "You" : item.authorDisplayName}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                    {item.body}
                  </p>
                  {item.attachments.length ? (
                    <div className="mt-2 space-y-1">
                      {item.attachments.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => void openAttachment(file.id)}
                          className="flex w-full items-center gap-2 rounded-xl border border-black/8 bg-white/70 px-3 py-2 text-left text-xs font-semibold hover:bg-white"
                        >
                          <FileText className="size-4" />
                          {file.mimeType} · {(file.sizeBytes / 1024).toFixed(0)} KB
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <time
                    className="mt-2 block text-[11px] text-[#737d86]"
                    dateTime={item.occurredAt}
                  >
                    {new Date(item.occurredAt).toLocaleString()}
                  </time>
                </div>
              </article>
            ),
          )
        )}
      </div>

      <div className="border-t border-black/8 bg-white p-4 sm:p-5">
        <label htmlFor={`${audience}-conversation-message`} className="sr-only">
          Message
        </label>
        <textarea
          id={`${audience}-conversation-message`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={4_000}
          placeholder={`Write a message about this ${contextLabel}…`}
          className="w-full resize-none rounded-2xl border border-black/10 bg-white p-3 text-sm leading-6 outline-none focus:border-[#5f8d11]"
        />
        {allowAttachments && attachment ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-[#f2f5f6] px-3 py-2 text-xs">
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove queued attachment"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {allowAttachments ? (
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-black/10 px-4 text-xs font-semibold">
              <Paperclip className="size-4" />
              {busy === "upload" ? "Uploading…" : "Attach file"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy !== null || Boolean(attachment)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void addAttachment(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          ) : (
            <span className="text-xs text-[#7a838c]">
              Use job evidence for work files.
            </span>
          )}
          <Button
            type="button"
            disabled={busy !== null || !body.trim()}
            loading={busy === "send"}
            onClick={() => void sendMessage()}
          >
            <Send className="size-4" />
            Send message
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#7a838c]" aria-live="polite">
          {busy === "send"
            ? "Sending message…"
            : busy === "upload"
              ? "Uploading attachment…"
              : allowAttachments
                ? "PDF, JPG, PNG, or WebP up to 8 MB."
                : "Messages stay connected to this job timeline."}
        </p>
      </div>
    </Surface>
  );
}
