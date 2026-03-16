# Cosmic Dice Roller

10~60 범위의 3D 주사위(d20) 웹앱. Three.js + 바닐라 JS, 빌드 도구 없음.

## Commands

```bash
# 로컬 서버 (dice-roller 디렉토리 안에서 실행해야 함)
npx serve -l 3460 .
# 브라우저: http://localhost:3460/
```

## Architecture

```
index.html          # 진입점, Three.js importmap (CDN v0.170.0)
css/style.css       # 코스믹 그라디언트 테마, 반응형
js/dice.js          # Dice 클래스 (3D 메시, 면 텍스처, 바운스 애니메이션)
js/main.js          # Three.js 씬/카메라/조명, 다중 주사위 관리, UI
tests/dice.test.html # 브라우저 기반 테스트 (로컬 서버 필요)
```

## Gotchas

- `npx serve -s`(SPA 모드) 사용 금지 — CSS/JS가 index.html로 리다이렉트됨
- CSS `display: flex`가 HTML `hidden` 속성을 덮어쓰므로 `#webgl-error`에 `:not([hidden])` 셀렉터 필요
- 테스트는 `file://` 프로토콜에서 안 됨 (ES Module CORS), 반드시 로컬 서버로 실행
- Dice 클래스는 면당 개별 material group 사용 (20개 머터리얼 배열)

## Code Conventions

- 구조적 변경(refactor)과 기능 변경(feat/fix) 분리 커밋
- 커밋 접두사: feat: / fix: / refactor: / docs:
- TDD 우선 (테스트 먼저 → 구현 → 리팩터)
