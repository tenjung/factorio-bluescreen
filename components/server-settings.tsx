"use client";

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
] as const;
type Field = (typeof fields)[number];
type Settings = {
  maxPlayers: number;
  autosave: number;
  afk: number;
  adminPause: boolean;
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
          field.key === "adminPause" ? draft === "true" : Number(draft),
        );
      }}
    >
      <div>
        <Label htmlFor={id}>{field.label}</Label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {field.key === "adminPause" ? (
            <select
              className="log-select"
              id={id}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            >
              <option value="false">모든 플레이어</option>
              <option value="true">관리자만</option>
            </select>
          ) : (
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
          )}
          <Badge variant="outline">즉시 적용</Badge>
          <Button type="submit" disabled={busy || draft === String(initial)}>
            저장
          </Button>
        </div>
        <p className="section-caption">{field.help}</p>
      </div>
    </form>
  );
}

export function ServerSettings({ refreshKey }: { refreshKey: number }) {
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
  }, [refreshKey, password]);

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
      setMessage("서버에서 적용을 확인했고 재시작 후에도 유지됩니다.");
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
            ? fields.map((field) => (
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
      {settings && <NewWorld password={password} />}
    </>
  );
}
