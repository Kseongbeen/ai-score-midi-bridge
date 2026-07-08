# AI Sampler & Score-to-MIDI Bridge (AI 샘플러 및 악보-MIDI 변환기)

종이 악보 스캔본(오선지, 타브 악보)을 업로드하면 AI가 이를 분석하여 멀티트랙 MIDI 파일로 변환하고, 오디오 샘플 음원을 자동으로 쪼개어 MPC 패드 스타일의 웹 샘플러로 연주하거나 DAW 레이어로 내보낼 수 있게 돕는 전자음악/힙합 샘플링 지원 플랫폼입니다.

새로운 폴더인 [sampler-midi-bridge](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/sampler-midi-bridge) 아래에 아예 새로운 프로젝트로 구축합니다.

## User Review Required

> [!IMPORTANT]
> - **API Key 사용**: 악보 이미지 인식(OMR) 및 오디오 코드 분석에는 멀티모달 Vision AI 기능이 필요합니다. 클라이언트 사이드에서 직접 Gemini API를 호출할 수 있도록 웹 UI에 **사용자 API Key 입력 필드(Settings)**를 제공하겠습니다. (키는 브라우저 LocalStorage에 안전하게 보관되며 외부 서버로 전송되지 않습니다.)
> - **오디오 슬라이싱(Transient Detection)**: 오디오 파일 업로드 시, 웹 브라우저 내부의 Web Audio API를 활용하여 오디오 버퍼의 진폭 변화(RMS/Peak)를 분석해 소리가 타격하는 시점(Transient)을 AI 분석을 활용한 정교한 알고리즘으로 슬라이싱합니다.
> - **멀티트랙 MIDI 내보내기**: 브라우저에서 동적으로 다중 트랙 `.mid` 파일을 생성하기 위해 오픈소스 라이브러리인 `midi-writer-js` (CDN 로드)를 사용합니다. 생성된 MIDI 파일은 Ableton, FL Studio, Logic 등 모든 DAW에서 즉시 개별 레이어로 자동 로드됩니다.

## Open Questions

> [!NOTE]
> - 추가로 특별히 연동하고 싶은 DAW 전용 파일 포맷(예: Ableton Live Set, FL Studio 등)이 있으신가요? 기본적으로는 모든 DAW가 호환되는 표준 MIDI (.mid) 형식을 지원할 계획입니다.

## Proposed Changes

새로운 폴더인 [sampler-midi-bridge](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/sampler-midi-bridge) 내에 다음 구조로 생성합니다:

### [Core App Component]

#### [NEW] [index.html](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/sampler-midi-bridge/index.html)
- 전체적인 레이아웃 구조 정의
- **1. 악보/샘플 분석 구역**: 이미지/오디오 파일 업로드 드롭존
- **2. 웹 MPC 샘플러 구역**: 16패드 레이아웃 및 파형 시각화(Waveform Visualizer)
- **3. MIDI 트랙 관리 & 컨트롤러**: 생성된 멀티트랙 연주 및 개별 음소거/솔로, DAW 다운로드 버튼
- **4. 설정 모달**: Gemini API 키 등록, 노이즈 필터 감도 설정 등

#### [NEW] [style.css](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/sampler-midi-bridge/style.css)
- 힙합 드럼 머신(MPC) 감성을 살린 세련된 글래스모피즘 테마
- 활성화된 패드 및 오디오 파형에 형광 네온 그린/오렌지 빛 이펙트 적용
- 업로드 진행도 및 AI 분석 단계를 나타내는 부드러운 애니메이션

#### [NEW] [app.js](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/sampler-midi-bridge/app.js)
- **AI 악보 파서**: Gemini API를 이용해 이미지에서 악보 정보(음정, 박자, 마디)를 JSON으로 파싱하는 로직
- **오디오 분석기 (Auto-Chopper)**: 업로드된 MP3/WAV에서 피크 레벨을 측정해 Transient 기준으로 오디오를 쪼개고 Web Audio API 오디오 노드에 맵핑
- **MPC 시퀀서 및 연주 트리거**: 마우스나 키보드(ASDF/QWER 등)로 패드를 두드려 쪼갠 소리를 샘플링 연주
- **MIDI Writer**: 분석된 악보 데이터를 `midi-writer-js` 라이브러리를 통해 다중 트랙 MIDI 바이너리로 변환하여 로컬 저장 및 다운로드 기능 구현

## Verification Plan

### Manual Verification
1. 브라우저로 접속해 API Key 세팅 후 준비된 악보 이미지 업로드
2. AI 가 악보를 멜로디 시퀀스로 올바르게 복원하는지 확인
3. 드럼 브레이크 루프 오디오 업로드 후 AI 가 transient 타격점에 맞춰 16패드로 올바르게 쪼개는지 청음 테스트
4. 생성된 MIDI 파일을 다운로드하여 DAW (Ableton/FL Studio 등)에 올려 멀티트랙 레이어로 깔끔하게 분할 로드되는지 검증
