import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Check,
  Home,
  Lock,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

/* ── 상수 ──────────────────────────────────────────────────────────────── */

/* ── 시간 유틸 ──────────────────────────────────────────────────────────── */

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

const dailyPatterns = [
  { id: 'morning',    title: '아침, 하루를 시작하기 전',   time: '8–9시',    momentLabel: '아침, 하루를 시작하기 전',   momentDesc: '첫 번째 커피나 출근 전' },
  { id: 'work_start', title: '업무나 공부를 시작하기 전',  time: '9–10시',   momentLabel: '업무나 공부를 시작하기 전',  momentDesc: '본격적으로 집중하기 직전' },
  { id: 'meeting',    title: '회의나 발표가 있는 날 직전', time: '시간 유동', momentLabel: '회의나 발표 직전',           momentDesc: '머리를 정리하고 싶을 때' },
  { id: 'end_of_day', title: '하루를 마무리할 때',         time: '6–7시',    momentLabel: '하루를 마무리할 때',         momentDesc: '퇴근하거나 마지막 정리 전' },
  { id: 'bedtime',    title: '자기 전',                   time: '10–11시',  momentLabel: '자기 전',                    momentDesc: '하루를 돌아보며' },
];

const persist = (key, value) => {
  try { window.localStorage?.setItem(key, JSON.stringify(value)); } catch {}
};

const load = (key, fallback) => {
  try { return JSON.parse(window.localStorage?.getItem(key)) ?? fallback; } catch { return fallback; }
};

/* ── App ───────────────────────────────────────────────────────────────── */

function App() {
  // ── 플로우: splash → channel → pattern → recording → moment → home ──
  const [step, setStep]         = useState('splash');
  const [activeTab, setActiveTab] = useState('home');

  // 스플래시: 온보딩 완료 여부에 따라 분기
  useEffect(() => {
    if (step !== 'splash') return;
    const timer = setTimeout(() => {
      const channel  = load('meaari.reminderChannel', null);
      const patterns = load('meaari.patterns', []);
      const onboardingDone = channel !== null && patterns.length > 0;
      setStep(onboardingDone ? 'home' : 'channel');
    }, 2500);
    return () => clearTimeout(timer);
  }, [step]);

  // 온보딩 데이터
  const [selectedChannel, setSelectedChannel] = useState('widget');

  // 블록 스케줄 — localStorage에 저장된 값 우선, 없으면 defaultBlocks
  const [scheduleBlocks, setScheduleBlocks] = useState(() => load('meaari.patterns', defaultBlocks));
  const [editingId,    setEditingId]    = useState(null);
  const [editName,     setEditName]     = useState('');
  const [editTimeFrom, setEditTimeFrom] = useState('09:00');
  const [editTimeTo,   setEditTimeTo]   = useState('10:00');
  const [isAdding,     setIsAdding]     = useState(false);
  const [addName,      setAddName]      = useState('');
  const [addTimeFrom,  setAddTimeFrom]  = useState('09:00');
  const [addTimeTo,    setAddTimeTo]    = useState('10:00');

  // 기록 데이터
  const [quoteText,  setQuoteText]  = useState('');
  const [bookTitle,  setBookTitle]  = useState('');
  const [author,     setAuthor]     = useState('');
  const [savedQuote, setSavedQuote] = useState(null);
  const [selectedMoment, setSelectedMoment] = useState('');

  // 전체 기록 (홈에서 렌더링)
  const [quotes, setQuotes] = useState(() => load('meaari.quotes', []));

  // 카드 메뉴 / 인라인 수정
  const [activeCardMenu,  setActiveCardMenu]  = useState(null);
  const [editingCardId,   setEditingCardId]   = useState(null);
  const [editingCardText, setEditingCardText] = useState('');

  // ── 파생 값 ──────────────────────────────────────────────────
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

  // ── 핸들러 ──────────────────────────────────────────────────
  const handleChannelDone = () => {
    persist('meaari.reminderChannel', selectedChannel);
    setStep('pattern');
  };

  const handlePatternDone = () => {
    persist('meaari.patterns', scheduleBlocks);
    setStep('recording');
  };

  // 블록 편집
  const startEdit = (block) => {
    setEditingId(block.id);
    setEditName(block.name);
    setEditTimeFrom(block.timeFrom);
    setEditTimeTo(block.timeTo);
    setIsAdding(false);
  };
  const saveEdit = () => {
    if (!editName.trim()) return;
    setScheduleBlocks((prev) =>
      prev.map((b) =>
        b.id === editingId
          ? { ...b, name: editName.trim(), timeFrom: editTimeFrom, timeTo: editTimeTo }
          : b,
      ),
    );
    setEditingId(null);
  };
  const deleteBlock = (id) => {
    setScheduleBlocks((prev) => prev.filter((b) => b.id !== id));
    if (editingId === id) setEditingId(null);
  };
  const addBlock = () => {
    if (!addName.trim()) return;
    setScheduleBlocks((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name: addName.trim(), timeFrom: addTimeFrom, timeTo: addTimeTo },
    ]);
    setAddName('');
    setAddTimeFrom('09:00');
    setAddTimeTo('10:00');
    setIsAdding(false);
  };

  const handleSaveQuote = (e) => {
    e.preventDefault();
    if (!quoteText.trim()) return;
    const quote = {
      id: `quote-${Date.now()}`,
      quoteText: quoteText.trim(),
      bookTitle: bookTitle.trim(),
      author:    author.trim(),
      savedAt:   new Date().toISOString(),
    };
    setSavedQuote(quote);
    setStep('moment');
  };

  const handleMomentComplete = () => {
    if (!selectedMoment) return;
    const momentInfo = activeMomentCandidates.find((c) => c.id === selectedMoment);
    const finalQuote = {
      ...savedQuote,
      momentId:    selectedMoment,
      momentLabel: momentInfo?.title ?? '아직 모르겠어요',
      feedback:    null,
    };
    const updated = [finalQuote, ...quotes];
    setQuotes(updated);
    persist('meaari.quotes', updated);

    // 다음 기록을 위해 폼 초기화
    setQuoteText(''); setBookTitle(''); setAuthor('');
    setSavedQuote(null); setSelectedMoment('');
    setActiveTab('home');
    setStep('home');
  };

  const handleFeedback = (quoteId, value) => {
    const updated = quotes.map((q) =>
      q.id === quoteId ? { ...q, feedback: value } : q,
    );
    setQuotes(updated);
    persist('meaari.quotes', updated);
  };

  const startNewRecording = () => {
    setStep('recording');
    setActiveTab('home');
  };

  const deleteQuote = (id) => {
    const updated = quotes.filter((q) => q.id !== id);
    setQuotes(updated);
    persist('meaari.quotes', updated);
    setActiveCardMenu(null);
  };

  const startEditCard = (q) => {
    setEditingCardId(q.id);
    setEditingCardText(q.quoteText);
    setActiveCardMenu(null);
  };

  const saveEditCard = (id) => {
    if (!editingCardText.trim()) return;
    const updated = quotes.map((q) =>
      q.id === id ? { ...q, quoteText: editingCardText.trim() } : q,
    );
    setQuotes(updated);
    persist('meaari.quotes', updated);
    setEditingCardId(null);
  };

  /* ══════════════════════════════════════════════════════════════════════
     Screen 0 — 스플래시
  ══════════════════════════════════════════════════════════════════════ */
  if (step === 'splash') {
    return (
      <main className="app-shell">
        <section className="phone-frame splash-frame">
          <div className="splash-content">
            <div className="splash-hero">
              <h1>책에서 붙잡은 생각이<br />필요한 순간<br />다시 돌아와요</h1>
              <p className="hero-copy">책에서 붙잡은 문장이,<br />필요한 순간 다시 떠오르도록.</p>
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
  }

  /* ══════════════════════════════════════════════════════════════════════
     Screen 1 — 채널 선택 (첫 온보딩)
  ══════════════════════════════════════════════════════════════════════ */
  if (step === 'channel') {
    return (
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

          <section className="channel-section" aria-labelledby="channel-title">
            <div className="channel-list" role="radiogroup" aria-label="상기 채널 선택">
              {reminderChannels.map((channel) => {
                const Icon = channel.icon;
                const isSelected = selectedChannel === channel.id;
                return (
                  <button key={channel.id} className={`channel-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedChannel(channel.id)} role="radio" aria-checked={isSelected} type="button">
                    <span className="channel-icon"><Icon size={19} aria-hidden="true" /></span>
                    <span className="channel-text"><strong>{channel.title}</strong></span>
                    <span className="check-dot" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>

          {/* 채널별 미리보기 */}
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
  }

  /* ══════════════════════════════════════════════════════════════════════
     Screen 2 — 패턴 등록 (블록 스케줄링)
  ══════════════════════════════════════════════════════════════════════ */
  if (step === 'pattern') {
    const sorted = [...scheduleBlocks].sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
    return (
      <main className="app-shell">
        <section className="phone-frame onboarding-frame pattern-frame">
          <header className="onboarding-header">
            <button className="back-btn" onClick={() => setStep('channel')} type="button" aria-label="이전으로">
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <div className="onboarding-step-row">
              <span className="onboarding-step active" />
              <span className="onboarding-step active" />
            </div>
          </header>

          <div className="pattern-intro">
            <p className="eyebrow">처음 설정 2/2</p>
            <h1>내 하루 리듬을<br />알려주세요</h1>
            <p className="hero-copy" style={{ marginTop: 8 }}>
              메아리는 이 흐름을 기억해요.<br />정확할수록 문장이 더 맞는 순간에 찾아와요.
            </p>
          </div>

          <div className="block-list">
            {sorted.map((block) => (
              editingId === block.id ? (
                /* 편집 모드 */
                <div key={block.id} className="block-edit-card">
                  <input
                    className="block-edit-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="순간 이름"
                    autoFocus
                  />
                  <div className="block-edit-row">
                    <select
                      className="block-time-select"
                      value={editTimeFrom}
                      onChange={(e) => setEditTimeFrom(e.target.value)}
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    <span className="block-time-sep">~</span>
                    <select
                      className="block-time-select"
                      value={editTimeTo}
                      onChange={(e) => setEditTimeTo(e.target.value)}
                    >
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                    </select>
                    <button className="block-save-btn" onClick={saveEdit} type="button">저장</button>
                    <button className="block-icon-btn" onClick={() => setEditingId(null)} type="button" aria-label="취소">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                /* 표시 모드 */
                <div key={block.id} className="block-card">
                  <span className="block-time-chip">{formatRange(block.timeFrom, block.timeTo)}</span>
                  <span className="block-name">{block.name}</span>
                  <div className="block-actions">
                    <button className="block-icon-btn" onClick={() => startEdit(block)} type="button" aria-label="수정">
                      <Pencil size={14} />
                    </button>
                    <button className="block-icon-btn danger" onClick={() => deleteBlock(block.id)} type="button" aria-label="삭제">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            ))}

            {/* 추가 폼 */}
            {isAdding ? (
              <div className="block-edit-card adding">
                <input
                  className="block-edit-input"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="예: 점심 먹고 나서, 야간 근무 마치고…"
                  autoFocus
                />
                <div className="block-edit-row">
                  <select
                    className="block-time-select"
                    value={addTimeFrom}
                    onChange={(e) => setAddTimeFrom(e.target.value)}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <span className="block-time-sep">~</span>
                  <select
                    className="block-time-select"
                    value={addTimeTo}
                    onChange={(e) => setAddTimeTo(e.target.value)}
                  >
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <button className="block-save-btn" onClick={addBlock} type="button">추가</button>
                  <button className="block-icon-btn" onClick={() => setIsAdding(false)} type="button" aria-label="취소">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button className="block-add-btn" onClick={() => { setIsAdding(true); setEditingId(null); }} type="button">
                <Plus size={16} />
                순간 추가하기
              </button>
            )}
          </div>

          <button
            className="primary-action"
            disabled={scheduleBlocks.length === 0}
            onClick={handlePatternDone}
            type="button"
          >
            메아리에게 내 하루 알려주기
          </button>
        </section>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     Screen 3 — 문장 기록
  ══════════════════════════════════════════════════════════════════════ */
  if (step === 'recording') {
    const canSave = quoteText.trim().length > 0;
    const isReturn = quotes.length > 0; // 두 번째 이후 기록
    return (
      <main className="app-shell">
        <section className="phone-frame quote-screen">
          <header className="screen-header">
            <button className="back-btn"
              onClick={() => isReturn ? setStep('home') : setStep('pattern')} type="button" aria-label="이전으로">
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            {!isReturn && (
              <div className="header-step">
                <span className="step-dot active" /><span className="step-dot active" /><span className="step-dot active" />
              </div>
            )}
          </header>

          <header className="form-hero">
            <div className="brand-row">
              <img className="app-icon" src="/meaari-app-icon.png" alt="" />
              <p className="brand">메아리</p>
            </div>
            <div>
              <p className="eyebrow">{isReturn ? '새 기록' : '첫 기록'}</p>
              <h1>책에서 멈춘 생각을 남겨주세요.</h1>
            </div>
            <p className="hero-copy">문장만 적어도 괜찮아요. 책 정보는 나중에 채워도 돼요.</p>
          </header>

          <form className="quote-form" onSubmit={handleSaveQuote}>
            <label className="field-group quote-field">
              <span>문장</span>
              <textarea autoFocus placeholder="책에서 붙잡고 싶었던 문장을 적어주세요."
                value={quoteText} onChange={(e) => setQuoteText(e.target.value)} rows={5} />
            </label>
            <div className="book-row">
              <div className="cover-placeholder" aria-label="책 커버 placeholder"><span>cover</span></div>
              <div className="book-fields">
                <label className="field-group">
                  <span>책 제목</span>
                  <input placeholder="모든 것은 기록된다" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
                </label>
                <label className="field-group">
                  <span>저자</span>
                  <input placeholder="김신지" value={author} onChange={(e) => setAuthor(e.target.value)} />
                </label>
              </div>
            </div>
            <button className="primary-action" disabled={!canSave} type="submit">저장하기</button>
          </form>
        </section>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     Screen 4 — 필요할 순간 선택
  ══════════════════════════════════════════════════════════════════════ */
  if (step === 'moment') {
    return (
      <main className="app-shell">
        <section className="phone-frame compact quote-done">
          <div className="top-pill success">
            <Check size={16} aria-hidden="true" />
            <span>저장 완료</span>
          </div>

          <section className="saved-note" aria-label="저장된 문장">
            <p>방금 남긴 생각</p>
            <blockquote>{savedQuote.quoteText}</blockquote>
            {(savedQuote.bookTitle || savedQuote.author) && (
              <span>
                {savedQuote.bookTitle && `- 『${savedQuote.bookTitle}』`}
                {savedQuote.bookTitle && savedQuote.author && ', '}
                {!savedQuote.bookTitle && savedQuote.author && '- '}
                {savedQuote.author}
              </span>
            )}
          </section>

          <div className="next-note">
            <p className="eyebrow">다음 단계</p>
            <h1>이제 이 생각이 다시 올 순간을 고르면 돼요.</h1>
            <p>선택한 상기 채널은 <strong>{selectedLabel}</strong>이에요. 아래 후보 중 하나만 가볍게 골라주세요.</p>
          </div>

          <section className="moment-section" aria-label="필요한 순간 후보">
            {activeMomentCandidates.map((candidate) => {
              const isSelected = selectedMoment === candidate.id;
              return (
                <button key={candidate.id} className={`moment-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedMoment(candidate.id)} type="button">
                  <span>
                    <strong>{candidate.title}</strong>
                    <small>{candidate.description}</small>
                  </span>
                </button>
              );
            })}
            <button className={`moment-option quiet ${selectedMoment === 'unknown' ? 'selected' : ''}`}
              onClick={() => setSelectedMoment('unknown')} type="button">
              <span>
                <strong>아직 모르겠어요</strong>
                <small>나중에 더 가까운 순간을 찾아볼게요</small>
              </span>
            </button>
          </section>

          <button className="primary-action" disabled={!selectedMoment}
            onClick={handleMomentComplete} type="button">
            선택 완료
          </button>
        </section>
      </main>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     Screen 5 — 메인 홈
  ══════════════════════════════════════════════════════════════════════ */
  const todayQuote = quotes[0] ?? null;
  const recentQuotes = quotes.slice(1);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  const renderQuoteCard = (q, truncate = false) => {
    const isMenuOpen   = activeCardMenu  === q.id;
    const isEditing    = editingCardId   === q.id;
    return (
      <div key={q.id} className={`quote-card ${isMenuOpen ? 'menu-open' : ''}`}>
        {isEditing ? (
          /* 인라인 수정 모드 */
          <div className="card-edit-wrap">
            <textarea
              className="card-edit-textarea"
              value={editingCardText}
              onChange={(e) => setEditingCardText(e.target.value)}
              autoFocus
              rows={3}
            />
            <div className="card-edit-actions">
              <button className="card-edit-cancel" onClick={() => setEditingCardId(null)} type="button">취소</button>
              <button className="card-edit-save" onClick={() => saveEditCard(q.id)} type="button">저장</button>
            </div>
          </div>
        ) : (
          <>
            <div className="quote-card-top">
              <p className="quote-card-text">
                {truncate && q.quoteText.length > 60
                  ? q.quoteText.slice(0, 60) + '…'
                  : q.quoteText}
              </p>
              <button
                className="card-menu-btn"
                onClick={(e) => { e.stopPropagation(); setActiveCardMenu(isMenuOpen ? null : q.id); }}
                type="button"
                aria-label="더보기"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
            <div className="quote-card-meta">
              <span className="moment-chip small">{q.momentLabel}</span>
              <span className="card-date">{formatDate(q.savedAt)}</span>
            </div>
            {isMenuOpen && (
              <div className="card-menu" onClick={(e) => e.stopPropagation()}>
                <button className="card-menu-item" onClick={() => startEditCard(q)} type="button">
                  <Pencil size={14} /> 수정
                </button>
                <div className="card-menu-divider" />
                <button className="card-menu-item danger" onClick={() => deleteQuote(q.id)} type="button">
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderHome = () => (
    <div className="home-scroll" onClick={() => setActiveCardMenu(null)}>
      {/* 오늘의 문장 — 상기 카드 (PRD 핵심) */}
      {todayQuote ? (
        <section className="today-section">
          <div className="section-row">
            <p className="section-label">
              <Sparkles size={13} aria-hidden="true" />
              오늘의 문장
            </p>
            <span className="moment-chip">{todayQuote.momentLabel}</span>
          </div>

          <div className="reminder-card">
            <blockquote className="reminder-quote">{todayQuote.quoteText}</blockquote>
            {todayQuote.bookTitle && (
              <span className="reminder-source">- 『{todayQuote.bookTitle}』{todayQuote.author ? `, ${todayQuote.author}` : ''}</span>
            )}
            <p className="reminder-why">
              <strong>{todayQuote.momentLabel}</strong>에 이 문장이 찾아왔어요
            </p>

            {/* 피드백 버튼 (PRD 필수) */}
            {!todayQuote.feedback ? (
              <div className="feedback-section">
                <p className="feedback-prompt">이 문장, 지금 잘 왔나요?</p>
                <div className="feedback-row">
                  <button className="feedback-btn match"
                    onClick={() => handleFeedback(todayQuote.id, 'match')} type="button">
                    지금 딱 맞았어
                  </button>
                  <button className="feedback-btn miss"
                    onClick={() => handleFeedback(todayQuote.id, 'miss')} type="button">
                    문장은 좋은데 지금은 아냐
                  </button>
                  <button className="feedback-btn skip"
                    onClick={() => handleFeedback(todayQuote.id, 'skip')} type="button">
                    그냥 지나갈래
                  </button>
                </div>
              </div>
            ) : (
              <div className="feedback-done">
                <Check size={14} aria-hidden="true" />
                <span>
                  {todayQuote.feedback === 'match' && '지금 딱 맞았어요 ✓'}
                  {todayQuote.feedback === 'miss'  && '타이밍을 기억했어요'}
                  {todayQuote.feedback === 'skip'  && '넘겼어요'}
                </span>
              </div>
            )}
          </div>
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

      {/* 최근 기록 */}
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
        {/* 앱 헤더 */}
        <header className="app-header">
          <div className="brand-row">
            <img className="app-icon" src="/meaari-app-icon.png" alt="" />
            <p className="brand">메아리</p>
          </div>
        </header>

        {/* 탭 콘텐츠 */}
        {activeTab === 'home'    && renderHome()}
        {activeTab === 'collect' && renderCollect()}

        {/* 하단 탭 내비게이션 */}
        <nav className="bottom-nav" aria-label="하단 탭">
          <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')} type="button">
            <Home size={22} aria-hidden="true" />
            <span>홈</span>
          </button>

          <button className="nav-item nav-record" onClick={startNewRecording} type="button" aria-label="새 기록">
            <span className="nav-record-icon"><PenLine size={20} aria-hidden="true" /></span>
          </button>

          <button className={`nav-item ${activeTab === 'collect' ? 'active' : ''}`}
            onClick={() => setActiveTab('collect')} type="button">
            <BookOpen size={22} aria-hidden="true" />
            <span>모아보기</span>
          </button>
        </nav>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
