"use client";

import { HistoryToggle } from "@/components/history-toggle";
import { historyLimits, recentLimits } from "@/lib/factorio-list-limits";
import { SaveFileManager } from "@/components/save-file-manager";
import { ServerChat } from "@/components/server-chat";
import { ServerSettings } from "@/components/server-settings";

import {
  Clock3,
  Cpu,
  Database,
  Factory,
  FileText,
  Radio,
  Terminal,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

type Status = {
  playerCount?: number | null;
  autoPauseConfigured?: boolean | null;
  operations?: {
    lastSave: { modified: string | null; durationMs: number | null } | null;
    connectionErrors: number;
  } | null;
  world?: string | null;
  playerEvents?:
    | { at: string; action: "JOIN" | "LEAVE"; player: string }[]
    | null;
  running: boolean;
  uptime: string | null;
  cpu: number | null;
  memoryMiB: number | null;
  checkedAt: string;
  players: string[] | null;
  saves: { name: string; size: number; modified: string }[] | null;
  logs: string[] | null;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul" });

export function LiveStatus({
  publicView = false,
  publicAddress,
  page,
  refreshKey,
  navigate,
}: {
  publicView?: boolean;
  publicAddress?: string;
  page: string;
  refreshKey: number;
  navigate: (page: string) => void;
}) {
  const [addressFeedback, setAddressFeedback] = useState("");
  const [history, setHistory] = useState<Status[]>([]);
  const [metric, setMetric] = useState("cpu");
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "reconnecting" | "paused"
  >("connecting");
  const [status, setStatus] = useState<Status>();
  useEffect(() => {
    let stream: EventSource | undefined;
    function syncVisibility() {
      if (document.hidden) {
        stream?.close();
        stream = undefined;
        setConnection("paused");
        return;
      }
      if (stream) return;
      setConnection("connecting");
      stream = new EventSource("/api/server-status?stream=1");
      stream.onopen = () => setConnection("connected");
      stream.onmessage = ({ data }) => {
        const result: Status = JSON.parse(data);
        setConnection("connected");
        setStatus(result);
        setHistory((previous) =>
          [
            ...previous.filter(
              (item) =>
                Date.parse(result.checkedAt) - Date.parse(item.checkedAt) <=
                  600_000 && item.checkedAt !== result.checkedAt,
            ),
            result,
          ].slice(-120),
        );
      };
      stream.onerror = () => setConnection("reconnecting");
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      stream?.close();
    };
  }, [refreshKey]);

  const [older, setOlder] = useState<
    Partial<Record<"logs" | "saves" | "playerEvents", Status>>
  >({});
  const [loadingOlder, setLoadingOlder] = useState<
    "logs" | "saves" | "playerEvents" | null
  >(null);
  const [historyError, setHistoryError] = useState<
    "logs" | "saves" | "playerEvents" | null
  >(null);

  async function toggleHistory(kind: "logs" | "saves" | "playerEvents") {
    setHistoryError(null);
    if (older[kind]) {
      setOlder((current) => ({ ...current, [kind]: undefined }));
      return;
    }
    setLoadingOlder(kind);
    try {
      const response = await fetch(`/api/server-status?history=${kind}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("History unavailable");
      const full: Status = await response.json();
      if (!Array.isArray(full[kind])) throw new Error("History unavailable");
      setOlder((current) => ({ ...current, [kind]: full }));
    } catch {
      setHistoryError(kind);
    } finally {
      setLoadingOlder(null);
    }
  }

  function historyButton(kind: "logs" | "saves" | "playerEvents") {
    if (!older[kind] && (status?.[kind]?.length ?? 0) < recentLimits[kind])
      return null;
    return (
      <HistoryToggle
        expanded={Boolean(older[kind])}
        pending={loadingOlder !== null}
        error={historyError === kind}
        onClick={() => void toggleHistory(kind)}
      />
    );
  }

  const logsToShow = older.logs
    ? Array.from(
        new Set([...(older.logs.logs ?? []), ...(status?.logs ?? [])]),
      ).slice(-historyLimits.logs)
    : status?.logs;
  const savesToShow = older.saves
    ? Array.from(
        new Map(
          [...(older.saves.saves ?? []), ...(status?.saves ?? [])].map(
            (save) => [save.name, save],
          ),
        ).values(),
      )
        .sort((a, b) => b.modified.localeCompare(a.modified))
        .slice(0, historyLimits.saves)
    : status?.saves;
  const eventsToShow = older.playerEvents
    ? Array.from(
        new Map(
          [
            ...(status?.playerEvents ?? []),
            ...(older.playerEvents.playerEvents ?? []),
          ].map((event) => [JSON.stringify(event), event]),
        ).values(),
      )
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, historyLimits.playerEvents)
    : status?.playerEvents;

  const overview = page === "overview";
  const recentSave = status?.saves?.[0];
  const cpu = metric === "cpu";
  const samples = history.filter(
    (item) => (cpu ? item.cpu : item.memoryMiB) !== null,
  );
  const values = samples.map((item) => (cpu ? item.cpu : item.memoryMiB) ?? 0);
  const unit = cpu ? "%" : "MiB";
  const top = cpu
    ? Math.max(100, Math.ceil(Math.max(0, ...values) / 100) * 100)
    : Math.max(128, Math.ceil(Math.max(0, ...values) / 128) * 128);
  const firstTime = Date.parse(samples[0]?.checkedAt ?? "");
  const lastTime = Date.parse(samples.at(-1)?.checkedAt ?? "");
  const points = samples
    .map(
      (sample, index) =>
        `${((Date.parse(sample.checkedAt) - firstTime) / Math.max(1, lastTime - firstTime)) * 590},${180 - (values[index] / top) * 180}`,
    )
    .join(" ");
  const metrics = [
    {
      icon: Users,
      label: "접속 플레이어",
      value: status?.playerCount ?? status?.players?.length,
      suffix: "명",
      detail: "현재 접속 인원",
    },
    {
      icon: Clock3,
      label: "서버 가동 시간",
      value: status?.uptime,
      suffix: "",
      detail: "전용 서버 프로세스",
    },
    {
      icon: Cpu,
      label: "CPU 사용량",
      value: status?.cpu,
      suffix: "%",
      detail: "서버 프로세스 CPU",
    },
    {
      icon: Database,
      label: "메모리 사용량",
      value: status?.memoryMiB,
      suffix: "MiB",
      detail: "서버 프로세스 메모리",
    },
  ];

  const playersCard = (
    <Card className="players-card">
      <CardHeader>
        <CardTitle>
          접속 플레이어{" "}
          <span className="count-label">{status?.players?.length ?? "—"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(status?.players ?? []).map((name) => (
          <div key={name} className="player-row">
            <div className="player-avatar bg-primary/10 text-primary">
              {name.slice(0, 2).toUpperCase()}
              <span className="status-dot" />
            </div>
            <div className="player-info">
              <strong>{name}</strong>
              <span>접속 중</span>
            </div>
          </div>
        ))}
        {!status?.players?.length && (
          <p className="empty-state">
            {status?.players
              ? "접속 중인 플레이어가 없습니다."
              : "플레이어 목록 확인 대기"}
          </p>
        )}
        {overview && (
          <button
            className="text-link full"
            onClick={() => navigate("players")}
          >
            플레이어 목록
          </button>
        )}
      </CardContent>
    </Card>
  );
  const operations = status?.operations;
  const waitingForPlayers =
    status?.running && (status.playerCount ?? status.players?.length) === 0;
  const logsCard = (
    <Card className="logs-card">
      <CardHeader>
        <CardTitle>
          <Terminal size={17} />
          서버 로그
        </CardTitle>
        {overview && (
          <button className="text-link" onClick={() => navigate("logs")}>
            전체 보기
          </button>
        )}
      </CardHeader>
      <CardContent>
        {operations && (
          <dl className="grid gap-2 border-b border-border px-4 py-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">마지막 저장 완료</dt>
              <dd>
                {operations.lastSave?.modified
                  ? formatTime(operations.lastSave.modified)
                  : operations.lastSave
                    ? "기록 확인됨"
                    : "기록 없음"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">저장 소요 시간</dt>
              <dd>
                {operations.lastSave?.durationMs != null
                  ? `${operations.lastSave.durationMs} ms`
                  : "확인 불가"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">최근 로그의 접속 오류</dt>
              <dd>{operations.connectionErrors}건</dd>
            </div>
          </dl>
        )}
        <div className="terminal-lines max-h-96 overflow-y-auto">
          {(overview ? status?.logs?.slice(-6) : logsToShow)?.map(
            (line, index) => (
              <div
                key={index}
                className="mb-2 break-words font-mono text-xs text-muted-foreground"
              >
                {line}
              </div>
            ),
          )}
          {!status?.logs?.length && (
            <p className="empty-state">
              {status?.logs ? "표시할 운영 로그가 없습니다." : "로그 확인 대기"}
            </p>
          )}
        </div>
        {!overview && <div className="px-4 pb-3">{historyButton("logs")}</div>}
      </CardContent>
    </Card>
  );
  const savesCard = (
    <Card className="save-card">
      <CardHeader>
        <CardTitle>
          <Database size={17} />
          {overview ? "최근 세이브" : "세이브 목록"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          {(overview
            ? recentSave
              ? [recentSave]
              : []
            : (savesToShow ?? [])
          ).map((save) => (
            <div className="save-list-row" key={save.name}>
              <div className="file-icon">
                <FileText size={22} />
              </div>
              <div className="save-list-info min-w-0 break-words">
                <strong>{save.name}</strong>
                <span>
                  {new Date(save.modified).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}{" "}
                  · {(save.size / 1048576).toFixed(1)} MiB
                </span>
              </div>
            </div>
          ))}
          {!status?.saves?.length && (
            <p className="empty-state">
              {status?.saves ? "저장 파일이 없습니다." : "세이브 확인 대기"}
            </p>
          )}
        </div>
        {overview && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("saves")}
          >
            세이브 관리
          </Button>
        )}
        {!overview && historyButton("saves")}
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="demo-banner" role="status">
        <div>
          <Radio size={16} />
          <span>
            <strong>
              {connection === "reconnecting"
                ? "재연결 중"
                : connection === "paused"
                  ? "연결 일시중지"
                  : connection === "connected" && status
                    ? "실시간 연결"
                    : "서버 연결 중"}
            </strong>
            <span className="banner-detail">
              {status
                ? ` · 마지막 수신 ${formatTime(status.checkedAt)} KST`
                : ""}
            </span>
          </span>
        </div>
      </div>
      {page === "players" && playersCard}
      {page === "players" && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>접속·퇴장 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsToShow?.length ? (
              <ol className="max-h-96 divide-y divide-border overflow-y-auto">
                {eventsToShow.map(({ at, action, player }, index) => (
                  <li
                    key={`${at}-${action}-${player}-${index}`}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <time
                      className="text-sm text-muted-foreground"
                      dateTime={`${at.replace(" ", "T")}+09:00`}
                    >
                      {at.slice(5)}
                    </time>
                    <Badge
                      variant="outline"
                      className={action === "JOIN" ? "badge-green" : undefined}
                    >
                      {action === "JOIN" ? "접속" : "퇴장"}
                    </Badge>
                    <span className="break-all">{player}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="section-caption">
                {status?.playerEvents
                  ? "최근 접속·퇴장 기록이 없습니다."
                  : "접속 기록을 확인하는 중입니다."}
              </p>
            )}
            {historyButton("playerEvents")}
          </CardContent>
        </Card>
      )}
      {page === "logs" && logsCard}
      {page === "saves" &&
        (publicView ? (
          <>
            {savesCard}
            <Button asChild variant="outline" className="mt-4">
              <a href="https://factorio-bluescreen-git-feat-control-d-ced340-tenjungs-projects.vercel.app/saves">
                관리자 세이브 관리
              </a>
            </Button>
          </>
        ) : (
          <SaveFileManager
            refreshKey={refreshKey}
            running={status?.running}
            playerCount={status?.playerCount ?? status?.players?.length}
          />
        ))}
      {page === "chat" && (
        <ServerChat
          running={status?.running}
          readOnly={publicView}
          refreshKey={refreshKey}
        />
      )}
      {page === "settings" &&
        (publicView ? (
          <Card>
            <CardHeader>
              <CardTitle>서버 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                서버 설정과 제어는 관리자 페이지에서 이용할 수 있습니다.
              </p>
              <Button asChild variant="outline">
                <a href="https://factorio-bluescreen-git-feat-control-d-ced340-tenjungs-projects.vercel.app/">
                  관리자 페이지 열기
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ServerSettings refreshKey={refreshKey} running={status?.running} />
        ))}
      {overview && (
        <>
          <section className="server-banner" aria-label="실제 서버 상태">
            <div className="server-identity">
              <div className="server-icon">
                <Factory size={28} />
              </div>
              <div>
                <div className="server-title">
                  <h2>팩토리오 전용 서버</h2>
                  <Badge
                    className={
                      status?.running && connection === "connected"
                        ? "badge-green"
                        : "badge-muted"
                    }
                  >
                    {status
                      ? `${connection !== "connected" ? "마지막 상태 · " : ""}${status.running ? (waitingForPlayers ? "접속 대기" : "실행 중") : "중지됨"}`
                      : "상태 확인 중"}
                  </Badge>
                </div>
                <p>
                  Mac mini <span className="metadata-divider" /> 실시간 조회
                </p>
                <p className="flex flex-wrap gap-x-4">
                  <span>
                    현재 월드{" "}
                    <strong className="break-all text-foreground">
                      {status?.world ??
                        (status?.running === false ? "서버 중지됨" : "확인 중")}
                      {waitingForPlayers &&
                        status?.autoPauseConfigured === true &&
                        " · 자동 일시정지 설정 켜짐"}
                    </strong>
                  </span>
                  <span>
                    최근 세이브 수정{" "}
                    <strong className="text-foreground">
                      {recentSave
                        ? new Date(recentSave.modified).toLocaleString(
                            "ko-KR",
                            { timeZone: "Asia/Seoul" },
                          )
                        : "—"}
                    </strong>
                  </span>
                </p>
              </div>
            </div>
            {publicView && publicAddress && (
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">
                  Factorio 외부 접속 주소
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all">{publicAddress}</code>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicAddress);
                        setAddressFeedback("접속 주소를 복사했습니다.");
                      } catch {
                        setAddressFeedback("주소를 선택해 복사하세요.");
                      }
                    }}
                  >
                    주소 복사
                  </Button>
                </div>
                {addressFeedback && (
                  <p className="text-xs text-muted-foreground" role="status">
                    {addressFeedback}
                  </p>
                )}
              </div>
            )}
            {!publicView && (
              <Button variant="outline" onClick={() => navigate("settings")}>
                서버 설정
              </Button>
            )}
          </section>
          <div className="stats-grid">
            {metrics.map(({ icon: Icon, label, value, suffix, detail }) => (
              <Card className="stat-card" key={label}>
                <CardContent>
                  <div className="stat-label">
                    {label}
                    <Icon size={17} />
                  </div>
                  <div className="stat-value">
                    {value ?? "—"}
                    {value != null && suffix && <span>{suffix}</span>}
                  </div>
                  <div className="stat-foot">{detail}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="middle-grid">
            <Card className="performance-card">
              <CardHeader>
                <div>
                  <CardTitle>서버 리소스</CardTitle>
                  <p className="section-caption">
                    접속자·로그 변경 시 기록한 최근 10분
                  </p>
                </div>
                <Tabs value={metric} onValueChange={setMetric}>
                  <TabsList>
                    <TabsTrigger value="cpu">CPU</TabsTrigger>
                    <TabsTrigger value="memory">메모리</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                <div className="chart-summary">
                  <strong>
                    {(cpu ? status?.cpu : status?.memoryMiB) ?? "—"}
                    <span>{unit}</span>
                  </strong>
                  <span>
                    <span className="legend-dot" />
                    {cpu ? "CPU" : "메모리"} 사용량
                  </span>
                </div>
                <div
                  className="chart"
                  role="img"
                  aria-label={
                    cpu
                      ? "실시간 CPU 사용량 그래프"
                      : "실시간 메모리 사용량 그래프"
                  }
                >
                  <div className="chart-scale min-w-10">
                    {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                      <span key={fraction}>
                        {top * fraction}
                        {unit}
                      </span>
                    ))}
                  </div>
                  <div className="chart-plot">
                    <svg
                      viewBox="0 0 590 180"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="live-fill" x2="0" y2="1">
                          <stop stopColor="#d4a46c" stopOpacity=".24" />
                          <stop
                            offset="1"
                            stopColor="#d4a46c"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      {[0, 45, 90, 135, 179].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          y1={y}
                          x2="590"
                          y2={y}
                          stroke="#ffffff16"
                          strokeDasharray="3 5"
                        />
                      ))}
                      {samples.length > 1 && (
                        <>
                          <polygon
                            points={`0,180 ${points} 590,180`}
                            fill="url(#live-fill)"
                          />
                          <polyline
                            points={points}
                            fill="none"
                            stroke="#d4a46c"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                        </>
                      )}
                    </svg>
                    <div className="chart-times">
                      {samples.length > 1 ? (
                        <>
                          <span>{formatTime(samples[0].checkedAt)}</span>
                          <span>
                            {formatTime(samples[samples.length - 1].checkedAt)}
                          </span>
                        </>
                      ) : (
                        <span>측정값 수집 중</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            {playersCard}
          </div>
          <div className="bottom-grid">
            {logsCard}
            {savesCard}
          </div>
        </>
      )}
    </>
  );
}
