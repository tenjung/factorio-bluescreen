"use client";

import { HistoryToggle } from "@/components/history-toggle";
import { historyLimits, recentLimits } from "@/lib/factorio-list-limits";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const endpoint = "/api/server-status?view=chat";

export function ServerChat({
  running,
  refreshKey,
  readOnly = false,
}: {
  running?: boolean;
  refreshKey: number;
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<string[]>();
  const [older, setOlder] = useState<string[]>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const chatList = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const latest = useRef<string | undefined>(undefined);
  const previousMessages = useRef<string[]>([]);

  const visibleMessages = older
    ? Array.from(new Set([...older, ...(messages ?? [])])).slice(
        -historyLimits.chat,
      )
    : messages;

  async function toggleHistory() {
    setHistoryError(false);
    if (older) {
      setOlder(undefined);
      return;
    }
    setLoadingOlder(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("Chat history unavailable");
      setOlder(await response.json());
    } catch {
      setHistoryError(true);
    } finally {
      setLoadingOlder(false);
    }
  }

  useLayoutEffect(() => {
    const list = chatList.current;
    if (list && followLatest.current) list.scrollTop = list.scrollHeight;
  }, [messages, older]);

  useEffect(() => {
    let stream: EventSource | undefined;
    function syncVisibility() {
      if (document.hidden) {
        stream?.close();
        stream = undefined;
        return;
      }
      if (stream) return;
      stream = new EventSource(`${endpoint}&stream=1`);
      stream.onmessage = ({ data }) => {
        setError(false);
        if (data !== latest.current) {
          const incoming: string[] = JSON.parse(data);
          if (latest.current !== undefined && !followLatest.current) {
            const previous = previousMessages.current;
            let overlap = Math.min(previous.length, incoming.length);
            while (
              overlap &&
              !previous
                .slice(-overlap)
                .every((line, index) => line === incoming[index])
            )
              overlap--;
            const added = incoming.length - overlap;
            if (added > 0) setUnread((count) => count + added);
          }
          latest.current = data;
          previousMessages.current = incoming;
          setMessages(incoming);
        }
      };
      stream.onerror = () => setError(true);
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      stream?.close();
    };
  }, [refreshKey]);

  async function send() {
    setSending(true);
    setFeedback("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: draft }),
      });
      if (!response.ok) throw new Error("Chat send failed");
      setDraft("");
      setFeedback("게임에 메시지를 보냈습니다.");
    } catch {
      setFeedback("전송을 확인하지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader>
        <div>
          <CardTitle>게임 채팅</CardTitle>
          <p className="section-caption">
            최근 채팅 최대 {older ? historyLimits.chat : recentLimits.chat}개 ·
            새 메시지가 있을 때 갱신
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="terminal-lines max-h-72 overflow-y-auto rounded-md"
          aria-label="게임 채팅 목록"
          ref={chatList}
          onScroll={(event) => {
            const list = event.currentTarget;
            followLatest.current =
              list.scrollHeight - list.clientHeight - list.scrollTop <= 24;
            if (followLatest.current) setUnread(0);
          }}
        >
          {visibleMessages?.length ? (
            <ul className="space-y-2">
              {visibleMessages.map((line, index) => (
                <li className="break-words text-sm" key={index}>
                  <span className="mr-2 text-muted-foreground">
                    {line.slice(11, 19)}
                  </span>
                  {line.slice(27)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {messages ? "표시할 채팅이 없습니다." : "채팅을 읽는 중입니다."}
            </p>
          )}
        </div>
        {(older || (messages?.length ?? 0) >= recentLimits.chat) && (
          <HistoryToggle
            expanded={Boolean(older)}
            pending={loadingOlder}
            error={historyError}
            onClick={() => void toggleHistory()}
          />
        )}
        {unread > 0 && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                followLatest.current = true;
                const list = chatList.current;
                if (list) list.scrollTop = list.scrollHeight;
                setUnread(0);
              }}
            >
              새 메시지 {unread}개 ↓
            </Button>
          </div>
        )}
        {error && (
          <p className="section-caption">게임 채팅에 다시 연결하는 중입니다.</p>
        )}
        {!readOnly && (
          <>
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <Input
                className="flex-1"
                maxLength={200}
                required
                aria-label="게임 메시지"
                placeholder="게임에 보낼 메시지"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={sending || running !== true || !messages}
              />
              <Button
                type="submit"
                disabled={
                  sending ||
                  running !== true ||
                  !messages ||
                  !draft.trim() ||
                  draft.trimStart().startsWith("/")
                }
              >
                전송
              </Button>
            </form>
            <p className="section-caption" role="status">
              {feedback || "메시지는 [웹 관리자]로 표시됩니다."}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
