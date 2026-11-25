"use client";

import { useEffect, useState } from "react";
import { Download, RotateCcw, Trash2 } from "lucide-react";
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
type Inventory = { files: SaveFile[]; availableBytes: number | null };
const endpoint = "/api/server-status?view=save-files&inventory=1";

const formatCapacity = (bytes: number) =>
  bytes >= 1073741824
    ? `${(bytes / 1073741824).toFixed(2)} GiB`
    : `${(bytes / 1048576).toFixed(2)} MiB`;

export function SaveFileManager({
  refreshKey,
  running,
  playerCount,
}: {
  refreshKey: number;
  running?: boolean;
  playerCount?: number | null;
}) {
  const [draft, setDraft] = useState("");
  const [password, setPassword] = useState("");
  const [files, setFiles] = useState<SaveFile[]>();
  const [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState(false);
  const [rollbackFile, setRollbackFile] = useState<SaveFile>();
  const [availableBytes, setAvailableBytes] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const eligible =
    files?.filter((file) => !file.protected).map((file) => file.name) ?? [];
  const chosen = selection.filter((name) => eligible.includes(name));

  const totalBytes = files?.reduce((sum, file) => sum + file.size, 0) ?? 0;
  const selectedBytes =
    files?.reduce(
      (sum, file) => (chosen.includes(file.name) ? sum + file.size : sum),
      0,
    ) ?? 0;

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
        const inventory: Inventory = await response.json();
        if (!controller.signal.aborted) {
          if (!Array.isArray(inventory.files))
            throw new Error("Inventory unavailable");
          setFiles(inventory.files);
          setAvailableBytes(inventory.availableBytes);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("세이브 목록을 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [password, refreshKey, revision]);

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
        body: JSON.stringify({ names: chosen, confirmPermanentDeletion: true }),
      });
      if (response.status === 409) {
        setMessage(
          "일부 파일이 보호 상태이거나 다른 서버 작업이 진행 중입니다. 새로고침 후 다시 선택하세요.",
        );
        return;
      }
      if (!response.ok) throw new Error("Delete failed");
      const result: Inventory & { deleted: string[]; failed: string[] } =
        await response.json();
      setFiles(result.files);
      setAvailableBytes(result.availableBytes);
      setSelection(result.failed);
      setMessage(
        `${result.deleted.length}개를 영구 삭제했습니다.${result.failed.length ? ` ${result.failed.length}개는 삭제하지 못했습니다.` : ""}`,
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

  async function rollback(file: SaveFile) {
    setBusy("rollback");
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-settings-password": password,
        },
        body: JSON.stringify({ name: file.name, confirmRollback: true }),
      });
      if (!response.ok) throw new Error("Rollback failed");
      const result: { name: string; backup: string } = await response.json();
      setSelection([]);
      setMessage(
        `전환 완료 · ${result.name} · 전환 전 저장 ${result.backup}.zip`,
      );
    } catch {
      setMessage(
        "월드 전환을 확인하지 못했습니다. 상황판에서 현재 월드를 확인한 뒤 다시 시도하세요.",
      );
    } finally {
      setRevision((current) => current + 1);
      setRollbackFile(undefined);
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>세이브 파일 관리</CardTitle>
          <p className="section-caption">
            파일을 다운로드하거나, 선택한 파일을 영구 삭제할 수 있습니다.
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
            <dl className="mb-3 grid grid-cols-2 gap-3 rounded-md border border-border p-3 text-sm">
              <div>
                <dt className="text-muted-foreground">서버 디스크 여유</dt>
                <dd className="font-medium">
                  {availableBytes === null
                    ? "확인 불가"
                    : formatCapacity(availableBytes)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">세이브 총용량</dt>
                <dd className="font-medium">{formatCapacity(totalBytes)}</dd>
              </div>
            </dl>
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
                {chosen.length > 0 &&
                  ` · 확보 예상 ${formatCapacity(selectedBytes)}`}
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
                      {formatCapacity(file.size)} ·{" "}
                      {new Date(file.modified).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </span>
                  </div>
                  {file.protected && <Badge variant="outline">보호됨</Badge>}
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${file.name}로 서버 전환`}
                    disabled={busy !== null || running !== true}
                    onClick={() => setRollbackFile(file)}
                  >
                    <RotateCcw size={15} />
                    <span className="hidden sm:inline">이 세이브로 시작</span>
                  </Button>
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
              서버가 불러온 월드, 가장 최근 세이브, 기본 월드는 삭제를
              보호합니다. 세이브 전환은 서버 실행 중에 사용할 수 있습니다.
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
              선택한 파일 {formatCapacity(selectedBytes)}를 디스크에서 영구
              삭제합니다. 삭제한 파일은 복구할 수 없습니다.
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
              {busy === "delete" ? "삭제 중…" : "선택 삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(rollbackFile)}
        onOpenChange={(open) => {
          if (!open && busy !== "rollback") setRollbackFile(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 세이브로 서버를 다시 시작할까요?</DialogTitle>
            <DialogDescription className="break-all">
              {rollbackFile?.name} · 접속{" "}
              {playerCount == null ? "인원 확인 불가" : `${playerCount}명`}.
              현재 월드를 저장한 뒤 서버를 전환합니다. 접속 중인 플레이어의
              연결이 끊깁니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy === "rollback"}
              onClick={() => setRollbackFile(undefined)}
            >
              취소
            </Button>
            <Button
              disabled={!rollbackFile || busy !== null || running !== true}
              onClick={() => {
                if (rollbackFile) void rollback(rollbackFile);
              }}
            >
              {busy === "rollback" ? "전환 중…" : "저장 후 서버 전환"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
