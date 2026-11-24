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
