"use client";

import { ServerAddresses } from "@/components/server-addresses";
import { NewWorld } from "@/components/new-world";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fields = [
  {
    key: "maxPlayers",
    label: "최대 접속 인원",
    help: "0은 인원 제한 없음",
    min: 0,
    max: 65535,
  },
  {
    key: "autosave",
    label: "자동 저장 간격 (분)",
    help: "1–1440분",
    min: 1,
    max: 1440,
  },
  {
    key: "afk",
    label: "AFK 자동 퇴장 (분)",
    help: "0은 자동 퇴장 안 함",
    min: 0,
    max: 1440,
  },
  {
    key: "adminPause",
    label: "일시정지 권한",
    help: "관리자만 일시정지할 수 있도록 제한합니다.",
  },
  {
    key: "autoPause",
    label: "빈 서버 자동 일시정지",
    help: "접속자가 없으면 공장 진행을 멈춥니다.",
  },
] as const;
type Field = (typeof fields)[number];
type Settings = {
  maxPlayers: number;
  autosave: number;
  afk: number;
  adminPause: boolean;
  autoPause: boolean;
};
const endpoint = "/api/server-status?view=settings";

function Setting({
  field,
  initial,
  busy,
  onSave,
}: {
  field: Field;
  initial: number | boolean;
  busy: boolean;
  onSave: (key: Field["key"], value: number | boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(initial));
  const id = `setting-${field.key}`;
  return (
    <form
      className="settings-form border-b border-border py-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(
          field.key,
          typeof initial === "boolean" ? draft === "true" : Number(draft),
        );
      }}
    >
      <div>
        <Label htmlFor={id}>{field.label}</Label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {"min" in field ? (
            <Input
              className="!w-32"
              id={id}
              required
              type="number"
              min={field.min}
              max={field.max}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <select
              className="log-select"
              id={id}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            >
              <option value="false">
                {field.key === "autoPause" ? "끄기" : "모든 플레이어"}
              </option>
              <option value="true">
                {field.key === "autoPause" ? "켜기" : "관리자만"}
              </option>
            </select>
          )}
          <Badge variant="outline">
            {field.key === "autoPause" ? "재시작 후 적용" : "즉시 적용"}
          </Badge>
          <Button type="submit" disabled={busy || draft === String(initial)}>
            저장
          </Button>
        </div>
        <p className="section-caption">{field.help}</p>
      </div>
    </form>
  );
}

export function ServerSettings({
  refreshKey,
  running,
}: {
  refreshKey: number;
  running?: boolean;
}) {
  const [operation, setOperation] = useState("");
  const [controlMessage, setControlMessage] = useState("");
  const [settingsRefresh, setSettingsRefresh] = useState(0);

  async function control(action: "save" | "start" | "stop" | "restart") {
    const label = {
      save: "저장",
      start: "시작",
      stop: "종료",
      restart: "재시작",
    }[action];
    if (
      (action === "stop" || action === "restart") &&
      !window.confirm(
        `현재 월드를 저장하고 서버를 ${label}할까요? 접속 중인 플레이어의 연결이 끊깁니다.`,
      )
    )
      return;
    setOperation(action);
    setControlMessage(`${label} 중…`);
    try {
      const response = await fetch("/api/server-status?view=control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-settings-password": password,
        },
        body: JSON.stringify({ action, confirmed: true }),
      });
      if (!response.ok) throw new Error("Control failed");
      const result = await response.json();
      setControlMessage(
        result.save ? `저장 완료 · ${result.save}` : `${label} 완료`,
      );
      setSettingsRefresh((value) => value + 1);
    } catch {
      setControlMessage(
        `${label} 결과를 확인하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도하세요.`,
      );
    } finally {
      setOperation("");
    }
  }

  const [draftPassword, setDraftPassword] = useState("");
  const [password, setPassword] = useState("");
  const [settings, setSettings] = useState<Settings>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!password) return;
    const controller = new AbortController();
    fetch(endpoint, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-settings-password": password },
    })
      .then(async (response) => {
        if (response.status === 401) {
          setPassword("");
          setSettings(undefined);
          setMessage("비밀번호가 올바르지 않습니다.");
          return;
        }
        if (!response.ok) throw new Error("Settings unavailable");
        setSettings(await response.json());
        setMessage("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("설정을 읽지 못했습니다. 새로고침으로 다시 시도하세요.");
      });
    return () => controller.abort();
  }, [refreshKey, password, settingsRefresh]);

  async function save(key: Field["key"], value: number | boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-settings-password": password,
        },
        body: JSON.stringify({ key, value }),
      });
      if (!response.ok) throw new Error("Save failed");
      const applied = await response.json();
      setSettings((previous) => previous && { ...previous, ...applied });
      setMessage(
        key === "autoPause"
          ? "저장했습니다. 다음 서버 시작 또는 재시작 때 적용됩니다."
          : "서버에서 적용을 확인했고 재시작 후에도 유지됩니다.",
      );
    } catch {
      setMessage(
        "저장 결과를 확인하지 못했습니다. 다시 저장하기 전에 새로고침으로 현재 값을 확인하세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!password)
    return (
      <Card>
        <CardHeader>
          <CardTitle>서버 설정 잠금</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="settings-form max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage("");
              setPassword(draftPassword);
              setDraftPassword("");
            }}
          >
            <div>
              <Label htmlFor="settings-password">설정 비밀번호</Label>
              <Input
                id="settings-password"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
                value={draftPassword}
                onChange={(event) => setDraftPassword(event.target.value)}
              />
            </div>
            <Button type="submit">잠금 해제</Button>
            {message && <p role="alert">{message}</p>}
          </form>
        </CardContent>
      </Card>
    );

  return (
    <>
      <ServerAddresses password={password} refreshKey={refreshKey} />
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>서버 제어</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={Boolean(operation) || running !== true}
              onClick={() => void control("save")}
            >
              저장
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(operation) || running === undefined}
              onClick={() => void control(running ? "restart" : "start")}
            >
              {running === false ? "시작" : "재시작"}
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(operation) || running !== true}
              onClick={() => void control("stop")}
            >
              종료
            </Button>
          </div>
          <p className="section-caption" role="status">
            {controlMessage ||
              (running === undefined
                ? "서버 상태 확인 중"
                : running
                  ? "서버 실행 중"
                  : "서버 중지됨")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>서버 설정</CardTitle>
            <p className="section-caption">
              운영 중인 서버의 설정을 항목별로 변경합니다.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {settings
            ? fields
                .filter((field) => settings[field.key] !== undefined)
                .map((field) => (
                  <Setting
                    key={`${field.key}:${settings[field.key]}`}
                    field={field}
                    initial={settings[field.key]}
                    busy={busy}
                    onSave={save}
                  />
                ))
            : !message && <p>서버 설정을 읽는 중입니다.</p>}
          {message && (
            <p className="mt-4" role="status">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
      {settings && !operation && <NewWorld password={password} />}
    </>
  );
}
