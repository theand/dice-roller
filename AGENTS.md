# Cosmic Dice Roller

## Purpose
D6/D8/D12/D20 3D 주사위를 최대 4개까지 동시에 굴릴 수 있는 코스믹 테마 웹앱. Three.js + 바닐라 JS, 빌드 도구 없이 CDN import map으로 구성.

## Commands

```bash
# 로컬 서버 (dice-roller 디렉토리 안에서 실행해야 함)
npx serve -l 3460 .
# 브라우저: http://localhost:3460/
```

## Key Files

| File | Description |
|------|-------------|
| `index.html` | 앱 진입점. Three.js CDN importmap, UI 컨트롤(주사위 개수/면 선택, ROLL 버튼), WebGL 에러 표시 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `css/` | 코스믹 그라디언트 테마 스타일시트 (see `css/AGENTS.md`) |
| `js/` | 핵심 로직 — Dice 클래스와 Three.js 씬 관리 (see `js/AGENTS.md`) |
| `tests/` | 브라우저 기반 테스트 (see `tests/AGENTS.md`) |
| `docs/` | 설계 문서 및 구현 계획 (see `docs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 빌드 도구 없음 — `npx serve -l 3460 .` 로 로컬 서버 실행 (SPA 모드 `-s` 사용 금지)
- Three.js v0.170.0을 CDN importmap으로 로드하므로 패키지 매니저 불필요
- ES Module 기반이라 `file://` 프로토콜에서 테스트 불가, 반드시 HTTP 서버 사용

### Testing Requirements
- `tests/dice.test.html`을 로컬 서버(`http://localhost:3460/tests/dice.test.html`)로 열어 실행
- 결과는 브라우저 내 pass/fail 텍스트로 확인

### Common Patterns
- Dice 클래스는 면당 개별 material group 사용 (면 수만큼 머터리얼 배열)

### Code Conventions
- 구조적 변경(refactor)과 기능 변경(feat/fix) 분리 커밋
- 커밋 접두사: feat: / fix: / refactor: / docs:
- TDD 우선 (테스트 먼저 → 구현 → 리팩터)

## Dependencies

### External
- Three.js v0.170.0 (CDN: `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
