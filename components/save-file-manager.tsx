"use client";

import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type SaveFile = {
  name: string;
  size: number;
  modified: string;
  protected: boolean;
};
const endpoint = "/api/server-status?view=save-files";

export function SaveFileManager({ refreshKey }: { refreshKey: number }) {
  const [draft, setDraft] = useState("");
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<SaveFile[]>();
  const [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const eligible =
    files?.filter((file) => !file.protected).map((file) => file.name) ?? [];
  const chosen = selection.filter((name) => eligible.includes(name));

  useEffect(() => {
    if (!password) return;
    const controller = new AbortController();
    fetch(endpoint, {
      headers: { "x-settings-password": password },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setPassword("");
          setFiles(undefined);
          setSelection([]);
          setMessage("설정 비밀번호를 확인해 주세요.");
          return;
        }
        if (!response.ok) throw new Error("Unable to list saves");
        const list: SaveFile[] = await response.json();
        if (!controller.signal.aborted) setFiles(list);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("세이브 목록을 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [password, refreshKey]);

  async function download(file: SaveFile) {
    setBusy(file.name);
    setMessage("");
    try {
      const response = await fetch(
        `${endpoint}&file=${encodeURIComponent(file.name)}`,
        { headers: { "x-settings-password": password }, cache: "no-store" },
      );
      if (
        !response.ok ||
        response.headers.get("content-type") !== "application/zip"
      )
        throw new Error("Download failed");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty download");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("파일을 다운로드하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function removeSelected() {
    if (!chosen.length) return;
    setBusy("delete");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-settings-password": password,
        },
        body: JSON.stringify({ names: chosen, confirmed: true }),
      });
      if (response.status === 409) {
        setMessage(
          "일부 파일이 보호 상태이거나 다른 서버 작업이 진행 중입니다. 새로고침 후 다시 선택하세요.",
        );
        return;
      }
      if (!response.ok) throw new Error("Delete failed");
      const result: { files: SaveFile[]; moved: string[]; failed: string[] } =
        await response.json();
      setFiles(result.files);
      setSelection(result.failed);
      setMessage(
        `${result.moved.length}개를 복구 폴더로 옮겼습니다.${result.failed.length ? ` ${result.failed.length}개는 옮기지 못했습니다.` : ""}`,
      );
    } catch {
      setMessage(
        "삭제 결과를 확인하지 못했습니다. 먼저 목록을 새로고침하세요.",
      );
    } finally {
      setDialog(false);
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>세이브 파일 관리</CardTitle>
          <p className="section-caption">
            파일을 다운로드하거나, 선택한 파일을 복구 폴더로 옮길 수 있습니다.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {!password ? (
          <form
            className="settings-form max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage("");
              setPassword(draft);
              setDraft("");
            }}
          >
            <div>
              <Label htmlFor="saves-password">설정 비밀번호</Label>
              <Input
                id="saves-password"
                type="password"
                inputMode="numeric"
                required
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <Button type="submit">잠금 해제</Button>
          </form>
        ) : files ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
              <Checkbox
                id="all-saves"
                disabled={!eligible.length || busy !== null}
                checked={
                  eligible.length > 0 && chosen.length === eligible.length
                    ? true
                    : chosen.length
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(checked) =>
                  setSelection(checked === true ? eligible : [])
                }
              />
              <Label htmlFor="all-saves">전체 선택</Label>
              <span className="text-sm text-muted-foreground">
                {chosen.length}개 선택
              </span>
              <Button
                className="ml-auto"
                variant="destructive"
                disabled={!chosen.length || busy !== null}
                onClick={() => setDialog(true)}
              >
                <Trash2 size={15} />
                선택 삭제
              </Button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {files.map((file) => (
                <div className="save-list-row" key={file.name}>
                  <Checkbox
                    aria-label={`${file.name} 선택`}
                    checked={chosen.includes(file.name)}
                    disabled={file.protected || busy !== null}
                    onCheckedChange={(checked) =>
                      setSelection((current) =>
                        checked === true
                          ? [...current, file.name]
                          : current.filter((name) => name !== file.name),
                      )
                    }
                  />
                  <div className="save-list-info min-w-0 break-all">
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1048576).toFixed(2)} MiB ·{" "}
                      {new Date(file.modified).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </span>
                  </div>
                  {file.protected && <Badge variant="outline">보호됨</Badge>}
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`${file.name} 다운로드`}
                    disabled={busy !== null}
                    onClick={() => void download(file)}
                  >
                    <Download size={15} />
                  </Button>
                </div>
              ))}
            </div>
            {!files.length && (
              <p className="empty-state">저장 파일이 없습니다.</p>
            )}
            <p className="section-caption">
              서버가 불러온 월드, 가장 최근 세이브, 기본 월드는 보호합니다.
            </p>
          </>
        ) : (
          !message && <p>세이브 목록을 불러오는 중입니다.</p>
        )}
        {message && (
          <p className="mt-3 text-sm" role="status">
            {message}
          </p>
        )}
      </CardContent>
      <Dialog
        open={dialog}
        onOpenChange={(open) => {
          if (busy !== "delete") setDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              선택한 세이브 {chosen.length}개를 삭제할까요?
            </DialogTitle>
            <DialogDescription>
              선택한 파일만 활성 목록에서 제거하고 Mac의 복구 폴더에 보관합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy === "delete"}
              onClick={() => setDialog(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy === "delete" || !chosen.length}
              onClick={() => void removeSelected()}
            >
              {busy === "delete" ? "이동 중…" : "선택 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
