// ==========================================
// AI Score-to-MIDI Bridge - Core Application
// ==========================================

// Global state variables
let audioCtx = null;
let uploadedSheetFiles = []; // Array of File objects to stack multiple sheets
let sheetData = null; // Parsed MIDI data
let activeTimeoutIds = [];
let isPlayingMidi = false;
let midiStartTime = 0;

// Default configuration settings
const DEFAULT_SYSTEM_PROMPT = `You are a professional Music Transcription AI. 
Your task is to analyze the provided image of a sheet music (it can be standard pentagram notation, lead sheet, piano roll, or guitar/bass tablature).
Transcribe the notes from the sheet music into a clean, structured JSON format.

Output JSON must strictly follow this structure:
{
  "bpm": 120,
  "timeSignature": "4/4",
  "tracks": [
    {
      "name": "Melody",
      "instrument": 80, 
      "notes": [
        {"pitch": "C4", "time": 0.0, "duration": 1.0, "velocity": 95},
        {"pitch": "E4", "time": 1.0, "duration": 1.0, "velocity": 95},
        {"pitch": "G4", "time": 2.0, "duration": 2.0, "velocity": 100}
      ]
    }
  ]
}

Rules:
1. "bpm" should be the detected BPM (default to 120 if not specified).
2. "timeSignature" should be the detected time signature (default to "4/4").
3. "tracks" can have multiple layers if the sheet music has multiple voices (e.g. Melody, Harmony, Chords, Bass, Drums).
4. "instrument" is the General MIDI program number:
   - Use 0 for Piano, 80 for Synth Lead, 32 for Bass, 48 for Strings, etc.
   - For DRUMS/PERCUSSION tracks, you MUST set "instrument": 115.
5. For "notes":
   - "pitch" is the pitch name with octave (e.g., "C4", "F#4", "Bb3").
   - For DRUMS (instrument 115), transcribe or generate notes using these exact drum-to-pitch mappings:
     * Kick Drum: "C2"
     * Snare Drum: "D2"
     * Closed Hi-hat: "F#2"
     * Open Hi-hat: "A#2"
     * Crash Cymbal: "C#3"
   - "time" is the start time of the note in BEATS (0.0 is the very beginning, 1.0 is the 2nd beat, 4.0 is the start of the 2nd measure in 4/4).
   - "duration" is the duration of the note in BEATS (1.0 for a quarter note, 0.5 for an eighth note, 2.0 for a half note, 4.0 for a whole note).
   - "velocity" is 1-127 (default 90).

Return ONLY the JSON object. Do not wrap it in markdown block like \`\`\`json. Do not write any conversational text before or after the JSON.`;

// UI Elements
const sheetDropzone = document.getElementById('sheetDropzone');
const sheetInput = document.getElementById('sheetInput');
const sheetFilesList = document.getElementById('sheetFilesList');

const btnAnalyzeSheet = document.getElementById('btnAnalyzeSheet');
const btnResetAll = document.getElementById('btnResetAll');
const btnDownloadMIDI = document.getElementById('btnDownloadMIDI');
const btnMidiPlay = document.getElementById('btnMidiPlay');
const btnMidiStop = document.getElementById('btnMidiStop');
const bpmInput = document.getElementById('bpmInput');
const midiStatusText = document.getElementById('midiStatusText');
const midiTracksContainer = document.getElementById('midiTracksContainer');
const noteBoardContainer = document.getElementById('noteBoardContainer');

const btnDemo = document.getElementById('btnDemo');
const btnSettings = document.getElementById('btnSettings');
const settingsModal = document.getElementById('settingsModal');
const btnSettingsClose = document.getElementById('btnSettingsClose');
const apiKeyInput = document.getElementById('apiKeyInput');
const promptInput = document.getElementById('promptInput');
const btnSaveSettings = document.getElementById('btnSaveSettings');

const statusToast = document.getElementById('statusToast');
const statusToastText = document.getElementById('statusToastText');

// ==========================================
// Setup & Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Load settings from localStorage
  const savedApiKey = localStorage.getItem('gemini_api_key') || '';
  const savedPrompt = localStorage.getItem('gemini_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  const savedModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
  
  apiKeyInput.value = savedApiKey;
  promptInput.value = savedPrompt;
  
  const modelSelect = document.getElementById('modelSelect');
  if (modelSelect) {
    modelSelect.value = savedModel;
  }
  
  // Attach listeners
  setupEventListeners();
});

// Lazy loader for AudioContext to bypass browser autoplays
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// ==========================================
// Event Listeners
// ==========================================
function setupEventListeners() {
  // Drag-and-drop for Sheet Music
  sheetDropzone.addEventListener('click', () => sheetInput.click());
  sheetInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  sheetDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    sheetDropzone.classList.add('dragover');
  });
  sheetDropzone.addEventListener('dragleave', () => sheetDropzone.classList.remove('dragover'));
  sheetDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    sheetDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleSheetFiles(e.dataTransfer.files);
    }
  });
  sheetInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleSheetFiles(e.target.files);
    }
  });

  // Action Buttons
  btnAnalyzeSheet.addEventListener('click', analyzeSheetWithAI);
  btnResetAll.addEventListener('click', clearAllMidiData);
  btnDownloadMIDI.addEventListener('click', downloadMidiFile);
  btnMidiPlay.addEventListener('click', playMidiPreview);
  btnMidiStop.addEventListener('click', stopMidiPreview);
  
  bpmInput.addEventListener('change', () => {
    if (sheetData) {
      sheetData.bpm = parseInt(bpmInput.value) || 120;
    }
  });

  // Demo loader
  btnDemo.addEventListener('click', loadDemoData);

  // Settings Modal
  btnSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
  });
  btnSettingsClose.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });
  btnSaveSettings.addEventListener('click', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
    localStorage.setItem('gemini_system_prompt', promptInput.value.trim());
    localStorage.setItem('gemini_model', document.getElementById('modelSelect').value);
    settingsModal.classList.remove('active');
    showNotification('설정이 저장되었습니다.');
  });
}

// ==========================================
// Notification & UI Helpers
// ==========================================
function showNotification(text, duration = 3000) {
  statusToastText.textContent = text;
  statusToast.classList.add('active');
  setTimeout(() => {
    statusToast.classList.remove('active');
  }, duration);
}

function showLoading(text) {
  statusToastText.textContent = text;
  statusToast.classList.add('active');
}

function hideLoading() {
  statusToast.classList.remove('active');
}

// ==========================================
// Sheet Music AI Parsing Integration
// ==========================================
// ==========================================
// Sheet Music AI Parsing Integration
// ==========================================
function handleSheetFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isDuplicate = uploadedSheetFiles.some(f => f.name === file.name && f.size === file.size);
    if (!isDuplicate) {
      uploadedSheetFiles.push(file);
    }
  }
  renderUploadedFilesList();
  showNotification(`${files.length}개의 악보 파일이 로드되었습니다.`);
}

function renderUploadedFilesList() {
  sheetFilesList.innerHTML = '';
  if (uploadedSheetFiles.length === 0) {
    sheetFilesList.style.display = 'none';
    return;
  }
  
  sheetFilesList.style.display = 'flex';
  
  uploadedSheetFiles.forEach((file, index) => {
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.04); padding: 0.5rem 0.75rem; border-radius: 6px; width: 100%; border: 1px solid rgba(255, 255, 255, 0.05);';
    
    fileInfo.innerHTML = `
      <span class="name" style="font-size: 0.8rem; font-family: var(--font-code); color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${file.name}</span>
      <button type="button" style="background: none; border: none; color: var(--neon-orange); cursor: pointer; font-weight: bold;" onclick="event.stopPropagation(); removeSheetFile(${index})">❌</button>
    `;
    sheetFilesList.appendChild(fileInfo);
  });
}

window.removeSheetFile = function(index) {
  uploadedSheetFiles.splice(index, 1);
  renderUploadedFilesList();
  sheetInput.value = ''; 
};

function clearAllSheetFiles() {
  uploadedSheetFiles = [];
  renderUploadedFilesList();
  sheetInput.value = '';
}

// ==========================================
// Parsing & Populating Tracks/Notes
// ==========================================
function resetSheetInfo() {
  sheetInput.value = '';
  uploadedSheetFiles = [];
  renderUploadedFilesList();
}

function clearAllMidiData() {
  stopMidiPreview();
  sheetData = null;
  midiStatusText.textContent = '악보 이미지를 올려 AI 분석을 진행하거나 데모를 로드해 주세요.';
  midiTracksContainer.innerHTML = `
    <div style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">
      현재 추출된 MIDI 트랙이 없습니다.
    </div>`;
  noteBoardContainer.innerHTML = '<div style="padding: 1.5rem 0; text-align: center;">대기 중...</div>';
  showNotification('모든 편곡 트랙 레이어가 초기화되었습니다.');
}

async function analyzeSheetWithAI() {
  if (uploadedSheetFiles.length === 0) {
    alert('먼저 악보 이미지 파일을 최소 한 개 이상 업로드해 주세요!');
    return;
  }
  
  const apiKey = apiKeyInput.value.trim() || localStorage.getItem('gemini_api_key') || '';
  if (!apiKey) {
    alert('Gemini API Key가 필요합니다. 우측 상단의 [⚙️ 설정 (API Key)] 버튼을 눌러 등록해 주세요.');
    settingsModal.classList.add('active');
    return;
  }
  
  showLoading(`Gemini AI 분석 준비 중... (총 ${uploadedSheetFiles.length}장)`);
  
  try {
    for (let i = 0; i < uploadedSheetFiles.length; i++) {
      const file = uploadedSheetFiles[i];
      showLoading(`[${i + 1}/${uploadedSheetFiles.length}] '${file.name}' 분석 중...`);
      
      const base64Data = await fileToBase64(file);
      const mimeType = file.type;
      await callGeminiAPIAsync(base64Data, mimeType, apiKey);
    }
    
    hideLoading();
    showNotification(`모든 악보 (${uploadedSheetFiles.length}장) 분석 및 레이어 적층 완료!`);
    clearAllSheetFiles(); // Clear file queue upon success
  } catch (err) {
    hideLoading();
    console.error("비동기 다중 분석 에러:", err);
    alert(`분석 실패: ${err.message}`);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function callGeminiAPIAsync(base64Data, mimeType, apiKey) {
  return new Promise((resolve, reject) => {
    let systemPrompt = promptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;
    
    const chkAutoArrange = document.getElementById('chkAutoArrange');
    if (chkAutoArrange && chkAutoArrange.checked) {
      systemPrompt += `\n\n[AUTO-ARRANGE BACKING TRACKS DIRECTIVE]:
If the sheet music image has only a single melody line (or simple notation), you MUST automatically compose and append matching backing tracks in addition to transcribing the melody:
- Track 1: "Melody" (Transcribed melody notes from the image)
- Track 2: "Chords" (Compose a matching 4-bar or 8-bar chord progression backing track using piano chords or pad notes, aligning with the melody's notes, key, and rhythm)
- Track 3: "Bass" (Compose a matching bassline track that follows the chord root notes and matches the melody's rhythm, in octave 2 or 3, e.g., A2, F2, C2, G2)
- Track 4: "Drums" (Compose a matching drum backing track using "instrument": 115. Create a rhythmic groove with Kick "C2" on beats 1 and 3, Snare "D2" on beats 2 and 4, and Closed Hi-hat "F#2" on eighth notes, or similar appropriate drum rhythm, matching the tempo)
All tracks MUST use the exact same tempo (BPM) and time signature and align harmoniously. Even if the sheet music image ONLY has a melody line, you MUST create these "Chords", "Bass", and "Drums" tracks in the returned JSON.`;
    }
    
    const model = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    .then(async res => {
      if (!res.ok) {
        let errorMsg = `HTTP 에러 상태: ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.error && errJson.error.message) {
            errorMsg = errJson.error.message;
          }
        } catch(e) {}
        throw new Error(errorMsg);
      }
      return res.json();
    })
    .then(data => {
      try {
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error("API가 결과를 반환하지 않았습니다.");
        }
        
        const candidate = data.candidates[0];
        if (candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
          throw new Error(`콘텐츠 필터에 의해 차단되었습니다. (원인: ${candidate.finishReason})`);
        }
        
        const responseText = candidate.content.parts[0].text;
        if (!responseText) {
          throw new Error("AI 응답 텍스트가 비어 있습니다.");
        }
        
        const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanJsonStr);
        
        if (!parsedData.tracks || !Array.isArray(parsedData.tracks)) {
          throw new Error("반환된 데이터에 'tracks' 배열이 존재하지 않습니다.");
        }
        
        loadParsedMusicData(parsedData);
        resolve();
      } catch(e) {
        reject(new Error(`JSON 파싱 에러: ${e.message}`));
      }
    })
    .catch(err => {
      reject(err);
    });
  });
}

function loadParsedMusicData(data) {
  if (!sheetData) {
    sheetData = {
      bpm: data.bpm || 120,
      timeSignature: data.timeSignature || '4/4',
      tracks: []
    };
    if (data.bpm) {
      bpmInput.value = data.bpm;
    }
  }
  
  // 누적 추가
  if (data.tracks && Array.isArray(data.tracks)) {
    data.tracks.forEach(newTrack => {
      // 중복 트랙명 보정 (예: Melody, Melody (2))
      const sameNameCount = sheetData.tracks.filter(t => t.name.startsWith(newTrack.name)).length;
      if (sameNameCount > 0) {
        newTrack.name = `${newTrack.name} (${sameNameCount + 1})`;
      }
      
      // 기본 속성 초기화
      newTrack.volume = typeof newTrack.volume === 'number' ? newTrack.volume : 80;
      newTrack.muted = newTrack.muted || false;
      newTrack.soloed = newTrack.soloed || false;
      newTrack.trackGainNode = null; // 오디오 재생용 게인 노드 참조용
      
      sheetData.tracks.push(newTrack);
    });
  }
  
  midiStatusText.textContent = `BPM: ${sheetData.bpm} | TimeSig: ${sheetData.timeSignature} | 누적 트랙: ${sheetData.tracks.length}개`;
  
  midiTracksContainer.innerHTML = '';
  sheetData.tracks.forEach((track, idx) => {
    const isDrum = track.instrument === 115 || track.name.toLowerCase().includes('drum');
    const trackItem = document.createElement('div');
    trackItem.className = isDrum ? 'track-item drum-track' : 'track-item';
    trackItem.innerHTML = `
      <div class="track-info">
        <span class="track-name">Track ${idx + 1}: ${track.name}</span>
        <span class="track-details">Instrument: ${isDrum ? 'Drums (Ch. 10)' : 'GM #' + track.instrument} | Notes: ${track.notes.length}</span>
      </div>
      <div class="track-mixer">
        <div class="volume-control-wrapper">
          <span class="volume-icon">🔊</span>
          <input type="range" class="track-volume-slider" min="0" max="100" value="${track.volume}" oninput="changeTrackVolume(${idx}, this.value)">
          <span class="volume-value" id="vol-val-${idx}">${track.volume}</span>
        </div>
        <div class="track-controls">
          <button class="mute-solo-btn mute-btn ${track.muted ? 'active' : ''}" id="mute-${idx}" onclick="toggleTrackMute(${idx})">M</button>
          <button class="mute-solo-btn solo-btn ${track.soloed ? 'active' : ''}" id="solo-${idx}" onclick="toggleTrackSolo(${idx})">S</button>
        </div>
      </div>
    `;
    midiTracksContainer.appendChild(trackItem);
  });
  
  updateNoteBoard();
}

window.changeTrackVolume = function(trackIdx, val) {
  if (!sheetData) return;
  const track = sheetData.tracks[trackIdx];
  const volume = parseInt(val);
  track.volume = volume;
  
  const volValText = document.getElementById(`vol-val-${trackIdx}`);
  if (volValText) {
    volValText.textContent = volume;
  }
  
  // 만약 현재 재생 중이고 오디오 컨텍스트가 존재하면 실시간 게인 조절
  if (track.trackGainNode && audioCtx) {
    try {
      track.trackGainNode.gain.setTargetAtTime(volume / 100, audioCtx.currentTime, 0.01);
    } catch (e) {
      console.warn("게인 조절 실패:", e);
    }
  }
};

function updateNoteBoard() {
  if (!sheetData) return;
  
  noteBoardContainer.innerHTML = '';
  
  let allNotes = [];
  sheetData.tracks.forEach((track, trackIdx) => {
    if (track.muted) return;
    track.notes.forEach(note => {
      allNotes.push({
        trackName: track.name,
        trackIdx: trackIdx,
        ...note
      });
    });
  });
  
  allNotes.sort((a, b) => a.time - b.time);
  
  if (allNotes.length === 0) {
    noteBoardContainer.innerHTML = '<div style="padding: 1.5rem 0; text-align: center; color: var(--text-muted);">재생할 활성 노트가 없습니다.</div>';
    return;
  }
  
  allNotes.forEach(note => {
    const noteRow = document.createElement('div');
    noteRow.className = 'note-row';
    noteRow.dataset.time = note.time;
    noteRow.dataset.trackIdx = note.trackIdx;
    noteRow.innerHTML = `
      <span>[${note.trackName}] <span class="note-pitch">${note.pitch}</span></span>
      <span class="note-time">Start: ${note.time.toFixed(2)} Beat | Length: ${note.duration.toFixed(2)}</span>
    `;
    noteBoardContainer.appendChild(noteRow);
  });
}

window.toggleTrackMute = function(trackIdx) {
  if (!sheetData) return;
  const track = sheetData.tracks[trackIdx];
  track.muted = !track.muted;
  
  const muteBtn = document.getElementById(`mute-${trackIdx}`);
  if (track.muted) {
    muteBtn.classList.add('active');
  } else {
    muteBtn.classList.remove('active');
  }
  updateNoteBoard();
};

window.toggleTrackSolo = function(trackIdx) {
  if (!sheetData) return;
  const targetTrack = sheetData.tracks[trackIdx];
  targetTrack.soloed = !targetTrack.soloed;
  
  const hasAnySolo = sheetData.tracks.some(t => t.soloed);
  
  sheetData.tracks.forEach((track, idx) => {
    const soloBtn = document.getElementById(`solo-${idx}`);
    const muteBtn = document.getElementById(`mute-${idx}`);
    
    if (hasAnySolo) {
      track.muted = !track.soloed;
      if (track.muted) {
        muteBtn.classList.add('active');
      } else {
        muteBtn.classList.remove('active');
      }
    } else {
      track.muted = false;
      muteBtn.classList.remove('active');
    }
    
    if (track.soloed) {
      soloBtn.classList.add('active');
    } else {
      soloBtn.classList.remove('active');
    }
  });
  
  updateNoteBoard();
};

// ==========================================
// MIDI Synthesizer Live Playback Preview & Drum Synth
// ==========================================
function pitchToFreq(pitch) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const res = pitch.match(/^([A-G]#?|b?)(-?\d+)$/);
  if (!res) return 440;
  
  let key = res[1];
  if (key.startsWith('B') && key.endsWith('b')) key = 'A#';
  if (key.startsWith('E') && key.endsWith('b')) key = 'D#';
  if (key.startsWith('A') && key.endsWith('b')) key = 'G#';
  if (key.startsWith('G') && key.endsWith('b')) key = 'F#';
  if (key.startsWith('D') && key.endsWith('b')) key = 'C#';
  
  const octave = parseInt(res[2]);
  const index = notes.indexOf(key);
  
  const midiNote = 12 * (octave + 1) + index;
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Drum Sound Synthesizers (Web Audio API)
function playKick(ctx, time, duration, destinationNode) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(destinationNode);
  
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);
  
  gain.gain.setValueAtTime(0.35, time);
  gain.gain.linearRampToValueAtTime(0.35, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  
  osc.start(time);
  osc.stop(time + 0.16);
  
  activeTimeoutIds.push({ osc: osc, gain: gain });
}

function playSnare(ctx, time, duration, destinationNode) {
  const bufferSize = ctx.sampleRate * 0.2; // 0.2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(destinationNode);
  
  // Snare tone body
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.connect(oscGain);
  oscGain.connect(destinationNode);
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.linearRampToValueAtTime(100, time + 0.1);
  
  oscGain.gain.setValueAtTime(0.12, time);
  oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
  
  noise.start(time);
  noise.stop(time + 0.2);
  
  osc.start(time);
  osc.stop(time + 0.15);
  
  activeTimeoutIds.push({ osc: noise, gain: noiseGain });
  activeTimeoutIds.push({ osc: osc, gain: oscGain });
}

function playHihat(ctx, time, duration, destinationNode) {
  const bufferSize = ctx.sampleRate * 0.05; // 0.05 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7500;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destinationNode);
  
  noise.start(time);
  noise.stop(time + 0.05);
  
  activeTimeoutIds.push({ osc: noise, gain: gain });
}

function playMidiPreview() {
  if (!sheetData) {
    alert('로드된 악보 데이터가 없습니다. 데모를 로드하거나 AI 분석을 진행해 주세요.');
    return;
  }
  
  stopMidiPreview();
  
  const ctx = getAudioContext();
  const bpm = parseInt(bpmInput.value) || 120;
  const beatDuration = 60 / bpm;
  
  isPlayingMidi = true;
  midiStartTime = ctx.currentTime;
  btnMidiPlay.textContent = '⏸️ 일시 정지';
  
  // DynamicsCompressorNode를 메인 출력 직전에 생성하여 클리핑 방지 (오디오 포화 방지)
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-12, ctx.currentTime);
  compressor.knee.setValueAtTime(30, ctx.currentTime);
  compressor.ratio.setValueAtTime(8, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.08, ctx.currentTime);
  compressor.connect(ctx.destination);
  
  const noteRowEls = noteBoardContainer.querySelectorAll('.note-row');
  
  sheetData.tracks.forEach((track, trackIdx) => {
    // 트랙별 실시간 볼륨조절용 GainNode 생성 및 연결
    const trackGainNode = ctx.createGain();
    trackGainNode.gain.setValueAtTime(track.muted ? 0 : (track.volume / 100), ctx.currentTime);
    trackGainNode.connect(compressor);
    track.trackGainNode = trackGainNode;
    
    if (track.muted) return;
    
    const isDrum = track.instrument === 115 || track.name.toLowerCase().includes('drum');
    
    track.notes.forEach(note => {
      const startSec = note.time * beatDuration;
      const durSec = note.duration * beatDuration;
      const timeToPlay = midiStartTime + startSec;
      
      if (isDrum) {
        // 드럼 악기인 경우 드럼 합성 엔진으로 라우팅
        const pitchClean = note.pitch.toUpperCase();
        if (pitchClean.startsWith('C')) {
          playKick(ctx, timeToPlay, durSec, trackGainNode);
        } else if (pitchClean.startsWith('D')) {
          playSnare(ctx, timeToPlay, durSec, trackGainNode);
        } else {
          playHihat(ctx, timeToPlay, durSec, trackGainNode);
        }
      } else {
        // 일반 선율 악기인 경우 신디사이저 재생
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        if (trackIdx % 3 === 0) {
          osc.type = 'sine';
        } else if (trackIdx % 3 === 1) {
          osc.type = 'triangle';
        } else {
          osc.type = 'sawtooth';
        }
        
        const freq = pitchToFreq(note.pitch);
        osc.frequency.setValueAtTime(freq, timeToPlay);
        
        const baseGain = trackIdx % 3 === 2 ? 0.15 : 0.10;
        gainNode.gain.setValueAtTime(0, timeToPlay);
        gainNode.gain.linearRampToValueAtTime(baseGain, timeToPlay + 0.02);
        gainNode.gain.setValueAtTime(baseGain, timeToPlay + durSec - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, timeToPlay + durSec);
        
        osc.connect(gainNode);
        gainNode.connect(trackGainNode);
        
        osc.start(timeToPlay);
        osc.stop(timeToPlay + durSec);
        
        activeTimeoutIds.push({
          osc: osc,
          gain: gainNode
        });
      }
      
      const timeoutId = setTimeout(() => {
        noteRowEls.forEach(row => {
          if (parseFloat(row.dataset.time) === note.time && parseInt(row.dataset.trackIdx) === trackIdx) {
            row.classList.add('active');
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            if (parseFloat(row.dataset.time) < note.time) {
              row.classList.remove('active');
            }
          }
        });
      }, startSec * 1000);
      
      activeTimeoutIds.push({ timer: timeoutId });
    });
  });
  
  let maxDurationBeats = 0;
  sheetData.tracks.forEach(track => {
    track.notes.forEach(note => {
      const endBeat = note.time + note.duration;
      if (endBeat > maxDurationBeats) maxDurationBeats = endBeat;
    });
  });
  
  const totalPlaytimeSec = maxDurationBeats * beatDuration;
  const stopTimeoutId = setTimeout(() => {
    stopMidiPreview();
  }, totalPlaytimeSec * 1000 + 500);
  
  activeTimeoutIds.push({ timer: stopTimeoutId });
}

function stopMidiPreview() {
  isPlayingMidi = false;
  btnMidiPlay.textContent = '▶️ 재생 (Preview)';
  
  if (sheetData && sheetData.tracks) {
    sheetData.tracks.forEach(track => {
      if (track.trackGainNode) {
        try { track.trackGainNode.disconnect(); } catch(e) {}
        track.trackGainNode = null;
      }
    });
  }
  
  activeTimeoutIds.forEach(item => {
    if (item.osc) {
      try { item.osc.stop(); } catch(e) {}
    }
    if (item.timer) {
      clearTimeout(item.timer);
    }
  });
  activeTimeoutIds = [];
  
  const noteRowEls = noteBoardContainer.querySelectorAll('.note-row');
  noteRowEls.forEach(row => row.classList.remove('active'));
}

// ==========================================
// MIDI Writer & Multi-track Export (FL Studio)
// ==========================================
function downloadMidiFile() {
  if (!sheetData) {
    alert('내보낼 MIDI 데이터가 없습니다. 먼저 분석이나 데모를 로드해 주세요.');
    return;
  }
  
  try {
    if (typeof MidiWriter === 'undefined') {
      alert('MIDI 라이브러리를 로드하지 못했습니다. 인터넷 연결 상태를 점검해 주세요.');
      return;
    }
    
    const PPQ = 128;
    const bpm = parseInt(bpmInput.value) || 120;
    
    const writerTracks = [];
    
    sheetData.tracks.forEach((track, trackIdx) => {
      const mwTrack = new MidiWriter.Track();
      const isDrum = track.instrument === 115 || track.name.toLowerCase().includes('drum');
      const trackVolumeRatio = (typeof track.volume === 'number' ? track.volume : 80) / 100;
      
      mwTrack.addEvent(new MidiWriter.TrackNameEvent({ text: track.name }));
      mwTrack.addEvent(new MidiWriter.TempoEvent({ bpm: bpm }));
      mwTrack.addEvent(new MidiWriter.ProgramChangeEvent({ program: isDrum ? 0 : (track.instrument || 0) }));
      
      track.notes.forEach(note => {
        const ticksDuration = Math.round(note.duration * PPQ);
        const startTick = Math.round(note.time * PPQ);
        const finalVelocity = Math.round((note.velocity || 90) * trackVolumeRatio);
        
        const eventParams = {
          pitch: [note.pitch],
          duration: 't' + ticksDuration,
          startTick: startTick,
          velocity: Math.max(1, Math.min(127, finalVelocity))
        };
        
        if (isDrum) {
          eventParams.channel = 10;
        }
        
        const noteEvent = new MidiWriter.NoteEvent(eventParams);
        mwTrack.addEvent(noteEvent);
      });
      
      writerTracks.push(mwTrack);
    });
    
    const write = new MidiWriter.Writer(writerTracks);
    const midiBytes = write.buildFile();
    
    const blob = new Blob([midiBytes], { type: 'audio/midi' });
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `AI_MIDI_Bridge_${bpm}BPM.mid`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('MIDI 파일 다운로드 완료! FL Studio로 드래그 하세요.');
  } catch (err) {
    console.error(err);
    alert(`MIDI 생성 실패: ${err.message}`);
  }
}

// ==========================================
// Demo Data Loader (Melody/Chords/Bass ONLY)
// ==========================================
function loadDemoData() {
  const demoMusicData = {
    bpm: 125,
    timeSignature: "4/4",
    tracks: [
      {
        name: "Lead Melody",
        instrument: 81, // Synth Lead (Sawtooth)
        notes: [
          { pitch: "A4", time: 0.0, duration: 0.5, velocity: 100 },
          { pitch: "C5", time: 0.5, duration: 0.5, velocity: 100 },
          { pitch: "E5", time: 1.0, duration: 0.5, velocity: 100 },
          { pitch: "D5", time: 1.5, duration: 1.0, velocity: 105 },
          { pitch: "C5", time: 2.5, duration: 0.5, velocity: 90 },
          { pitch: "B4", time: 3.0, duration: 1.0, velocity: 95 },
          
          { pitch: "A4", time: 4.0, duration: 0.5, velocity: 100 },
          { pitch: "C5", time: 4.5, duration: 0.5, velocity: 100 },
          { pitch: "E5", time: 5.0, duration: 0.5, velocity: 100 },
          { pitch: "G5", time: 5.5, duration: 1.0, velocity: 110 },
          { pitch: "F5", time: 6.5, duration: 0.5, velocity: 90 },
          { pitch: "E5", time: 7.0, duration: 1.0, velocity: 95 }
        ]
      },
      {
        name: "Electric Chords",
        instrument: 4, // Rhodes/Synth Piano
        notes: [
          { pitch: "A3", time: 0.0, duration: 4.0, velocity: 80 },
          { pitch: "C4", time: 0.0, duration: 4.0, velocity: 80 },
          { pitch: "E4", time: 0.0, duration: 4.0, velocity: 80 },
          
          { pitch: "G3", time: 4.0, duration: 4.0, velocity: 80 },
          { pitch: "B3", time: 4.0, duration: 4.0, velocity: 80 },
          { pitch: "D4", time: 4.0, duration: 4.0, velocity: 80 }
        ]
      },
      {
        name: "Sub Bass",
        instrument: 38, // Synth Bass
        notes: [
          { pitch: "A2", time: 0.0, duration: 1.5, velocity: 110 },
          { pitch: "A2", time: 2.0, duration: 1.5, velocity: 100 },
          { pitch: "G2", time: 4.0, duration: 1.5, velocity: 110 },
          { pitch: "G2", time: 6.0, duration: 1.5, velocity: 100 }
        ]
      },
      {
        name: "Lo-Fi Drums",
        instrument: 115, // Drums
        notes: [
          // Kick Drum (C2)
          { pitch: "C2", time: 0.0, duration: 0.25, velocity: 110 },
          { pitch: "C2", time: 2.0, duration: 0.25, velocity: 100 },
          { pitch: "C2", time: 4.0, duration: 0.25, velocity: 110 },
          { pitch: "C2", time: 6.0, duration: 0.25, velocity: 100 },
          { pitch: "C2", time: 6.5, duration: 0.25, velocity: 95 }, // Double Kick!
          
          // Snare Drum (D2)
          { pitch: "D2", time: 1.0, duration: 0.25, velocity: 100 },
          { pitch: "D2", time: 3.0, duration: 0.25, velocity: 105 },
          { pitch: "D2", time: 5.0, duration: 0.25, velocity: 100 },
          { pitch: "D2", time: 7.0, duration: 0.25, velocity: 105 },
          
          // Closed Hi-hats (F#2) - 8th notes
          { pitch: "F#2", time: 0.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 0.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 1.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 1.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 2.0, duration: 0.25, velocity: 85 },
          { pitch: "F#2", time: 2.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 3.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 3.5, duration: 0.25, velocity: 75 },
          
          { pitch: "F#2", time: 4.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 4.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 5.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 5.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 6.0, duration: 0.25, velocity: 85 },
          { pitch: "F#2", time: 6.5, duration: 0.25, velocity: 70 },
          { pitch: "F#2", time: 7.0, duration: 0.25, velocity: 80 },
          { pitch: "F#2", time: 7.5, duration: 0.25, velocity: 75 }
        ]
      }
    ]
  };
  
  loadParsedMusicData(demoMusicData);
  showNotification('드럼 비트가 포함된 데모 곡이 로드되었습니다!');
}
