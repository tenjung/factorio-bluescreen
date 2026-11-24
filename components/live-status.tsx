"use client";

import { useEffect, useState } from "react";

type Status = {
  running: boolean;
  uptime: string | null;
  cpu: number | null;
  memoryMiB: number | null;
  checkedAt: string;
  players: string[] | null;
  saves: { name: string; size: number; modified: string }[] | null;
  logs: string[] | null;
};

export function LiveStatus({ page }: { page: string }) {
  const [status, setStatus] = useState<Status>();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    async function refresh() {
      try {
        const response = await fetch("/api/server-status", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(4000),
          ]),
        });
        if (!response.ok) throw new Error("Status unavailable");
        const result: Status = await response.json();
        if (!stopped) setStatus(result);
      } catch {
        if (!stopped) setStatus(undefined);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  if (!status) return <p role="status">실제 서버 상태를 확인할 수 없습니다.</p>;

  if (page === "players")
    return (
      <section className="server-banner">
        <div>
          <h2>현재 접속 플레이어</h2>
          {status.players === null ? (
            <p>플레이어 목록 조회 실패</p>
          ) : (
            <>
              <p>{status.players.length}명 접속 중</p>
              <ul>
                {status.players.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    );
  if (page === "saves")
    return (
      <section className="server-banner">
        <div>
          <h2>실제 세이브</h2>
          {status.saves === null ? (
            <p>세이브 목록 조회 실패</p>
          ) : status.saves.length === 0 ? (
            <p>세이브 없음</p>
          ) : (
            <ul>
              {status.saves.map((save) => (
                <li key={save.name}>
                  {save.name} · {(save.size / 1048576).toFixed(1)} MiB ·{" "}
                  {new Date(save.modified).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  if (page === "logs")
    return (
      <section className="server-banner">
        <div className="min-w-0">
          <h2>실제 서버 로그</h2>
          {status.logs === null ? (
            <p>로그 조회 실패</p>
          ) : status.logs.length === 0 ? (
            <p>표시할 운영 이벤트 없음</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words">
              {status.logs.join("\n")}
            </pre>
          )}
        </div>
      </section>
    );
  if (page === "settings")
    return <p>실제 서버 설정 변경은 아직 연결되지 않았습니다.</p>;

  return (
    <section className="server-banner" aria-label="실제 서버 상태">
      <div>
        <h2>실제 팩토리오 서버 · {status.running ? "실행 중" : "중지됨"}</h2>
        {status.running && (
          <p>
            접속 {status.players?.length ?? "확인 불가"}명 · 가동{" "}
            {status.uptime} · CPU {status.cpu}% · 메모리 {status.memoryMiB} MiB
          </p>
        )}
        <small>
          5초마다 갱신 ·{" "}
          {new Date(status.checkedAt).toLocaleTimeString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}{" "}
          KST
        </small>
      </div>
    </section>
  );
}
