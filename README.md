# 🎼 AI Score-to-MIDI Bridge (FL Studio 연동 지원)

종이 악보 스캔본(오선지, 타브 악보)을 업로드하면 AI가 이를 분석하여 멀티트랙 MIDI 파일로 변환하고, 오디오 샘플 음원을 자동으로 쪼개어 MPC 패드 스타일의 웹 샘플러로 연주하거나 DAW(FL Studio, Ableton Live 등) 레이어로 내보낼 수 있게 돕는 전자음악/힙합 샘플링 지원 플랫폼입니다.

본 프로젝트는 **AI+X 중급 개인 프로젝트**로 개발되었습니다.

---

## 📂 프로젝트 구조

* **[index.html](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/index.html)**: 힙합 드럼 머신(MPC) 감성을 살린 네온 글래스모피즘 테마의 메인 UI 레이아웃
* **[style.css](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/style.css)**: 반응형 및 고해상도 모니터 대응을 고려한 CSS 스타일 시트
* **[app.js](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/app.js)**: 전체 앱 로직 (Web Audio API 기반 Transient 검출, Gemini API 연동 OMR 파서, MIDI 생성 모듈)
* **[midi-writer-js.js](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/midi-writer-js.js)**: 클라이언트 사이드에서 다중 트랙 `.mid` 파일을 로컬에 동적으로 생성하기 위한 자바스크립트 라이브러리
* **[implementation_plan.md](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/implementation_plan.md)**: 기능 요구사항 정의 및 구현 마일스톤 기획서

---

## ✨ 핵심 기능

1. **멀티모달 Gemini API 기반 OMR (악보 파싱)**
   * 업로드된 오선지/타브 악보 스캔본의 음정(Pitch)과 박자(Duration)를 멀티모달 Vision 인공지능인 Gemini API를 통해 정교한 JSON 데이터로 변환.
2. **Web Audio API 오디오 슬라이서 (Transient Detection)**
   * 업로드한 WAV/MP3 드럼 루프 브레이크의 피크 레벨(RMS) 변화를 브라우저 내에서 실시간 분석하여 소리가 타격하는 순간(Transient)을 기점 삼아 최대 16패드로 자동 슬라이싱.
3. **16-Pad MPC 스타일 웹 샘플러**
   * 슬라이싱된 각 조각 음원을 키보드 맵핑(QWER/ASDF 등)과 연동하여 실시간으로 타격 연주 가능.
4. **DAW (FL Studio / Ableton) 최적화 멀티트랙 내보내기**
   * 멜로디(Melody), 코드(Chords), 베이스(Bass) 성부를 각각 개별적인 트랙으로 나누어 `.mid` 포맷으로 패키징. FL Studio의 Playlist나 Channel Rack에 직접 드래그 앤 드롭 시, 악기별 트랙이 즉시 분리되어 로딩됩니다.

---

## 🛠️ 기술 스택

* **Frontend**: `Vanilla HTML5`, `CSS3 (Neon Glassmorphism)`, `Modern JavaScript (ES6)`
* **Audio Engine**: `Web Audio API` (실시간 브라우저 오디오 처리)
* **Generative AI**: `Gemini Pro Vision API` (악보 이미지 데이터 인식)
* **Libraries**: `midi-writer-js` (바이트 레벨 MIDI 스트림 포맷터)

---

## 🚀 시작하기 (How to Run)

본 프로젝트는 순수 클라이언트 단 자바스크립트로 구축되어 있어 별도의 복잡한 웹 서버 구동 없이 브라우저로 직접 실행이 가능합니다.

1. **[index.html](file:///c:/Users/5174k/Code/202210822/AI+X/AI+X_중급/4/index.html)** 파일을 브라우저로 엽니다.
2. 우측 상단의 `⚙️ 설정` 버튼을 눌러 본인의 **Gemini API Key**를 입력합니다. (키 정보는 브라우저 LocalStorage에만 보관됩니다.)
3. 악보 이미지 혹은 드럼 루프 파일을 드롭존에 업로드하여 분석 및 플레이 백 연주를 시작합니다.
