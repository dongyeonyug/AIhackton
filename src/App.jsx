import { useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";

const slots = Array.from({ length: 6 }, (_, index) => `slot-${index + 1}`);

const cn = (...names) => names.filter(Boolean).map((name) => styles[name]).join(" ");

const personalityMap = {
  "엄격형": {
    opener: "기본 개념을 피해 가면 감점이다.",
    hint: "정의, 조건, 반례를 순서대로 정리하게.",
    entrance: "시간 맞춰 왔군. 좋아, 오늘은 자네의 준비 상태를 확인하겠다.",
    praise: "흠. 답변은 군더더기가 없었다. 신뢰도가 오를 만하군."
  },
  "츤데레": {
    opener: "딱히 자네를 위해 말하는 건 아니지만, 이건 중요하다.",
    hint: "헷갈리는 부분만 따로 표시해두면 시험장에서 덜 흔들릴 거다.",
    entrance: "왔어? 딱히 기다린 건 아닌데, 마침 질문하려던 참이야.",
    praise: "뭐, 나쁘진 않네. 이 정도면 힌트 하나쯤은 줄 수도 있고."
  },
  "연구자": {
    opener: "이 주제는 가정과 한계를 같이 봐야 한다.",
    hint: "왜 그런 결과가 나오는지 실험 설계 관점에서 설명해보게.",
    entrance: "좋습니다. 오늘은 자료의 가정, 방법, 한계를 함께 검토해보죠.",
    praise: "흥미로운 관찰입니다. 그 답변은 연구 질문으로 확장할 수 있겠군요."
  },
  "열정형": {
    opener: "좋다, 지금 흐름을 잡으면 시험장에서 강해진다!",
    hint: "핵심 키워드를 손으로 다시 쓰고 바로 문제로 연결해보자.",
    entrance: "좋아! 연구실 입장 완료! 지금부터 시험 대비 모드다!",
    praise: "완벽해! 이 기세면 과제도 시험도 같이 잡을 수 있다!"
  },
  "방임형": {
    opener: "음... 알아서 해도 되는데, 그래도 이건 보면 좋겠네.",
    hint: "출제자는 의외로 뻔한 곳을 좋아한다. 너무 멀리 가지 말자.",
    entrance: "왔구나. 앉아. 커피는 없고 마감은 있네.",
    praise: "오, 괜찮은데? 이 정도면 오늘은 연구실 불 안 꺼도 되겠다."
  }
};

const defaults = {
  professors: {},
  submitted: {},
  trust: 62,
  streak: 0,
  materials: [],
  chats: {}
};

function readState() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("professor-lab-state")) };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  localStorage.setItem("professor-lab-state", JSON.stringify(state));
}

function App() {
  const [view, setView] = useState("dashboard");
  const [state, setState] = useState(readState);
  const [assignments, setAssignments] = useState([]);
  const [editingSlot, setEditingSlot] = useState(null);
  const [activeSlot, setActiveSlot] = useState(null);
  const [filter, setFilter] = useState("all");
  const [materialNotes, setMaterialNotes] = useState("");
  const [examOutput, setExamOutput] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStatus, setChatStatus] = useState("자료와 과제 상황을 참고해서 공부 대화를 이어갑니다.");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetch("/data/all_assignments.json")
      .then((response) => response.json())
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const createdProfessors = Object.entries(state.professors).filter(([, professor]) => professor);
  const activeProfessor = activeSlot ? state.professors[activeSlot] : createdProfessors[0]?.[1];
  const activeChatKey = activeSlot || createdProfessors[0]?.[0] || "default";
  const chat = state.chats[activeChatKey] || [];
  const upcoming = useMemo(() => sortAssignments(assignments).filter((item) => !state.submitted[idFor(item)] && daysLeft(item.due_at) >= 0), [assignments, state.submitted]);
  const urgent = assignments.filter((item) => !state.submitted[idFor(item)] && daysLeft(item.due_at) >= 0 && daysLeft(item.due_at) <= 7);
  const openAssignments = assignments.filter((item) => !state.submitted[idFor(item)]);

  function patchState(patch) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateTrust(delta) {
    setState((current) => ({ ...current, trust: clamp(current.trust + delta, 0, 100) }));
  }

  function startSim(slot) {
    setActiveSlot(slot);
    setView("sim");
    ensureGreeting(slot);
  }

  function ensureGreeting(slot) {
    const professor = state.professors[slot];
    if (!professor) return;
    setState((current) => {
      if (current.chats[slot]?.length) return current;
      const style = personalityMap[professor.personality];
      return {
        ...current,
        chats: {
          ...current.chats,
          [slot]: [{ role: "assistant", content: `${style.entrance} 질문, 답안, 과제 계획 중 무엇이든 말해보게. 공부가 되도록 바로 이어가겠다.` }]
        }
      };
    });
  }

  function saveProfessor(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slot = editingSlot;
    const professor = {
      name: form.get("name").trim(),
      course: form.get("course").trim(),
      personality: form.get("personality"),
      hintMode: form.get("hintMode"),
      speechMemo: form.get("speechMemo").trim()
    };
    setState((current) => ({
      ...current,
      trust: clamp(current.trust + 3, 0, 100),
      professors: { ...current.professors, [slot]: professor }
    }));
    setEditingSlot(null);
    setTimeout(() => startSim(slot), 0);
  }

  function chooseQuickAction(type) {
    if (!activeProfessor) return;
    const style = personalityMap[activeProfessor.personality];
    const message = type === "study" ? "핵심 개념을 문제로 바꿔볼게요." : type === "assignment" ? "마감 과제부터 처리할게요." : `${activeProfessor.hintMode} 부탁드립니다.`;
    const reply =
      type === "study"
        ? `${style.praise} 먼저 네가 이해한 핵심 개념을 한 문장으로 써봐. 내가 채점하듯 바로 잡아주겠다.`
        : type === "assignment"
          ? `${style.praise} ${upcoming[0]?.title || "오늘 학습"}부터 요구사항을 세 줄로 요약해서 보내게.`
          : `${style.praise} ${style.hint}`;
    addChat("user", message);
    addChat("assistant", reply);
    patchState({ trust: clamp(state.trust + 2, 0, 100), streak: type === "study" ? state.streak + 1 : state.streak });
  }

  function addChat(role, content) {
    setState((current) => {
      const history = current.chats[activeChatKey] || [];
      return {
        ...current,
        chats: {
          ...current.chats,
          [activeChatKey]: [...history, { role, content }].slice(-30)
        }
      };
    });
  }

  async function sendChat(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || !activeProfessor) return;

    setChatInput("");
    setIsSending(true);
    setChatStatus("교수님이 답변을 준비 중입니다...");
    addChat("user", message);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professor: activeProfessor,
          message,
          history: chat.slice(-12),
          materials: [materialNotes, ...state.materials.map((item) => item.text)].join("\n").slice(0, 6000),
          assignments: upcoming.slice(0, 5),
          trust: state.trust,
          streak: state.streak
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "답변 생성 실패");
      addChat("assistant", data.reply);
      updateTrust(1);
      setChatStatus(data.mode === "local" ? "API 키가 없어 로컬 교수님 모드로 답변했습니다." : "LLM 교수님이 답변했습니다.");
    } catch {
      addChat("assistant", localReply(activeProfessor, message));
      setChatStatus("서버 연결이 불안정해서 로컬 교수님 모드로 답변했습니다.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleMaterialFiles(files) {
    const loaded = [];
    for (const file of files) {
      loaded.push({
        name: file.name,
        text: file.name.toLowerCase().endsWith(".pdf") ? `${file.name} PDF 자료. 핵심 내용은 메모 입력란에 추가하면 반영됩니다.` : await file.text()
      });
    }
    setState((current) => ({ ...current, materials: [...current.materials, ...loaded].slice(-8) }));
    setMaterialNotes((current) => [current, ...loaded.map((item) => `[${item.name}]\n${item.text}`)].filter(Boolean).join("\n\n"));
  }

  function generateExam() {
    if (!activeProfessor) return;
    const style = personalityMap[activeProfessor.personality];
    const keywords = extractKeywords([materialNotes, ...state.materials.map((item) => item.text), activeProfessor.course].join("\n"));
    setExamOutput([
      `${style.opener}\n[객관식] ${keywords[0] || "핵심 개념"}에 대한 설명으로 가장 적절한 것은?\n1. 조건을 무시한다\n2. 정의와 예외를 함께 설명한다\n3. 결과만 암기한다\n4. 맥락과 무관하다\n정답 후보: 2`,
      `${style.opener}\n[단답형] ${keywords[1] || "중요 용어"}의 핵심 정의를 한 문장으로 쓰시오.`,
      `${style.opener}\n[서술형] ${keywords[2] || "강의 주제"} 개념이 실제 사례나 논문 맥락에서 왜 중요한지 설명하시오.`,
      `[핵심 요약] ${keywords.slice(0, 6).join(", ") || "자료를 입력하면 키워드가 나옵니다."}`
    ]);
    updateTrust(2);
    setView("exam");
  }

  const filteredAssignments = sortAssignments(assignments).filter((item) => {
    const done = state.submitted[idFor(item)];
    const left = daysLeft(item.due_at);
    if (filter === "open") return !done;
    if (filter === "urgent") return !done && left >= 0 && left <= 7;
    return true;
  });

  return (
    <div className={styles["app-shell"]}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles["brand-mark"]}>?</span>
          <div>
            <strong>교수님 연구실</strong>
            <small>시험 대비 · 과제 알림 · 신뢰도 관리</small>
          </div>
        </div>
        <nav className={styles["nav-tabs"]}>
          {[
            ["dashboard", "홈"],
            ["professors", "교수님"],
            ["sim", "미연시"],
            ["exam", "예상 문제"],
            ["assignments", "과제"]
          ].map(([key, label]) => (
            <button key={key} className={view === key ? styles.active : ""} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </nav>
        <section className={styles["trust-panel"]}>
          <div className={styles["trust-copy"]}>
            <span>연구실 신뢰도</span>
            <strong>{state.trust}</strong>
          </div>
          <div className={styles["trust-meter"]}>
            <span style={{ width: `${state.trust}%` }} />
          </div>
          <p>{state.trust >= 82 ? "자네... 대학원생이 될 생각 없는가?" : "괜찮군. 이 루틴이면 연구실 문 앞까진 왔다."}</p>
        </section>
      </aside>

      <main>
        <section className={styles.topbar}>
          <div>
            <p>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(new Date())}</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <button onClick={() => patchState({ streak: state.streak + 1, trust: clamp(state.trust + 2, 0, 100) })}>연속학습 기록</button>
        </section>

        {view === "dashboard" && (
          <Dashboard
            urgent={urgent.length}
            open={openAssignments.length}
            professorCount={createdProfessors.length}
            streak={state.streak}
            assignments={upcoming.slice(0, 4)}
            submitted={state.submitted}
            toggleSubmit={(item, checked) => patchState({ submitted: { ...state.submitted, [idFor(item)]: checked }, trust: clamp(state.trust + (checked ? 4 : -4), 0, 100) })}
            professors={state.professors}
            go={setView}
          />
        )}

        {view === "professors" && (
          <ProfessorGrid professors={state.professors} onEmpty={setEditingSlot} onPlay={startSim} />
        )}

        {view === "sim" && (
          <SimView
            professor={activeProfessor}
            chat={chat}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChat={sendChat}
            isSending={isSending}
            chatStatus={chatStatus}
            chooseQuickAction={chooseQuickAction}
            goProfessors={() => setView("professors")}
          />
        )}

        {view === "exam" && (
          <ExamView
            materialNotes={materialNotes}
            setMaterialNotes={setMaterialNotes}
            handleMaterialFiles={handleMaterialFiles}
            generateExam={generateExam}
            examOutput={examOutput}
          />
        )}

        {view === "assignments" && (
          <AssignmentBoard
            filter={filter}
            setFilter={setFilter}
            assignments={filteredAssignments}
            submitted={state.submitted}
            toggleSubmit={(item, checked) => patchState({ submitted: { ...state.submitted, [idFor(item)]: checked }, trust: clamp(state.trust + (checked ? 4 : -4), 0, 100) })}
          />
        )}
      </main>

      {editingSlot && <ProfessorDialog slot={editingSlot} onClose={() => setEditingSlot(null)} onSave={saveProfessor} />}
    </div>
  );
}

function Dashboard({ urgent, open, professorCount, streak, assignments, submitted, toggleSubmit, professors, go }) {
  return (
    <>
      <div className={styles["summary-grid"]}>
        <Summary label="마감 임박" value={urgent} sub="7일 이내 과제" />
        <Summary label="미제출" value={open} sub="제출 체크 전 과제" />
        <Summary label="생성된 교수님" value={professorCount} sub="프로필 완성" />
        <Summary label="연속학습" value={streak} sub="오늘 기록 가능" />
      </div>
      <div className={styles["main-grid"]}>
        <Panel title="다가오는 과제" action={<button className={styles["text-button"]} onClick={() => go("assignments")}>전체 보기</button>}>
          <AssignmentList assignments={assignments} submitted={submitted} toggleSubmit={toggleSubmit} />
        </Panel>
        <Panel title="교수님 슬롯" action={<button className={styles["text-button"]} onClick={() => go("professors")}>설정하기</button>}>
          <div className={cn("professor-grid", "compact")}>
            {slots.slice(0, 3).map((slot) => (
              <ProfessorCard key={slot} slot={slot} professor={professors[slot]} onEmpty={() => go("professors")} onPlay={() => go("sim")} />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function SimView({ professor, chat, chatInput, setChatInput, sendChat, isSending, chatStatus, chooseQuickAction, goProfessors }) {
  if (!professor) {
    return (
      <div className={styles["empty-state"]}>
        <h2>교수님을 먼저 생성하세요</h2>
        <button onClick={goProfessors}>교수님 만들러 가기</button>
      </div>
    );
  }

  return (
    <section className={styles["sim-stage"]}>
      <div className={styles["sim-background"]}>
        <div className={styles["office-board"]}>
          <span>QUIZ</span>
          <span>DEADLINE</span>
          <span>LAB TRUST</span>
        </div>
        <div className={styles["professor-standee"]} data-personality={professor.personality}>
          <span>{professor.name.slice(0, 1)}</span>
        </div>
      </div>
      <div className={styles["dialogue-box"]}>
        <div className={styles["speaker-row"]}>
          <strong>{professor.name}</strong>
          <span>{professor.personality} · {professor.hintMode}</span>
        </div>
        <p>{personalityMap[professor.personality].entrance}</p>
        <div className={styles["choice-grid"]}>
          <button onClick={() => chooseQuickAction("study")}>핵심 개념을 문제로 바꿔볼게요</button>
          <button onClick={() => chooseQuickAction("assignment")}>마감 과제부터 처리할게요</button>
          <button onClick={() => chooseQuickAction("hint")}>{professor.hintMode} 부탁드립니다</button>
        </div>
        <div className={styles["chat-panel"]}>
          <div className={styles["chat-log"]}>
            {chat.map((message, index) => (
              <div key={index} className={cn("chat-message", message.role)}>
                <span>{message.role === "user" ? "나" : professor.name}</span>
                <p>{message.content}</p>
              </div>
            ))}
          </div>
          <form className={styles["chat-form"]} onSubmit={sendChat}>
            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="교수님께 질문하거나, 내 답안을 써보세요" disabled={isSending} />
            <button disabled={isSending}>{isSending ? "작성 중" : "전송"}</button>
          </form>
          <small>{chatStatus}</small>
        </div>
      </div>
    </section>
  );
}

function ProfessorGrid({ professors, onEmpty, onPlay }) {
  return (
    <div className={styles["professor-grid"]}>
      {slots.map((slot) => (
        <ProfessorCard key={slot} slot={slot} professor={professors[slot]} onEmpty={() => onEmpty(slot)} onPlay={() => onPlay(slot)} />
      ))}
    </div>
  );
}

function ProfessorCard({ professor, onEmpty, onPlay }) {
  if (!professor) {
    return (
      <button className={cn("professor-card", "empty")} onClick={onEmpty}>
        <span className={styles.avatar}>?</span>
        <strong>교수님 설정</strong>
        <span>성격, 말투, 힌트 방식을 선택하세요.</span>
      </button>
    );
  }
  return (
    <button className={styles["professor-card"]} onClick={onPlay}>
      <span className={styles.avatar}>{professor.name.slice(0, 1)}</span>
      <strong>{professor.name}</strong>
      <span className={styles.muted}>{professor.course || "담당 강의 미입력"}</span>
      <span>{personalityMap[professor.personality].opener}</span>
      <div className={styles["tag-row"]}>
        <span className={styles.tag}>{professor.personality}</span>
        <span className={styles.tag}>{professor.hintMode}</span>
      </div>
      <span className={styles["play-hint"]}>연구실 이벤트 시작</span>
    </button>
  );
}

function ProfessorDialog({ onClose, onSave }) {
  return (
    <div className={styles["modal-backdrop"]}>
      <form className={styles.modal} onSubmit={onSave}>
        <header>
          <h2>교수님 프로필 생성</h2>
          <button type="button" className={styles.secondary} onClick={onClose}>닫기</button>
        </header>
        <label>교수님 이름<input name="name" required placeholder="예: 김현석 교수님" /></label>
        <label>담당 강의<input name="course" placeholder="예: 강화학습" /></label>
        <div className={styles["form-row"]}>
          <label>성격<select name="personality">{Object.keys(personalityMap).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>시험 힌트<select name="hintMode"><option>직접 힌트</option><option>간접 힌트</option><option>힌트 거의 없음</option></select></label>
        </div>
        <label>말투 메모<textarea name="speechMemo" placeholder="예: 짧고 단호하게, 가끔 연구실 농담" /></label>
        <menu>
          <button type="button" className={styles.secondary} onClick={onClose}>취소</button>
          <button>저장</button>
        </menu>
      </form>
    </div>
  );
}

function ExamView({ materialNotes, setMaterialNotes, handleMaterialFiles, generateExam, examOutput }) {
  return (
    <>
      <div className={styles["exam-layout"]}>
        <Panel title="자료 업로드">
          <p className={styles.muted}>PDF, 논문 텍스트, 강의 자료, 족보를 넣으면 키워드 기반 문제를 만듭니다.</p>
          <label className={styles["drop-zone"]}>
            <input type="file" multiple accept=".txt,.md,.pdf,.json" onChange={(event) => handleMaterialFiles(event.target.files)} />
            <span>자료 파일 선택</span>
            <small>PDF는 파일명과 직접 입력한 메모를 우선 반영합니다.</small>
          </label>
          <textarea value={materialNotes} onChange={(event) => setMaterialNotes(event.target.value)} placeholder="강의 자료나 논문 핵심 내용을 붙여넣기" />
        </Panel>
        <Panel title="문제 생성">
          <button onClick={generateExam}>예상 문제 생성</button>
        </Panel>
      </div>
      <Panel title="생성 결과">
        <div className={styles["exam-output"]}>
          {examOutput.map((item, index) => <div key={index} className={styles["question-block"]}>{item}</div>)}
        </div>
      </Panel>
    </>
  );
}

function AssignmentBoard({ filter, setFilter, assignments, submitted, toggleSubmit }) {
  return (
    <Panel title="D-day 과제 보드" action={<div className={styles.filters}>{["all", "open", "urgent"].map((key) => <button key={key} className={filter === key ? styles.active : ""} onClick={() => setFilter(key)}>{key === "all" ? "전체" : key === "open" ? "미제출" : "마감 임박"}</button>)}</div>}>
      <AssignmentList assignments={assignments} submitted={submitted} toggleSubmit={toggleSubmit} />
    </Panel>
  );
}

function AssignmentList({ assignments, submitted, toggleSubmit }) {
  if (!assignments.length) return <p className={styles.muted}>조건에 맞는 과제가 없습니다.</p>;
  return (
    <div className={styles["assignment-list"]}>
      {assignments.map((item) => {
        const id = idFor(item);
        const done = submitted[id];
        const left = daysLeft(item.due_at);
        return (
          <article className={styles["assignment-card"]} key={id}>
            <div className={styles["assignment-top"]}>
              <div>
                <h3>{item.title || "제목 없음"}</h3>
                <small>{item.course || "강의명 없음"} · {item.professor || "교수명 없음"}</small>
              </div>
              <span className={cn("d-day", done || left <= 7 ? "urgent" : "")}>{done ? "제출 완료" : ddayLabel(item.due_at)}</span>
            </div>
            <small>{formatDue(item.due_at)} · {item.points ?? "-"}점</small>
            <p className={styles.muted}>{left <= 7 ? "마감이 임박했습니다. 지금 제출 칸을 열어두는 편이 좋습니다." : "루틴 안에 넣어두면 신뢰도가 안정적으로 올라갑니다."}</p>
            <div className={styles["assignment-actions"]}>
              <a href={item.url || "#"} target="_blank" rel="noreferrer">LMS 열기</a>
              <label><input type="checkbox" checked={Boolean(done)} onChange={(event) => toggleSubmit(item, event.target.checked)} /> 제출</label>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className={styles.panel}>
      <div className={styles["panel-heading"]}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Summary({ label, value, sub }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>;
}

function idFor(item) {
  return `${item.course || "course"}-${item.title}-${item.due_at || "none"}`;
}

function daysLeft(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

function ddayLabel(iso) {
  const left = daysLeft(iso);
  if (!Number.isFinite(left)) return "마감 미정";
  if (left < 0) return `D+${Math.abs(left)}`;
  if (left === 0) return "D-day";
  return `D-${left}`;
}

function formatDue(iso) {
  if (!iso) return "마감일 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

function sortAssignments(list) {
  return [...list].sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER) - (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER));
}

function extractKeywords(text) {
  return [...new Set(String(text).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).map(normalizeKeyword).filter((word) => word.length >= 2))].slice(0, 12);
}

function normalizeKeyword(word) {
  let normalized = word.replace(/(으로|에서|에게|보다|처럼|까지|부터|하고|이며|이나|거나)$/u, "");
  if (normalized.length > 3 && !/(하는|되는|적인)$/u.test(normalized)) {
    normalized = normalized.replace(/(은|는|이|가|을|를|과|와|의|도|로)$/u, "");
  }
  return normalized;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function titleFor(view) {
  return {
    dashboard: "오늘의 연구실",
    professors: "교수님 캐릭터",
    sim: "교수님 미연시",
    exam: "예상 시험 문제 생성",
    assignments: "과제 알림"
  }[view];
}

function localReply(professor, message) {
  const keywords = extractKeywords(message).slice(0, 3).join(", ");
  return `${personalityMap[professor.personality].opener} 지금 핵심은 ${keywords || "정의와 적용 조건"}이다. 먼저 한 문장 정의와 예시 하나를 다시 보내게.`;
}

export default App;
