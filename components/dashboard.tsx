"use client";

import { LiveStatus } from "@/components/live-status";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Factory,
  FileText,
  HardDrive,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Play,
  Power,
  Radio,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const navigation = [
  { id: "overview", label: "상황판", icon: LayoutDashboard },
  { id: "players", label: "플레이어", icon: Users },
  { id: "saves", label: "세이브 관리", icon: Database },
  { id: "logs", label: "서버 로그", icon: Terminal },
  { id: "chat", label: "게임 채팅", icon: MessageSquare },
  { id: "settings", label: "서버 설정", icon: Settings2 },
];
const players = [
  {
    name: "tenjung",
    role: "관리자",
    color: "#d5a86e",
    initials: "TJ",
    time: "2시간 34분",
    ping: "12 ms",
  },
  {
    name: "engineer_02",
    role: "플레이어",
    color: "#8b9fae",
    initials: "E2",
    time: "1시간 18분",
    ping: "28 ms",
  },
  {
    name: "ironplate",
    role: "플레이어",
    color: "#9ca88d",
    initials: "IP",
    time: "46분",
    ping: "19 ms",
  },
];
const initialLogs = [
  {
    time: "20:48:12",
    level: "INFO",
    text: "서버가 정상적으로 시작되었습니다.",
  },
  { time: "20:48:13", level: "INFO", text: "Loading map: _autosave1.zip" },
  {
    time: "20:48:15",
    level: "INFO",
    text: "게임 상태 변경: CreatingGame → InGame",
  },
  {
    time: "20:49:02",
    level: "JOIN",
    text: "tenjung 님이 서버에 접속했습니다.",
  },
  {
    time: "20:51:38",
    level: "JOIN",
    text: "engineer_02 님이 서버에 접속했습니다.",
  },
  {
    time: "21:02:17",
    level: "JOIN",
    text: "ironplate 님이 서버에 접속했습니다.",
  },
  {
    time: "21:15:00",
    level: "SAVE",
    text: "자동 저장 완료: _autosave2.zip (128.4 MB)",
  },
  {
    time: "21:20:00",
    level: "INFO",
    text: "업데이트 정상 · 서버 응답 시간 14 ms",
  },
];
const saves = [
  {
    name: "_autosave2.zip",
    kind: "자동 저장",
    date: "오늘 21:15",
    size: "128.4 MB",
  },
  {
    name: "_autosave1.zip",
    kind: "자동 저장",
    date: "오늘 21:00",
    size: "128.1 MB",
  },
  {
    name: "nauvis-day-42.zip",
    kind: "수동 저장",
    date: "어제 23:42",
    size: "126.8 MB",
  },
];
const chartValues = [
  20, 22, 21, 25, 23, 27, 25, 26, 22, 24, 25, 23, 25, 24, 28, 25, 24, 25, 22,
  24, 27, 25, 26, 23, 25, 24, 26, 29, 27, 25, 26, 24, 27, 25, 24, 26, 28, 25,
  27, 26, 29, 27, 25, 26, 24, 27, 25, 26, 28, 25, 27, 29, 27, 28, 25, 27, 26,
  29, 27, 28,
];

function PerformanceChart({ metric }: { metric: string }) {
  const cpu = metric === "CPU";
  const points = chartValues
    .map((v, i) => `${i * 10},${cpu ? 180 - v * 1.8 : 126 - (v - 20) * 0.8}`)
    .join(" ");
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${metric} 최근 1시간 예시 그래프`}
    >
      <div className="chart-scale">
        <span>{cpu ? "100%" : "8 GB"}</span>
        <span>{cpu ? "75%" : "6 GB"}</span>
        <span>{cpu ? "50%" : "4 GB"}</span>
        <span>{cpu ? "25%" : "2 GB"}</span>
        <span>0</span>
      </div>
      <div className="chart-plot">
        <svg viewBox="0 0 590 180" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d4a46c" stopOpacity=".18" />
              <stop offset="100%" stopColor="#d4a46c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 45, 90, 135, 179].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="590"
              y2={y}
              stroke="#ffffff0c"
              strokeDasharray="3 5"
            />
          ))}
          <polygon points={`0,180 ${points} 590,180`} fill="url(#fill)" />
          <polyline
            points={points}
            fill="none"
            stroke="#d4a46c"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="chart-times">
          <span>20:20</span>
          <span>20:30</span>
          <span>20:40</span>
          <span>20:50</span>
          <span>21:00</span>
          <span>21:20</span>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({
  live = false,
  publicView = false,
  publicAddress,
}: {
  live?: boolean;
  publicView?: boolean;
  publicAddress?: string;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const pathname = usePathname();
  const page =
    navigation.find(
      ({ id }) => (id === "overview" ? "/" : `/${id}`) === pathname,
    )?.id ?? "overview";
  const [mobileNav, setMobileNav] = useState(false);
  const [metric, setMetric] = useState("CPU");
  const [running, setRunning] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [logFilter, setLogFilter] = useState("ALL");
  const [logs, setLogs] = useState(initialLogs);
  const [serverName, setServerName] = useState("Nauvis · Blue Factory");
  const [maxPlayers, setMaxPlayers] = useState("16");
  const [description, setDescription] = useState(
    "The factory must grow. 함께 만드는 나우비스 공장",
  );
  const [publicServer, setPublicServer] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const title = navigation.find((n) => n.id === page)?.label ?? "상황판";
  const filteredLogs = logs.filter(
    (l) =>
      (logFilter === "ALL" || l.level === logFilter) &&
      l.text.toLowerCase().includes(query.toLowerCase()),
  );
  function navigate(id: string) {
    const href = id === "overview" ? "/" : `/${id}`;
    if (pathname !== href) window.history.pushState(null, "", href);
    setMobileNav(false);
    setQuery("");
  }
  function confirmAction() {
    if (action === "종료") setRunning(false);
    if (action === "시작" || action === "재시작") setRunning(true);
    setLogs((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
        level: "INFO",
        text: `[미리보기] ${action} 조작을 시뮬레이션했습니다. 실제 서버에는 전송되지 않았습니다.`,
      },
    ]);
    setNotice(
      `${action} 미리보기가 완료되었습니다. 실제 서버에는 적용되지 않았습니다.`,
    );
    setAction(null);
  }
  function downloadSave(name: string) {
    setNotice(
      `${name}: 실제 세이브 다운로드는 서버 연결 후 사용할 수 있습니다.`,
    );
  }
  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileNav && "is-open")}>
        <Link href="/" className="brand">
          <div className="brand-mark">
            <Factory size={22} />
          </div>
          <div>
            BLUESCREEN<span>FACTORIO CONTROL</span>
          </div>
        </Link>
        <Button
          className="mobile-close"
          variant="ghost"
          size="icon"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNav(false)}
        >
          <X />
        </Button>
        <div className="workspace">
          <div className="workspace-icon">
            <Box size={18} />
          </div>
          <div>
            나의 팩토리오<span>개인 서버 워크스페이스</span>
          </div>
          <Badge variant="outline">01</Badge>
        </div>
        <div className="nav-label">워크스페이스</div>
        <nav aria-label="주 메뉴">
          {navigation
            .filter((item) => live || item.id !== "chat")
            .map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={id === "overview" ? "/" : `/${id}`}
                aria-current={page === id ? "page" : undefined}
                prefetch={false}
                onNavigate={(event) => {
                  event.preventDefault();
                  navigate(id);
                }}
                className={cn("nav-item", page === id && "active")}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "players" && !live ? (
                  <span className="nav-count">{running ? 3 : 0}</span>
                ) : null}
                {id === page ? <span className="active-line" /> : null}
              </Link>
            ))}
        </nav>
        <div className="sidebar-link">
          <div className="nav-label">도구</div>
          <a
            className="nav-item"
            href="/blueprints/index.html"
            target="_blank"
            rel="noreferrer"
          >
            <Box size={18} />
            <span>청사진 뷰어</span>
            <ExternalLink size={13} />
          </a>
          <a
            className="nav-item"
            href="https://wiki.factorio.com/Multiplayer"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={18} />
            <span>운영 가이드</span>
            <ExternalLink size={13} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <div className="agent-state">
            <span className="status-dot amber" />
            <span>{live ? "실시간 조회 모드" : "에이전트 연결 대기"}</span>
            <ChevronRight size={14} />
          </div>
          <div className="account">
            <div className="avatar">TJ</div>
            <div>
              tenjung<span>워크스페이스 관리자</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {mobileNav ? (
        <button
          className="nav-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              className="mobile-menu"
              variant="ghost"
              size="icon"
              aria-label="메뉴 열기"
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </Button>
            <Factory size={15} />
            <span>워크스페이스</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="preview-label">
              <span className="status-dot amber" />{" "}
              {live ? "실시간 조회" : "UI 미리보기"}
            </span>
            <a
              href="https://github.com/tenjung/factorio-bluescreen"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 저장소"
            >
              <ExternalLink size={17} />
            </a>
            <div className="avatar small">TJ</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR FACTORY, AT A GLANCE</div>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === "overview"
                  ? "공장은 계속 돌아갑니다. 모든 운영 현황을 한곳에서 확인하세요."
                  : page === "players"
                    ? "공장을 함께 만드는 플레이어를 확인하세요."
                    : page === "saves"
                      ? "소중한 공장의 진행 상황을 안전하게 관리하세요."
                      : page === "logs"
                        ? "서버에서 일어나는 모든 일을 확인하세요."
                        : page === "chat"
                          ? "게임 채팅을 읽고 메시지를 보내세요."
                          : "나만의 공장에 맞게 서버 운영 환경을 설정하세요."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                live
                  ? setRefreshKey((key) => key + 1)
                  : setNotice(
                      "미리보기 데이터를 표시하고 있습니다. 실시간 갱신은 에이전트 연결 후 사용할 수 있습니다.",
                    )
              }
            >
              <RefreshCw size={14} />
              새로고침
            </Button>
          </div>
          {live ? (
            <LiveStatus
              publicView={publicView}
              publicAddress={publicAddress}
              page={page}
              refreshKey={refreshKey}
              navigate={navigate}
            />
          ) : (
            <>
              <div className="demo-banner">
                <div>
                  <Radio size={16} />
                  <span>
                    <strong>미리보기 모드</strong>
                    <span className="banner-detail">
                      {" "}
                      · 아래 수치와 로그는 예시입니다. 실제 서버는 아직 연결되지
                      않았습니다.
                    </span>
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigate("settings");
                    setNotice(
                      "다음 단계에서 Mac 관리 에이전트와 인증된 연결을 구성합니다.",
                    );
                  }}
                >
                  연결 안내 <ArrowUpRight size={14} />
                </button>
              </div>
              {notice ? (
                <div className="notice" role="status">
                  <Check size={16} />
                  <span>{notice}</span>
                  <button aria-label="알림 닫기" onClick={() => setNotice("")}>
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              {page === "overview" ? (
                <>
                  <section className="server-banner">
                    <div className="server-identity">
                      <div className="server-icon">
                        <Factory size={29} />
                      </div>
                      <div>
                        <div className="server-title">
                          <h2>{serverName}</h2>
                          <Badge
                            className={running ? "badge-green" : "badge-muted"}
                          >
                            <span
                              className={cn("status-dot", !running && "gray")}
                            />
                            {running ? "실행 중" : "중지됨"} · 예시
                          </Badge>
                        </div>
                        <p>
                          <span>전용 서버</span>
                          <span className="metadata-divider" />
                          Factorio 2.0 <span className="metadata-divider" />
                          Mac mini
                        </p>
                      </div>
                    </div>
                    <div className="server-actions">
                      <Button
                        variant="outline"
                        onClick={() => setAction("저장")}
                        disabled={!running}
                      >
                        <Save size={15} />
                        저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setAction(running ? "재시작" : "시작")}
                      >
                        {running ? <RefreshCw size={15} /> : <Play size={15} />}
                        {running ? "재시작" : "시작"}
                      </Button>
                      <Button
                        className="stop-button"
                        variant="outline"
                        onClick={() => setAction("종료")}
                        disabled={!running}
                      >
                        <Power size={15} />
                        종료
                      </Button>
                    </div>
                  </section>
                  <div className="stats-grid">
                    {[
                      {
                        icon: Users,
                        label: "접속 플레이어",
                        value: running ? "3" : "0",
                        suffix: `/ ${maxPlayers}`,
                        foot: running ? "함께 공장을 만드는 중" : "서버 중지됨",
                        accent: true,
                      },
                      {
                        icon: Clock3,
                        label: "서버 가동 시간",
                        value: running ? "12" : "0",
                        suffix: running ? "시간 34분" : "시간",
                        foot: "마지막 시작 · 오늘 08:46",
                      },
                      {
                        icon: Cpu,
                        label: "CPU 사용량",
                        value: running ? "24.8" : "0",
                        suffix: "%",
                        foot: running ? "안정적인 상태" : "서버 중지됨",
                        progress: running ? 25 : 0,
                      },
                      {
                        icon: Database,
                        label: "메모리 사용량",
                        value: running ? "2.4" : "0",
                        suffix: "/ 8 GB",
                        foot: running ? "전체 메모리의 30%" : "서버 중지됨",
                        progress: running ? 30 : 0,
                      },
                    ].map(
                      ({
                        icon: Icon,
                        label,
                        value,
                        suffix,
                        foot,
                        progress,
                        accent,
                      }) => (
                        <Card key={label} className="stat-card">
                          <CardContent>
                            <div className="stat-label">
                              {label}
                              <Icon size={17} />
                            </div>
                            <div className="stat-value">
                              {value}
                              <span>{suffix}</span>
                            </div>
                            {progress ? (
                              <div className="stat-progress">
                                <span style={{ width: `${progress}%` }} />
                              </div>
                            ) : null}
                            <div
                              className={cn(
                                "stat-foot",
                                accent && "green-text",
                              )}
                            >
                              {accent ? <span className="status-dot" /> : null}
                              {foot}
                            </div>
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                  <div className="middle-grid">
                    <Card className="performance-card">
                      <CardHeader>
                        <div>
                          <CardTitle>서버 리소스</CardTitle>
                          <p className="section-caption">
                            최근 1시간의 리소스 사용 추이 · 예시
                          </p>
                        </div>
                        <Tabs value={metric} onValueChange={setMetric}>
                          <TabsList>
                            <TabsTrigger value="CPU">CPU</TabsTrigger>
                            <TabsTrigger value="메모리">메모리</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardHeader>
                      <CardContent>
                        <div className="chart-summary">
                          <strong>
                            {metric === "CPU" ? "24.8" : "2.4"}
                            <span>{metric === "CPU" ? "%" : "GB"}</span>
                          </strong>
                          <span>
                            <span className="legend-dot" />
                            {metric} 사용량
                          </span>
                          <Badge variant="outline">최근 1시간</Badge>
                        </div>
                        <PerformanceChart metric={metric} />
                        <div className="chart-footer">
                          <span>
                            <Activity size={13} />
                            안정적으로 운영되고 있습니다
                          </span>
                          <span>예시 데이터</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="players-card">
                      <CardHeader>
                        <CardTitle>
                          접속 플레이어{" "}
                          <span className="count-label">{running ? 3 : 0}</span>
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="플레이어 목록 보기"
                          onClick={() => navigate("players")}
                        >
                          <MoreHorizontal size={18} />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {running ? (
                          players.map((p) => (
                            <div className="player-row" key={p.name}>
                              <div
                                className="player-avatar"
                                style={{
                                  background: `${p.color}18`,
                                  color: p.color,
                                }}
                              >
                                {p.initials}
                                <span className="status-dot" />
                              </div>
                              <div className="player-info">
                                <strong>{p.name}</strong>
                                <span>
                                  {p.role} · {p.time}
                                </span>
                              </div>
                              <span className="player-ping">
                                <span />
                                {p.ping}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-state">
                            서버가 중지되어 있습니다. (미리보기)
                          </div>
                        )}
                        <button
                          className="text-link full"
                          onClick={() => navigate("players")}
                        >
                          플레이어 관리 <ChevronRight size={14} />
                        </button>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="bottom-grid">
                    <Card className="logs-card">
                      <CardHeader>
                        <CardTitle>
                          <Terminal size={17} />
                          서버 로그<Badge variant="outline">예시</Badge>
                        </CardTitle>
                        <button
                          className="text-link"
                          onClick={() => navigate("logs")}
                        >
                          전체 보기 <ArrowUpRight size={13} />
                        </button>
                      </CardHeader>
                      <CardContent>
                        <div className="terminal-lines">
                          {logs.slice(-6).map((l, i) => (
                            <div className="log-line" key={i}>
                              <time>{l.time}</time>
                              <span
                                className={cn(
                                  "log-level",
                                  l.level.toLowerCase(),
                                )}
                              >
                                {l.level}
                              </span>
                              <span>{l.text}</span>
                            </div>
                          ))}
                        </div>
                        <div className="terminal-bottom">
                          <span className="terminal-cursor" />
                          실시간 로그 연결 대기
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="save-card">
                      <CardHeader>
                        <CardTitle>최근 세이브</CardTitle>
                        <HardDrive size={17} />
                      </CardHeader>
                      <CardContent>
                        <div className="save-file">
                          <div className="file-icon">
                            <FileText size={25} />
                          </div>
                          <div>
                            <strong>_autosave2.zip</strong>
                            <span>오늘 21:15 · 128.4 MB</span>
                          </div>
                        </div>
                        <div className="save-success">
                          <ShieldCheck size={14} />
                          자동 저장 완료 · 예시
                        </div>
                        <div className="save-meta">
                          <span>저장 주기</span>
                          <strong>15분마다</strong>
                        </div>
                        <div className="save-meta">
                          <span>보관 파일</span>
                          <strong>최근 3개</strong>
                        </div>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate("saves")}
                        >
                          <Database size={14} />
                          세이브 관리
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
              {page === "players" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      플레이어 목록 <Badge variant="outline">예시</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="search-field">
                      <Search size={16} />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="플레이어 검색"
                        aria-label="플레이어 검색"
                      />
                    </div>
                    {running ? (
                      players
                        .filter((p) =>
                          p.name.toLowerCase().includes(query.toLowerCase()),
                        )
                        .map((p) => (
                          <div key={p.name} className="player-row">
                            <div
                              className="player-avatar"
                              style={{
                                color: p.color,
                                background: `${p.color}18`,
                              }}
                            >
                              {p.initials}
                            </div>
                            <div className="player-info">
                              <strong>{p.name}</strong>
                              <span>
                                {p.role} · 접속 {p.time}
                              </span>
                            </div>
                            <Badge variant="outline">{p.ping}</Badge>
                          </div>
                        ))
                    ) : (
                      <p className="empty-state">
                        접속 중인 플레이어가 없습니다.
                      </p>
                    )}
                    {running &&
                    !players.some((p) =>
                      p.name.toLowerCase().includes(query.toLowerCase()),
                    ) ? (
                      <p className="empty-state">검색 결과가 없습니다.</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
              {page === "saves" ? (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>저장 파일</CardTitle>
                      <p className="section-caption">
                        실제 파일 관리는 에이전트 연결 후 제공됩니다.
                      </p>
                    </div>
                    <Button onClick={() => setAction("저장")}>
                      <Save size={15} />
                      수동 저장 미리보기
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {saves.map((s) => (
                      <div className="save-list-row" key={s.name}>
                        <div className="file-icon">
                          <FileText size={22} />
                        </div>
                        <div className="save-list-info">
                          <strong>{s.name}</strong>
                          <span>
                            {s.kind} · {s.date} · {s.size}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`${s.name} 다운로드 안내`}
                          onClick={() => downloadSave(s.name)}
                        >
                          <Download size={16} />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
              {page === "logs" ? (
                <Card className="logs-card">
                  <CardHeader>
                    <CardTitle>
                      <Terminal size={17} />
                      서버 로그
                    </CardTitle>
                    <select
                      className="log-select"
                      aria-label="로그 유형 필터"
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                    >
                      {["ALL", "INFO", "JOIN", "SAVE"].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </CardHeader>
                  <CardContent>
                    <div className="search-field">
                      <Search size={16} />
                      <Input
                        placeholder="로그 내용 검색"
                        aria-label="로그 내용 검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="terminal-lines expanded">
                      {filteredLogs.map((l, i) => (
                        <div className="log-line" key={i}>
                          <time>{l.time}</time>
                          <span
                            className={cn("log-level", l.level.toLowerCase())}
                          >
                            {l.level}
                          </span>
                          <span>{l.text}</span>
                        </div>
                      ))}
                      {!filteredLogs.length ? (
                        <p className="empty-state">
                          조건에 맞는 로그가 없습니다.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              {page === "settings" ? (
                <div className="settings-grid">
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle>기본 설정</CardTitle>
                        <p className="section-caption">
                          이 화면의 변경 사항은 미리보기에만 적용됩니다.
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setNotice(
                            "설정이 미리보기에 적용되었습니다. 실제 서버에는 저장되지 않았습니다.",
                          );
                        }}
                        className="settings-form"
                      >
                        <div>
                          <Label htmlFor="server-name">서버 이름</Label>
                          <Input
                            id="server-name"
                            required
                            maxLength={80}
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">서버 설명</Label>
                          <Input
                            id="description"
                            maxLength={200}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-players">최대 접속 인원</Label>
                          <Input
                            id="max-players"
                            type="number"
                            min="1"
                            max="1000"
                            required
                            value={maxPlayers}
                            onChange={(e) => setMaxPlayers(e.target.value)}
                          />
                        </div>
                        <div className="switch-row">
                          <div>
                            <Label htmlFor="public">공개 서버</Label>
                            <p>서버 목록에 공개합니다.</p>
                          </div>
                          <Switch
                            id="public"
                            checked={publicServer}
                            onCheckedChange={setPublicServer}
                          />
                        </div>
                        <div className="switch-row">
                          <div>
                            <Label htmlFor="autosave">자동 저장</Label>
                            <p>15분마다 진행 상황을 저장합니다.</p>
                          </div>
                          <Switch
                            id="autosave"
                            checked={autoSave}
                            onCheckedChange={setAutoSave}
                          />
                        </div>
                        <Button type="submit">
                          <Save size={15} />
                          설정 미리보기 적용
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                  <Card className="connection-card">
                    <CardHeader>
                      <CardTitle>
                        <Radio size={17} />
                        서버 연결
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">연결 대기</Badge>
                      <h3>공장과 연결할 준비 중입니다.</h3>
                      <p>
                        Mac 관리 에이전트가 연결되면 실제 상태 조회, 저장,
                        시작·종료 기능을 사용할 수 있습니다.
                      </p>
                      <div className="connection-step">
                        <Check size={16} />
                        관리 웹 UI
                      </div>
                      <div className="connection-step muted">
                        <span>2</span>Mac 에이전트 · 다음 단계
                      </div>
                      <div className="connection-step muted">
                        <span>3</span>인증 및 원격 제어 연동
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Factory size={13} />
              BLUESCREEN<span className="footer-divider">/</span> The factory
              must grow.
            </span>
            <span>
              {live ? "실시간 조회" : "UI Preview"}{" "}
              <span className="footer-divider">·</span> v0.1.0
            </span>
          </footer>
        </main>
      </div>
      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action} 동작을 미리 볼까요?</DialogTitle>
            <DialogDescription>
              미리보기 모드입니다. 화면의 상태와 작업 로그만 변경되며, 실행 중인
              실제 팩토리오 서버에는 명령을 보내지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              취소
            </Button>
            <Button onClick={confirmAction}>{action} 미리보기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
