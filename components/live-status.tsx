"use client";

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
  page,
  refreshKey,
  navigate,
}: {
  page: string;
  refreshKey: number;
  navigate: (page: string) => void;
}) {
  const [history, setHistory] = useState<Status[]>([]);
  const [metric, setMetric] = useState("cpu");
  const [checked, setChecked] = useState(false);
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
        if (!stopped) {
          setStatus(result);
          setHistory((previous) =>
            [
              ...previous.filter(
                (item) =>
                  Date.parse(result.checkedAt) - Date.parse(item.checkedAt) <=
                  600_000,
              ),
              result,
            ].slice(-120),
          );
        }
      } catch {
        if (!stopped) setStatus(undefined);
      } finally {
        if (!stopped) {
          setChecked(true);
          timer = setTimeout(refresh, 5000);
        }
      }
    }
    void refresh();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [refreshKey]);

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
      value: status?.players?.length,
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
        <div className="terminal-lines">
          {(overview ? status?.logs?.slice(-6) : status?.logs)?.map(
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
        {(overview
          ? recentSave
            ? [recentSave]
            : []
          : (status?.saves ?? [])
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
        {overview && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("saves")}
          >
            세이브 관리
          </Button>
        )}
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
              {status
                ? "실시간 연결"
                : checked
                  ? "연결 확인 중"
                  : "서버 연결 중"}
            </strong>
            <span className="banner-detail">
              {status
                ? ` · 5초마다 갱신 · 마지막 확인 ${formatTime(status.checkedAt)} KST`
                : checked
                  ? " · 서버에 다시 연결하고 있습니다."
                  : ""}
            </span>
          </span>
        </div>
      </div>
      {page === "players" && playersCard}
      {page === "logs" && logsCard}
      {page === "saves" && savesCard}
      {page === "chat" && <ServerChat running={status?.running} />}
      {page === "settings" && (
        <ServerSettings refreshKey={refreshKey} running={status?.running} />
      )}
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
                    className={status?.running ? "badge-green" : "badge-muted"}
                  >
                    {status
                      ? status.running
                        ? "실행 중"
                        : "중지됨"
                      : "상태 확인 중"}
                  </Badge>
                </div>
                <p>
                  Mac mini <span className="metadata-divider" /> 실시간 조회
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("settings")}>
              서버 설정
            </Button>
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
                    화면을 연 뒤 수집한 최근 10분
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
