<!-- Parent: ../AGENTS.md -->

# js

## Purpose
앱 핵심 로직. Dice 클래스(3D 메시, 물리 바운스 애니메이션, 면 텍스처)와 Three.js 씬/카메라/조명 세팅, 다중 주사위 관리, UI 이벤트 바인딩을 담당.

## Key Files

| File | Description |
|------|-------------|
| `dice.js` | `Dice` 클래스 — D6/D8/D12/D20 다면체 지오메트리 생성, 면별 컬러 머터리얼, 면 번호 라벨, 드롭+바운스 물리 시뮬레이션, 결과 스프라이트 표시. `SUPPORTED_DICE_SIDES` 상수 export |
| `main.js` | 앱 진입점 — WebGL 체크, Three.js 렌더러/씬/카메라/조명 초기화, 주사위 개수(1~4)·면 수 선택 UI 이벤트, ROLL 버튼 핸들링, 애니메이션 루프, 리사이즈 대응 |

## For AI Agents

### Working In This Directory
- ES Module 형식 (`import * as THREE from 'three'`), importmap으로 Three.js 해석
- `Dice` 클래스는 `scene` 참조를 생성자에서 받아 메시를 직접 추가/제거
- 면 데이터(`_faceData`)는 지오메트리 삼각형을 법선 기준으로 클러스터링하여 추출
- 바운스 물리 상수들(`GRAVITY`, `RESTITUTION`, `BOUNCE_STOP_SPEED` 등)이 파일 상단에 정의
- `dispose()` 호출 시 지오메트리, 머터리얼, 텍스처, 스프라이트 모두 정리 필수

### Testing Requirements
- `tests/dice.test.html`에서 Dice 생성, 결과 범위, 면 접촉, dispose 검증
- 변경 후 반드시 `http://localhost:3460/tests/dice.test.html` 에서 테스트 실행

### Common Patterns
- 면당 개별 material group: `geometry.addGroup(start, count, materialIndex)` 사용
- 결과 표시: `CanvasTexture` + `Sprite`로 주사위 위에 숫자 오버레이
- 상태 머신: `rolling` → `settling` → idle 순서로 애니메이션 전환
- `roll()` 은 `Promise<number>` 반환, 애니메이션 완료 후 resolve

## Dependencies

### Internal
- `../index.html` — `<script type="module" src="js/main.js">` 로 로드

### External
- Three.js v0.170.0 — `THREE.Mesh`, `THREE.MeshPhysicalMaterial`, `THREE.IcosahedronGeometry`, `THREE.BoxGeometry`, `THREE.OctahedronGeometry`, `THREE.DodecahedronGeometry`, `THREE.CanvasTexture`, `THREE.Sprite`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
