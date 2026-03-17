# Cosmic Dice Roller — Design Spec

## Overview

10~60 범위의 숫자가 나오는 3D 주사위 굴리기 웹앱. 최대 4개의 주사위를 동시에 굴릴 수 있으며, 코스믹 그라디언트 스타일의 비주얼을 갖는다.

## Requirements

- 주사위 범위: 10~60 (정수, 51가지 결과)
- 동시 주사위 수: 1~4개 (사용자 선택)
- 3D 렌더링: 구체형 주사위, 미세한 면 질감
- 비주얼 스타일: 코스믹 그라디언트 (보라+청록)
- 결과 표시: 주사위 표면에 숫자만 표시 (심플)
- 기술 스택: 바닐라 HTML/CSS/JS + Three.js (CDN)

## Project Structure

```
dice-roller/
  index.html              # 메인 페이지
  css/
    style.css             # 스타일 (레이아웃, 컨트롤, 반응형)
  js/
    main.js               # 앱 진입점 (Three.js 씬 세팅, UI 이벤트 바인딩)
    dice.js               # Dice 클래스 (3D 메시 생성, 애니메이션, 결과 텍스처)
  tests/
    dice.test.html        # 테스트
```

## Architecture

### Three.js Scene (`main.js`)

- **Renderer**: `WebGLRenderer`, 전체 화면 캔버스, antialias 활성화
- **Camera**: `PerspectiveCamera`, 고정 시점, 주사위 1~4개가 잘 보이는 거리
- **Lighting**:
  - `AmbientLight` (약한 보라색 톤)
  - `PointLight` x2 (좌상단 + 우하단, 글로우 효과용)
- **Background**: CSS 그라디언트 배경 (Three.js 씬은 투명, CSS가 배경 담당)
- **Animation Loop**: `requestAnimationFrame` 기반

### Dice Class (`dice.js`)

```
class Dice {
  constructor(scene, position)
  roll()              → Promise<number>  // 애니메이션 후 결과 반환
  setResult(number)   → void             // 결과 숫자 텍스처 적용
  update(deltaTime)   → void             // 프레임 업데이트
  dispose()           → void             // 리소스 정리
}
```

**Geometry**: `IcosahedronGeometry(radius, detail=4)` — 구에 가깝지만 미세한 면 질감 유지

**Material**: `MeshPhysicalMaterial`
- color: 보라+청록 그라디언트 (커스텀 셰이더 또는 텍스처)
- metalness: 0.3
- roughness: 0.4
- emissive: 약한 보라색 글로우

**Result Display**: `CanvasTexture`
- 2D 캔버스에 숫자를 큰 폰트로 렌더링
- 굴림 정지 후 주사위 정면에 텍스처 매핑
- 폰트: bold, 흰색, 그림자 효과

**Roll Animation**:
1. 랜덤 축(x, y, z) 설정
2. 빠른 회전 시작 (angular velocity ≈ 15~20 rad/s)
3. 약 1.5~2초에 걸쳐 속도 감소 (ease-out)
4. 정지 후 `Math.floor(Math.random() * 51) + 10`으로 결과 생성
5. `setResult()`로 숫자 텍스처 적용

### Multi-Dice Management (`main.js`)

- `diceArray: Dice[]` — 현재 활성 주사위 목록
- 개수 변경 시: 추가는 `new Dice()`, 제거는 `dice.dispose()`
- 배치: 주사위 개수에 따라 균등 간격으로 x축 배치
  - 1개: center
  - 2개: -1.5, +1.5
  - 3개: -3, 0, +3
  - 4개: -4.5, -1.5, +1.5, +4.5

## UI Layout

### HTML Structure

```html
<body>
  <div id="title">COSMIC DICE</div>
  <canvas id="dice-canvas"></canvas>
  <div id="controls">
    <div id="dice-count">
      <span>DICE</span>
      <button data-count="1" class="active">1</button>
      <button data-count="2">2</button>
      <button data-count="3">3</button>
      <button data-count="4">4</button>
    </div>
    <button id="roll-btn">ROLL</button>
  </div>
</body>
```

### Styling (`style.css`)

- 전체 화면, 스크롤 없음 (`100vh`)
- 배경: `linear-gradient(135deg, #2d1b69, #11998e)`
- 타이틀: 상단 중앙, letter-spacing, text-shadow 글로우
- 캔버스: 전체 영역 (position absolute)
- 컨트롤: 하단 중앙 고정
  - 개수 선택: 작은 사각 버튼 (32x32px), 선택된 것에 하이라이트
  - ROLL 버튼: 둥근 필 버튼, 그라디언트, 글로우 그림자
- 반응형: 모바일에서 주사위/버튼 크기 조정

## Interaction Flow

1. 페이지 로드 → Three.js 씬 초기화, 기본 주사위 1개 표시
2. 주사위 개수 버튼 클릭 → 씬에서 주사위 추가/제거
3. ROLL 버튼 클릭 → 모든 주사위 동시에 굴림 시작
4. 애니메이션 완료 → 각 주사위에 결과 숫자 표시
5. 다시 ROLL 클릭 가능 (애니메이션 중에는 버튼 비활성화)

## Error Handling

- WebGL 미지원 시: 안내 메시지 표시
- 애니메이션 중 ROLL 클릭: 무시 (버튼 disabled)

## Out of Scope

- 결과 합계/히스토리 표시
- 드래그/스와이프 인터랙션
- 사운드 효과
- 서버 통신/데이터 저장
