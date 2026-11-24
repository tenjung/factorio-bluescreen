"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const endpoint = "/api/server-status?view=chat";

export function ServerChat({
  password,
  running,
}: {
  password: string;
  running?: boolean;
}) {
  const [messages, setMessages] = useState<string[]>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch(endpoint, {
          headers: { "x-settings-password": password },
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
          ]),
        });
        if (!response.ok) throw new Error("Chat unavailable");
        setMessages(await response.json());
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [password]);

  async function send() {
    setSending(true);
    setFeedback("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-settings-password": password,
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
          <p className="section-caption">최근 채팅 최대 50개 · 5초마다 갱신</p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="terminal-lines max-h-72 overflow-y-auto rounded-md"
          aria-label="게임 채팅 목록"
        >
          {messages?.length ? (
            <ul className="space-y-2">
              {[...messages].reverse().map((line, index) => (
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
        {error && (
          <p className="section-caption">채팅을 갱신하지 못했습니다.</p>
        )}
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
            disabled={sending || running !== true}
          />
          <Button
            type="submit"
            disabled={
              sending ||
              running !== true ||
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
      </CardContent>
    </Card>
  );
}
