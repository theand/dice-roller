<!-- Parent: ../AGENTS.md -->

# tests

## Purpose
브라우저 기반 테스트. Three.js 씬 내에서 Dice 클래스의 생성, 굴림 결과 범위, 면 접촉, 리소스 정리를 검증.

## Key Files

| File | Description |
|------|-------------|
| `dice.test.html` | D20/D6 Dice 인스턴스 생성, `completeRoll()` 헬퍼로 애니메이션 구동 후 결과 범위(1~N) 검증, 면 접촉(flat contact) 확인, `dispose()` 후 씬 제거 확인. 커스텀 `assert()` 함수로 pass/fail 표시 |

## For AI Agents

### Working In This Directory
- `file://` 프로토콜에서 ES Module CORS 에러 발생 — 반드시 HTTP 서버(`npx serve -l 3460 .`)로 실행
- 테스트 URL: `http://localhost:3460/tests/dice.test.html`
- 테스트 프레임워크 없이 커스텀 `assert()` 함수 사용 (pass=초록, fail=빨강)
- `completeRoll()` 헬퍼: `setInterval`로 `dice.update(0.1)`을 반복 호출하여 애니메이션 완료까지 구동

### Testing Requirements
- 새 Dice 기능 추가 시 이 파일에 테스트 케이스 추가
- 모든 테스트가 pass한 뒤에만 커밋

### Common Patterns
- Three.js `Scene`을 직접 생성하여 테스트 격리
- 비동기 테스트: `await completeRoll(dice)` 패턴

## Dependencies

### Internal
- `../js/dice.js` — 테스트 대상 `Dice` 클래스

### External
- Three.js v0.170.0 (CDN importmap)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
