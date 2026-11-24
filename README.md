# BLUESCREEN · Factorio Control

Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / shadcn/ui 기반 팩토리오 관리 웹입니다.

## 실행

```sh
npm ci
npm run dev
```

## 검증

```sh
npm run lint
npm run typecheck
npm run build
```

## 현재 구현 범위

- 반응형 상황판: 서버 상태, CPU·메모리 예시 그래프, 접속 인원, 로그, 최근 세이브
- 플레이어 검색, 로그 유형 필터와 검색
- 시작·종료·재시작·저장 확인창과 화면 내 시뮬레이션
- 서버 설정 입력 및 미리보기 적용 (메모리에만 보관, 새로고침 시 초기화)
- 기존 청사진 뷰어: `/blueprints/index.html` (원본 `index.html` 보존)

모든 수치와 플레이어·로그·세이브는 예시 데이터입니다. 실제 프로세스 제어, 설정 파일 수정, 파일 다운로드는 연결되어 있지 않습니다. 서버 연결 전 UI 검토용이며 로그인이나 관리 API를 제공하지 않습니다.

## 다음 단계

Mac 관리 에이전트, 관리자 인증, 인증된 HTTPS 연결, 실제 상태 조회 및 RCON 명령, 안전한 저장·종료를 순서대로 연결합니다. RCON 비밀번호와 에이전트 토큰은 브라우저나 Git에 포함하지 않습니다.

## Vercel

Framework: Next.js. 기본 빌드 명령 `npm run build`를 사용합니다. 현재 미리보기 웹은 별도 환경변수 없이 배포할 수 있습니다.

## Mac 운영용 API 에이전트

`npm run build:agent`로 `.agent-build/server.mjs`를 만듭니다. 이 파일은 Node.js 22 이상에서 실행되며 런타임용 npm 패키지는 필요하지 않습니다. 개발용 Next.js 서버와 별도로, 서버 Mac의 루프백 주소 `127.0.0.1:3111`에서 기존 `/api/server-status` API를 제공합니다.

Mac의 `com.factorio.bluescreen` LaunchAgent는 `~/Library/Application Support/FactorioBluescreen/`에 설치한 번들과 런처를 실행합니다. API나 Mac의 Factorio 제어 로직을 수정하면 번들을 다시 빌드하고 설치한 뒤 **이 LaunchAgent만** 재시작해야 합니다. 웹의 Vercel 배포는 Mac의 번들을 갱신하지 않습니다.

실행 시 `FACTORIO_LOCAL_STATUS=1`, `FACTORIO_SERVER_DIR`, `FACTORIO_BRIDGE_SECRET`, `FACTORIO_SETTINGS_PASSWORD`가 필요합니다. 운영 비밀값은 Mac의 보호된 파일에 보관합니다. 문제가 있으면 보관된 `start.nextjs.sh`를 `start.sh`로 복원하고 에이전트를 재시작할 수 있습니다.
