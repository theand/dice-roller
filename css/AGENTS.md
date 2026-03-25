<!-- Parent: ../AGENTS.md -->

# css

## Purpose
코스믹 그라디언트 테마 스타일시트. 전체 화면 레이아웃, 주사위 컨트롤 UI, WebGL 에러 표시, 반응형 대응을 담당.

## Key Files

| File | Description |
|------|-------------|
| `style.css` | 전체 앱 스타일 — 보라+청록 그라디언트 배경, 하단 컨트롤 패널(개수/면 선택 버튼, ROLL 버튼), WebGL 에러 오버레이, 480px 이하 모바일 대응 |

## For AI Agents

### Working In This Directory
- `#webgl-error`는 `display: none`이 기본이고, `:not([hidden])` 셀렉터로 `display: flex`를 활성화 — HTML `hidden` 속성과 CSS `display: flex` 충돌 방지 패턴
- 컨트롤 버튼(`.count-btn`, `.sides-btn`)은 `.active` 클래스로 선택 상태 표시
- Three.js 캔버스(`#dice-canvas`)는 `position: absolute`로 전체 화면 차지

### Testing Requirements
- 브라우저에서 `index.html` 열어 레이아웃 확인
- 480px 이하 뷰포트에서 반응형 동작 확인

### Common Patterns
- 글래스모피즘 스타일: `rgba()` 배경 + 반투명 보더
- 그라디언트 버튼: `linear-gradient(135deg, #667eea, #764ba2)` + `box-shadow` 글로우

## Dependencies

### Internal
- `../index.html` — 스타일시트 링크

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
