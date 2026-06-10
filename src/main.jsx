import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Camera,
  Check,
  Home,
  Lock,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  ScanLine,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

/* ── 시간 유틸 ──────────────────────────────────────────────── */
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});
const formatTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? '오전' : '오후';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour}:${String(m).padStart(2, '0')}`;
};
const formatRange = (from, to) => `${formatTime(from)} ~ ${formatTime(to)}`;

/* ── 기본 데이터 ────────────────────────────────────────────── */
const defaultBlocks = [
  { id: 'morning',    name: '아침, 하루를 시작하기 전',  timeFrom: '07:30', timeTo: '09:00' },
  { id: 'work_start', name: '업무나 공부를 시작하기 전', timeFrom: '09:00', timeTo: '10:00' },
  { id: 'meeting',    name: '회의나 발표 직전',          timeFrom: '10:00', timeTo: '11:30' },
  { id: 'end_of_day', name: '하루를 마무리할 때',        timeFrom: '17:30', timeTo: '19:00' },
  { id: 'bedtime',    name: '자기 전',                   timeFrom: '22:00', timeTo: '23:30' },
];

const reminderChannels = [
  { id: 'widget',     title: '위젯',    description: '홈 화면에서 다시 보기',  icon: Smartphone },
  { id: 'lockscreen', title: '잠금화면', description: '폰을 켤 때 마주치기',   icon: Lock },
  { id: 'push',       title: '앱푸시',  description: '알림으로 받기',          icon: Bell },
];

/* ── localStorage 헬퍼 ──────────────────────────────────────── */
const persist = (key, value) => {
  try { window.localStorage?.setItem(key, JSON.stringify(value)); } catch {}
};
const load = (key, fallback) => {
  try { return JSON.parse(window.localStorage?.getItem(key)) ?? fallback; } catch { return fallback; }
};

/* ── 파일 → base64 ──────────────────────────────────────────── */
const fileToBase64 = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

/* ══════════════════════════════════════════════════════════════
   App
══════════════════════════════════════════════════════════════ */
function App() {
  /* ── 플로우 ────────────────────────────────────────────────── */
  const [step, setStep]       = useState('splash');
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    if (step !== 'splash') return;
    const timer = setTimeout(() => {
      const channel  = load('meaari.reminderChannel', null);
      const patterns = load('meaari.patterns', []);
      setStep(channel !== null && patterns.length > 0 ? 'home' : 'channel');
    }, 2500);
    return () => clearTimeout(timer);
  }, [step]);

  /* ── 온보딩 ────────────────────────────────────────────────── */
  const [selectedChannel, setSelectedChannel] = useState('widget');
  const [scheduleBlocks, setScheduleBlocks]   = useState(() => load('meaari.patterns', defaultBlocks));
  const [editingId,    setEditingId]    = useState(null);
  const [editName,     setEditName]     = useState('');
  const [editTimeFrom, setEditTimeFrom] = useState('09:00');
  const [editTimeTo,   setEditTimeTo]   = useState('10:00');
  const [isAdding,     setIsAdding]     = useState(false);
  const [addName,      setAddName]      = useState('');
  const [addTimeFrom,  setAddTimeFrom]  = useState('09:00');
  const [addTimeTo,    setAddTimeTo]    = useState('10:00');

  /* ── 기록 데이터 ────────────────────────────────────────────── */
  const [quoteText,      setQuoteText]      = useState('');
  const [bookTitle,      setBookTitle]      = useState('');
  const [author,         setAuthor]         = useState('');
  const [bookCoverUrl,   setBookCoverUrl]   = useState(null); // base64
  const [savedQuote,     setSavedQuote]     = useState(null);
  const [selectedMoment, setSelectedMoment] = useState('');

  /* ── OCR 상태 ───────────────────────────────────────────────── */
  const [showOcrPanel,  setShowOcrPanel]  = useState(false);
  const [ocrStep,       setOcrStep]       = useState('idle'); // idle | processing | done | error
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState(null);
  const ocrInputRef     = useRef(null);
  const coverInputRef   = useRef(null);

  /* ── 책 자동완성 ─────────────────────────────────────────────── */
  const [showBookSuggestions, setShowBookSuggestions] = useState(false);

  /* ── 전체 기록 ──────────────────────────────────────────────── */
  const [quotes, setQuotes] = useState(() => load('meaari.quotes', []));

  /* ── 카드 메뉴 / 인라인 수정 ───────────────────────────────── */
  const [activeCardMenu,  setActiveCardMenu]  = useState(null);
  const [editingCardId,   setEditingCardId]   = useState(null);
  const [editingCardText, setEditingCardText] = useState('');

  /* ── 파생 값 ────────────────────────────────────────────────── */

  /* 등록된 책 목록 — quotes에서 중복 제거, 최신순 */
  const registeredBooks = useMemo(() => {
    const seen = new Set();
    const books = [];
    for (const q of quotes) {
      if (q.bookTitle && !seen.has(q.bookTitle)) {
        seen.add(q.bookTitle);
        books.push({ title: q.bookTitle, author: q.author || '', bookCoverUrl: q.bookCoverUrl || null });
      }
    }
    return books;
  }, [quotes]);

  /* 타이핑 중 자동완성 후보 — 부분 일치 (정확히 같은 건 제외) */
  const bookSuggestions = useMemo(() => {
    if (!bookTitle.trim()) return [];
    const q = bookTitle.trim().toLowerCase();
    return registeredBooks.filter(
      (b) => b.title.toLowerCase().includes(q) && b.title.toLowerCase() !== q
    );
  }, [registeredBooks, bookTitle]);

  const selectedLabel = useMemo(
    () => reminderChannels.find((c) => c.id === selectedChannel)?.title ?? '위젯',
    [selectedChannel],
  );
  const activeMomentCandidates = useMemo(
    () => [...scheduleBlocks]
      .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
      .map((b) => ({ id: b.id, title: b.name, description: formatRange(b.timeFrom, b.timeTo) })),
    [scheduleBlocks],
  );

  /* ── 온보딩 핸들러 ──────────────────────────────────────────── */
  const handleChannelDone = () => { persist('meaari.reminderChannel', selectedChannel); setStep('pattern'); };
  const handlePatternDone = () => { persist('meaari.patterns', scheduleBlocks); setStep('recording'); };

  const startEdit = (block) => { setEditingId(block.id); setEditName(block.name); setEditTimeFrom(block.timeFrom); setEditTimeTo(block.timeTo); setIsAdding(false); };
  const saveEdit  = () => {
    if (!editName.trim()) return;
    setScheduleBlocks((prev) => prev.map((b) => b.id === editingId ? { ...b, name: editName.trim(), timeFrom: editTimeFrom, timeTo: editTimeTo } : b));
    setEditingId(null);
  };
  const deleteBlock = (id) => { setScheduleBlocks((prev) => prev.filter((b) => b.id !== id)); if (editingId === id) setEditingId(null); };
  const addBlock = () => {
    if (!addName.trim()) return;
    setScheduleBlocks((prev) => [...prev, { id: `custom-${Date.now()}`, name: addName.trim(), timeFrom: addTimeFrom, timeTo: addTimeTo }]);
    setAddName(''); setAddTimeFrom('09:00'); setAddTimeTo('10:00'); setIsAdding(false);
  };

  /* ── OCR 핸들러 ─────────────────────────────────────────────── */
  const handleOcrCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOcrPreviewUrl(url);
    setOcrStep('processing');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['kor', 'eng']);
      const { data: { text } } = await worker.recognize(url);
      await worker.terminate();
      const cleaned = text.trim().replace(/\n+/g, ' ');
      setQuoteText(cleaned);
      setOcrStep('done');
    } catch {
      setOcrStep('error');
    }
    // input 초기화 (같은 파일 재선택 가능하게)
    if (ocrInputRef.current) ocrInputRef.current.value = '';
  };

  const resetOcr = () => {
    setOcrStep('idle');
    setOcrPreviewUrl(null);
    if (ocrInputRef.current) ocrInputRef.current.value = '';
  };

  /* ── 북커버 핸들러 ──────────────────────────────────────────── */
  const handleBookCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setBookCoverUrl(base64);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  /* ── 저장 핸들러 ────────────────────────────────────────────── */
  const handleSaveQuote = (e) => {
    e.preventDefault();
    if (!quoteText.trim()) return;
    const quote = {
      id: `quote-${Date.now()}`,
      quoteText: quoteText.trim(),
      bookTitle: bookTitle.trim(),
      author:    author.trim(),
      bookCoverUrl: bookCoverUrl,  // base64 — 새로고침 후에도 유지
      savedAt:   new Date().toISOString(),
    };
    setSavedQuote(quote);
    setStep('moment');
  };

  const handleMomentComplete = () => {
    if (!selectedMoment) return;
    const momentInfo = activeMomentCandidates.find((c) => c.id === selectedMoment);
    const finalQuote = { ...savedQuote, momentId: selectedMoment, momentLabel: momentInfo?.title ?? '아직 모르겠어요', feedback: null };
    const updated = [finalQuote, ...quotes];
    setQuotes(updated);
    persist('meaari.quotes', updated);
    setQuoteText(''); setBookTitle(''); setAuthor(''); setBookCoverUrl(null);
    setSavedQuote(null); setSelectedMoment('');
    setShowOcrPanel(false); setOcrStep('idle'); setOcrPreviewUrl(null);
    setShowBookSuggestions(false);
    setActiveTab('home'); setStep('home');
  };

  const handleFeedback = (quoteId, value) => {
    const updated = quotes.map((q) => q.id === quoteId ? { ...q, feedback: value } : q);
    setQuotes(updated); persist('meaari.quotes', updated);
  };

  /* ── 책 선택 핸들러 ─────────────────────────────────────────── */
  /* 칩·드롭다운에서 선택 시 — 제목+저자+커버 한번에 채움 */
  const selectBook = (book) => {
    setBookTitle(book.title);
    setAuthor(book.author || '');
    setBookCoverUrl(book.bookCoverUrl || null);
    setShowBookSuggestions(false);
  };

  /* 제목 타이핑 핸들러 — 정확히 일치하면 자동 동기화 */
  const handleBookTitleChange = (val) => {
    setBookTitle(val);
    if (val.trim()) {
      const exact = registeredBooks.find(
        (b) => b.title.toLowerCase() === val.trim().toLowerCase()
      );
      if (exact) {
        setAuthor(exact.author || '');
        setBookCoverUrl(exact.bookCoverUrl || null);
        setShowBookSuggestions(false);
        return;
      }
    }
    setShowBookSuggestions(val.length > 0);
  };

  const startNewRecording = () => {
    setStep('recording'); setActiveTab('home');
    setShowOcrPanel(false); setOcrStep('idle'); setOcrPreviewUrl(null);
    setShowBookSuggestions(false);
  };

  const deleteQuote = (id) => {
    const updated = quotes.filter((q) => q.id !== id);
    setQuotes(updated); persist('meaari.quotes', updated); setActiveCardMenu(null);
  };
  const startEditCard = (q) => { setEditingCardId(q.id); setEditingCardText(q.quoteText); setActiveCardMenu(null); };
  const saveEditCard = (id) => {
    if (!editingCardText.trim()) return;
    const updated = quotes.map((q) => q.id === id ? { ...q, quoteText: editingCardText.trim() } : q);
    setQuotes(updated); persist('meaari.quotes', updated); setEditingCardId(null);
  };

  /* ══════════════════════════════════════════════════════════════
     Screen 0 — 스플래시
  ══════════════════════════════════════════════════════════════ */
  if (step === 'splash') return (
    <main className="app-shell">
      <section className="phone-frame splash-frame">
        <div className="splash-content">
          <div className="splash-hero">
            <h1>책에서 붙잡은 생각이<br />필요한 순간<br />다시 돌아와요</h1>
            <p className="hero-copy">문장이 다시 돌아올 위치를,<br />기록지 위에 함께 표시해요.</p>
          </div>
          <div className="brand-row splash-brand">
            <img className="app-icon splash-icon" src="/meaari-app-icon.png" alt="" />
            <p className="brand">메아리</p>
          </div>
        </div>
        <div className="splash-loader">
          <span className="splash-dot" /><span className="splash-dot" /><span className="splash-dot" />
        </div>
      </section>
    </main>
  );

  /* ══════════════════════════════════════════════════════════════
     Screen 1 — 채널 선택
  ══════════════════════════════════════════════════════════════ */
  if (step === 'channel') return (
    <main className="app-shell">
      <section className="phone-frame onboarding-frame">
        <header className="onboarding-header">
          <div className="brand-row">
            <img className="app-icon" src="/meaari-app-icon.png" alt="" />
            <p className="brand">메아리</p>
          </div>
          <div className="onboarding-step-row">
            <span className="onboarding-step active" />
            <span className="onboarding-step" />
          </div>
        </header>

        <div className="onboarding-title">
          <p className="eyebrow">처음 설정 1/2</p>
          <h1>어디에서<br />다시 만나면 좋을까요?</h1>
          <p className="hero-copy">먼저 한 가지 방식을 골라주세요.<br />나머지는 나중에 설정에서 추가할 수 있어요.</p>
        </div>

        <section className="channel-section">
          <div className="channel-list" role="radiogroup">
            {reminderChannels.map((channel) => {
              const Icon = channel.icon;
              const isSelected = selectedChannel === channel.id;
              return (
                <button key={channel.id} className={`channel-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedChannel(channel.id)} role="radio" aria-checked={isSelected} type="button">
                  <span className="channel-icon"><Icon size={18} /></span>
                  <span className="channel-text"><strong>{channel.title}</strong></span>
                  <span className="check-dot" />
                </button>
              );
            })}
          </div>
        </section>

        {/* 채널 미리보기 */}
        <div className="channel-preview-wrap">
          <p className="channel-preview-label">이렇게 보여요</p>
          {selectedChannel === 'widget' && (
            <div className="ch-preview widget-preview">
              <div className="widget-mock">
                <div className="widget-mock-header">
                  <img className="widget-app-icon" src="/meaari-app-icon.png" alt="" />
                  <span>메아리</span>
                </div>
                <blockquote className="widget-mock-quote">"기억은 흐려지고,<br />기록은 남는다"</blockquote>
                <span className="widget-mock-source">— 『모든 것은 기록된다』</span>
              </div>
              <p className="ch-preview-desc">홈 화면 위젯으로 문장을 꺼내드려요</p>
            </div>
          )}
          {selectedChannel === 'lockscreen' && (
            <div className="ch-preview lockscreen-preview">
              <div className="lockscreen-mock">
                <div className="ls-time">9:41</div>
                <div className="ls-date">월요일, 5월 25일</div>
                <div className="ls-divider" />
                <blockquote className="ls-quote">"기억은 흐려지고,<br />기록은 남는다"</blockquote>
                <span className="ls-source">— 『모든 것은 기록된다』</span>
              </div>
              <p className="ch-preview-desc">폰을 켤 때마다 문장과 마주쳐요</p>
            </div>
          )}
          {selectedChannel === 'push' && (
            <div className="ch-preview push-preview">
              <div className="push-mock">
                <div className="push-mock-inner">
                  <img className="widget-app-icon" src="/meaari-app-icon.png" alt="" />
                  <div className="push-text">
                    <span className="push-app-name">메아리</span>
                    <p className="push-body">"기억은 흐려지고, 기록은 남는다"</p>
                  </div>
                  <span className="push-time">지금</span>
                </div>
              </div>
              <p className="ch-preview-desc">필요한 순간, 알림으로 문장이 찾아와요</p>
            </div>
          )}
        </div>

        <button className="primary-action" onClick={handleChannelDone} type="button">다음</button>
      </section>
    </main>
  );

  /* ══════════════════════════════════════════════════════════════
     Screen 2 — 패턴 등록
  ══════════════════════════════════════════════════════════════ */
  if (step === 'pattern') {
    const sorted = [...scheduleBlocks].sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
    return (
      <main className="app-shell">
        <section className="phone-frame onboarding-frame pattern-frame">
          <header className="onboarding-header">
            <button className="back-btn" onClick={() => setStep('channel')} type="button" aria-label="이전으로">
              <ArrowLeft size={20} />
            </button>
            <div className="onboarding-step-row">
              <span className="onboarding-step active" />
              <span className="onboarding-step active" />
            </div>
          </header>

          <div className="pattern-intro">
            <p className="eyebrow">처음 설정 2/2</p>
            <h1>내 하루 리듬을<br />알려주세요</h1>
            <p className="hero-copy" style={{ marginTop: 6 }}>정확할수록 문장이 더 맞는 순간에 찾아와요.</p>
          </div>

          <div className="block-list">
            {sorted.map((block) => (
              editingId === block.id ? (
                <div key={block.id} className="block-edit-card">
                  <input className="block-edit-input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="순간 이름" autoFocus />
                  <div className="block-edit-row">
                    <select className="block-time-select" value={editTimeFrom} onChange={(e) => setEditTimeFrom(e.target.value)}>
                      {timeOptions.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                    </select>
                    <span className="block-time-sep">~</span>
                    <select className="block-time-select" value={editTimeTo} onChange={(e) => setEditTimeTo(e.target.value)}>
                      {timeOptions.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                    </select>
                    <button className="block-save-btn" onClick={saveEdit} type="button">저장</button>
                    <button className="block-icon-btn" onClick={() => setEditingId(null)} type="button"><X size={14} /></button>
                  </div>
                </div>
              ) : (
                <div key={block.id} className="block-card">
                  <span className="block-time-chip">{formatRange(block.timeFrom, block.timeTo)}</span>
                  <span className="block-name">{block.name}</span>
                  <div className="block-actions">
                    <button className="block-icon-btn" onClick={() => startEdit(block)} type="button"><Pencil size={13} /></button>
                    <button className="block-icon-btn danger" onClick={() => deleteBlock(block.id)} type="button"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            ))}

            {isAdding ? (
              <div className="block-edit-card adding">
                <input className="block-edit-input" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="예: 점심 먹고 나서, 야간 근무 마치고…" autoFocus />
                <div className="block-edit-row">
                  <select className="block-time-select" value={addTimeFrom} onChange={(e) => setAddTimeFrom(e.target.value)}>
                    {timeOptions.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                  </select>
                  <span className="block-time-sep">~</span>
                  <select className="block-time-select" value={addTimeTo} onChange={(e) => setAddTimeTo(e.target.value)}>
                    {timeOptions.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                  </select>
                  <button className="block-save-btn" onClick={addBlock} type="button">추가</button>
                  <button className="block-icon-btn" onClick={() => setIsAdding(false)} type="button"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <button className="block-add-btn" onClick={() => { setIsAdding(true); setEditingId(null); }} type="button">
                <Plus size={15} /> 순간 추가하기
              </button>
            )}
          </div>

          <button className="primary-action" disabled={scheduleBlocks.length === 0} onClick={handlePatternDone} type="button">
            메아리에게 내 하루 알려주기
          </button>
        </section>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Screen 3 — 문장 기록 (직접입력 + OCR + 북커버 사진)
  ══════════════════════════════════════════════════════════════ */
  if (step === 'recording') {
    const canSave  = quoteText.trim().length > 0;
    const isReturn = quotes.length > 0;

    return (
      <main className="app-shell">
        <section className="phone-frame quote-screen">
          {/* 헤더 */}
          <header className="screen-header">
            <button className="back-btn" onClick={() => isReturn ? setStep('home') : setStep('pattern')} type="button">
              <ArrowLeft size={20} />
            </button>
            {!isReturn && (
              <div className="header-step">
                <span className="step-dot active" /><span className="step-dot active" /><span className="step-dot active" />
              </div>
            )}
          </header>

          {/* 히어로 */}
          <header className="form-hero">
            <div className="brand-row">
              <img className="app-icon" src="/meaari-app-icon.png" alt="" />
              <p className="brand">메아리</p>
            </div>
            <div>
              <p className="eyebrow">{isReturn ? '새 기록' : '첫 기록'}</p>
              <h1>책에서 멈춘 생각을<br />남겨주세요.</h1>
            </div>
          </header>

          {/* 폼 */}
          <form className="quote-form" onSubmit={handleSaveQuote}>

            {/* ── 문장 입력 + OCR 토글 ── */}
            <div className="quote-field-wrap">
              <div className="field-label-row">
                <span className="field-label">문장</span>
                <button
                  className={`ocr-toggle-btn ${showOcrPanel ? 'active' : ''}`}
                  onClick={() => { setShowOcrPanel((v) => !v); if (showOcrPanel) resetOcr(); }}
                  type="button"
                >
                  <ScanLine size={13} />
                  사진으로 인식
                </button>
              </div>

              {/* OCR 패널 */}
              {showOcrPanel && (
                <div className="ocr-panel">
                  {ocrStep === 'idle' && (
                    <label className="ocr-zone">
                      <input
                        ref={ocrInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="ocr-file-input"
                        onChange={handleOcrCapture}
                      />
                      <ScanLine size={22} color="var(--grid-blue)" />
                      <span className="ocr-zone-label">
                        책 페이지를 촬영하거나<br />갤러리에서 선택하세요
                      </span>
                    </label>
                  )}

                  {ocrStep === 'processing' && (
                    <div className="ocr-zone has-preview">
                      {ocrPreviewUrl && <img src={ocrPreviewUrl} className="ocr-preview-img" alt="" />}
                      <div className="ocr-loading">
                        <span className="ocr-spinner" />
                        문장을 인식하는 중이에요…
                      </div>
                    </div>
                  )}

                  {ocrStep === 'done' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <p className="ocr-result-note">
                        <Check size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        인식 완료. 아래에서 확인하세요.
                      </p>
                      <button onClick={resetOcr} className="ocr-retry-btn" type="button">
                        <RotateCcw size={12} /> 다시
                      </button>
                    </div>
                  )}

                  {ocrStep === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <p className="ocr-error-note">인식 실패. 직접 입력하거나 다시 시도해 주세요.</p>
                      <button onClick={resetOcr} className="ocr-retry-btn" type="button">
                        <RotateCcw size={12} /> 다시
                      </button>
                    </div>
                  )}
                </div>
              )}

              <label className="field-group quote-field">
                <textarea
                  autoFocus={!showOcrPanel}
                  placeholder="책에서 붙잡고 싶었던 문장을 적어주세요."
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  rows={5}
                />
              </label>
            </div>

            {/* ── 책 정보 ── */}
            <div className="book-section">
              <span className="field-label">책</span>

              {/* 제목 입력 + 자동완성 드롭다운 */}
              <div className="book-title-wrap">
                <label className="field-group">
                  <span>책 제목</span>
                  <input
                    placeholder="모든 것은 기록된다"
                    value={bookTitle}
                    onChange={(e) => handleBookTitleChange(e.target.value)}
                    onFocus={() => bookTitle.length > 0 && setShowBookSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBookSuggestions(false), 150)}
                    autoComplete="off"
                  />
                </label>
                {showBookSuggestions && bookSuggestions.length > 0 && (
                  <div className="book-suggestions-dropdown">
                    {bookSuggestions.map((book) => (
                      <button
                        key={book.title}
                        className="book-suggestion-item"
                        onMouseDown={() => selectBook(book)}
                        type="button"
                      >
                        {book.bookCoverUrl
                          ? <img src={book.bookCoverUrl} className="book-chip-thumb" alt="" />
                          : <div className="book-chip-thumb book-chip-thumb--empty"><BookOpen size={12} /></div>
                        }
                        <div className="book-suggestion-item-info">
                          <span className="book-suggestion-title">{book.title}</span>
                          {book.author && <span className="book-suggestion-author">{book.author}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 저자 */}
              <label className="field-group">
                <span>저자</span>
                <input placeholder="김신지" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </label>

              {/* 북커버 업로드 (컴팩트) */}
              <label className="cover-upload-compact">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleBookCoverChange}
                />
                {bookCoverUrl ? (
                  <div className="cover-compact-preview">
                    <img src={bookCoverUrl} className="cover-compact-thumb" alt="책 커버" />
                    <span className="cover-compact-change">커버 변경</span>
                  </div>
                ) : (
                  <div className="cover-compact-placeholder">
                    <Camera size={14} />
                    <span>커버 사진 추가</span>
                  </div>
                )}
              </label>

              {/* 최근 읽은 책 칩 (최신순 왼쪽) */}
              {registeredBooks.length > 0 && (
                <div className="book-recent-section">
                  <span className="book-recent-label">최근 읽은 책</span>
                  <div className="book-chips-row">
                    {registeredBooks.map((book) => (
                      <button key={book.title} className="book-chip" onClick={() => selectBook(book)} type="button">
                        {book.bookCoverUrl
                          ? <img src={book.bookCoverUrl} className="book-chip-thumb" alt="" />
                          : <div className="book-chip-thumb book-chip-thumb--empty"><BookOpen size={12} /></div>
                        }
                        <span className="book-chip-title">{book.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="primary-action" disabled={!canSave} type="submit">저장하기</button>
          </form>
        </section>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Screen 4 — 필요할 순간 선택
  ══════════════════════════════════════════════════════════════ */
  if (step === 'moment') return (
    <main className="app-shell">
      <section className="phone-frame compact quote-done">
        <div className="top-pill success">
          <Check size={14} />
          <span>저장 완료</span>
        </div>

        <section className="saved-note" aria-label="저장된 문장">
          {savedQuote?.bookCoverUrl && (
            <img src={savedQuote.bookCoverUrl} className="saved-note-photo" alt="" />
          )}
          <p>방금 남긴 생각</p>
          <blockquote>{savedQuote?.quoteText}</blockquote>
          {(savedQuote?.bookTitle || savedQuote?.author) && (
            <span>
              {savedQuote.bookTitle && `— 『${savedQuote.bookTitle}』`}
              {savedQuote.bookTitle && savedQuote.author && ', '}
              {!savedQuote.bookTitle && savedQuote.author && '— '}
              {savedQuote.author}
            </span>
          )}
        </section>

        <div className="next-note">
          <p className="eyebrow">다음 단계</p>
          <h1>이 생각이 다시 올<br />순간을 고르면 돼요.</h1>
          <p>선택한 상기 채널은 <strong>{selectedLabel}</strong>이에요.</p>
        </div>

        <section className="moment-section">
          {activeMomentCandidates.map((candidate) => (
            <button key={candidate.id} className={`moment-option ${selectedMoment === candidate.id ? 'selected' : ''}`}
              onClick={() => setSelectedMoment(candidate.id)} type="button">
              <span>
                <strong>{candidate.title}</strong>
                <small>{candidate.description}</small>
              </span>
            </button>
          ))}
          <button className={`moment-option quiet ${selectedMoment === 'unknown' ? 'selected' : ''}`}
            onClick={() => setSelectedMoment('unknown')} type="button">
            <span>
              <strong>아직 모르겠어요</strong>
              <small>나중에 더 가까운 순간을 찾아볼게요</small>
            </span>
          </button>
        </section>

        <button className="primary-action" disabled={!selectedMoment} onClick={handleMomentComplete} type="button">
          선택 완료
        </button>
      </section>
    </main>
  );

  /* ══════════════════════════════════════════════════════════════
     Screen 5 — 메인 홈
  ══════════════════════════════════════════════════════════════ */
  const todayQuote  = quotes[0] ?? null;
  const recentQuotes = quotes.slice(1);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  const renderQuoteCard = (q, truncate = false) => {
    const isMenuOpen = activeCardMenu === q.id;
    const isEditing  = editingCardId  === q.id;
    return (
      <div key={q.id} className={`quote-card ${isMenuOpen ? 'menu-open' : ''}`}>
        {/* 북커버 사진 */}
        {q.bookCoverUrl && (
          <img src={q.bookCoverUrl} className="quote-card-photo" alt="" />
        )}

        {isEditing ? (
          <div className="card-edit-wrap">
            <textarea className="card-edit-textarea" value={editingCardText}
              onChange={(e) => setEditingCardText(e.target.value)} autoFocus rows={3} />
            <div className="card-edit-actions">
              <button className="card-edit-cancel" onClick={() => setEditingCardId(null)} type="button">취소</button>
              <button className="card-edit-save"   onClick={() => saveEditCard(q.id)} type="button">저장</button>
            </div>
          </div>
        ) : (
          <div className="quote-card-body">
            <div className="quote-card-top">
              <p className="quote-card-text">
                {truncate && q.quoteText.length > 60 ? q.quoteText.slice(0, 60) + '…' : q.quoteText}
              </p>
              <button className="card-menu-btn"
                onClick={(e) => { e.stopPropagation(); setActiveCardMenu(isMenuOpen ? null : q.id); }}
                type="button">
                <MoreHorizontal size={15} />
              </button>
            </div>
            <div className="quote-card-meta">
              <span className="moment-chip small">{q.momentLabel}</span>
              <span className="card-date">{formatDate(q.savedAt)}</span>
            </div>
            {isMenuOpen && (
              <div className="card-menu" onClick={(e) => e.stopPropagation()}>
                <button className="card-menu-item" onClick={() => startEditCard(q)} type="button">
                  <Pencil size={13} /> 수정
                </button>
                <div className="card-menu-divider" />
                <button className="card-menu-item danger" onClick={() => deleteQuote(q.id)} type="button">
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderHome = () => (
    <div className="home-scroll" onClick={() => setActiveCardMenu(null)}>
      {todayQuote ? (
        <section className="today-section">
          <div className="section-row">
            <p className="section-label"><Sparkles size={12} /> 오늘의 문장</p>
            <span className="moment-chip">{todayQuote.momentLabel}</span>
          </div>

          <div className="reminder-card">
            {/* 북커버 사진 — 2:3 세로형 썸네일 (왼쪽) */}
            {todayQuote.bookCoverUrl && (
              <img src={todayQuote.bookCoverUrl} className="reminder-card-photo" alt="" />
            )}
            {/* 내용 래퍼 — 사진 오른쪽 */}
            <div className="reminder-card-body">
            <blockquote className="reminder-quote">{todayQuote.quoteText}</blockquote>
            {todayQuote.bookTitle && (
              <span className="reminder-source">— 『{todayQuote.bookTitle}』{todayQuote.author ? `, ${todayQuote.author}` : ''}</span>
            )}
            <p className="reminder-why">
              <strong>{todayQuote.momentLabel}</strong>에 이 문장이 찾아왔어요
            </p>

            {!todayQuote.feedback ? (
              <div className="feedback-section">
                <p className="feedback-prompt">이 문장, 지금 잘 왔나요?</p>
                <div className="feedback-row">
                  <button className="feedback-btn match" onClick={() => handleFeedback(todayQuote.id, 'match')} type="button">지금 딱 맞았어</button>
                  <button className="feedback-btn miss"  onClick={() => handleFeedback(todayQuote.id, 'miss')}  type="button">문장은 좋은데 지금은 아냐</button>
                  <button className="feedback-btn skip"  onClick={() => handleFeedback(todayQuote.id, 'skip')}  type="button">그냥 지나갈래</button>
                </div>
              </div>
            ) : (
              <div className="feedback-done">
                <Check size={13} />
                <span>
                  {todayQuote.feedback === 'match' && '지금 딱 맞았어요'}
                  {todayQuote.feedback === 'miss'  && '타이밍을 기억했어요'}
                  {todayQuote.feedback === 'skip'  && '넘겼어요'}
                </span>
              </div>
            )}
            </div>{/* /reminder-card-body */}
          </div>{/* /reminder-card */}
        </section>
      ) : (
        <div className="empty-home">
          <p className="empty-title">아직 기록된 문장이 없어요</p>
          <p className="empty-sub">첫 번째 문장을 남겨보세요</p>
          <button className="primary-action" style={{ marginTop: 20 }} onClick={startNewRecording} type="button">
            문장 기록하기
          </button>
        </div>
      )}

      {recentQuotes.length > 0 && (
        <section className="recent-section">
          <p className="section-label">최근 기록</p>
          {recentQuotes.map((q) => renderQuoteCard(q, true))}
        </section>
      )}
    </div>
  );

  const renderCollect = () => (
    <div className="home-scroll" onClick={() => setActiveCardMenu(null)}>
      <section className="recent-section">
        <p className="section-label">모아보기</p>
        {quotes.length === 0 ? (
          <p className="empty-sub" style={{ padding: '20px 0' }}>기록된 문장이 없어요</p>
        ) : (
          quotes.map((q) => renderQuoteCard(q, false))
        )}
      </section>
    </div>
  );

  return (
    <main className="app-shell">
      <section className="phone-frame home-frame">
        <header className="app-header">
          <div className="brand-row">
            <img className="app-icon" src="/meaari-app-icon.png" alt="" />
            <p className="brand">메아리</p>
          </div>
        </header>

        {activeTab === 'home'    && renderHome()}
        {activeTab === 'collect' && renderCollect()}

        <nav className="bottom-nav">
          <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')} type="button">
            <Home size={20} /><span>홈</span>
          </button>
          <button className="nav-item nav-record" onClick={startNewRecording} type="button">
            <span className="nav-record-icon"><PenLine size={19} /></span>
          </button>
          <button className={`nav-item ${activeTab === 'collect' ? 'active' : ''}`}
            onClick={() => setActiveTab('collect')} type="button">
            <BookOpen size={20} /><span>모아보기</span>
          </button>
        </nav>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
