import React from "react";
import styles from "../App.module.css";
import { slots, personalityMap, idFor, daysLeft, ddayLabel, formatDue, materialLabel } from "../data.js";

const cn = (...names) => names.filter(Boolean).map((name) => styles[name]).join(" ");

export function HomeScreen({ onStart, vnHero, favoriteTitle }) {
  return (
    <main className={styles["home-screen"]} style={{ backgroundImage: `url(${vnHero})` }}>
      <section className={styles["home-menu"]}>
        <img className={styles["home-title-image"]} src={favoriteTitle} alt="교수님이 나만 편애한다" />
        <div className={styles["home-buttons"]}>
          <button className={styles["home-start"]} onClick={onStart}>교수님 만나러 가기</button>
        </div>
      </section>
    </main>
  );
}

export function Dashboard({ urgent, open, professorCount, streak, assignments, submitted, toggleSubmit, professors, go }) {
  return (
    <>
      <div className={styles["summary-grid"]}>
        <Summary label="마감 임박" value={urgent} sub="7일 이내 과제" />
        <Summary label="미제출" value={open} sub="제출 체크 전 과제" />
        <Summary label="생성된 교수님" value={professorCount} sub="프로필 완성" />
      </div>
      <div className={styles["main-grid"]}>
        <Panel className={assignments.length ? "assignment-flash" : ""} title="다가오는 과제" action={<button className={styles["text-button"]} onClick={() => go("assignments")}>전체 보기</button>}>
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

export function SimView({ professor, chat, chatInput, setChatInput, sendChat, isSending, chatStatus, chooseQuickAction, goProfessors }) {
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
          <span>QUIZ</span><span>DEADLINE</span><span>LAB TRUST</span>
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

export function ProfessorGrid({ professors, onEmpty, onPlay }) {
  return (
    <div className={styles["professor-grid"]}>
      {slots.map((slot) => (
        <ProfessorCard key={slot} slot={slot} professor={professors[slot]} onEmpty={() => onEmpty(slot)} onPlay={() => onPlay(slot)} />
      ))}
    </div>
  );
}

export function ProfessorCard({ professor, onEmpty, onPlay, slot }) {
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

export function ProfessorDialog({ onClose, onSave }) {
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

export function ExamView({ materialNotes, setMaterialNotes, examHints, setExamHints, handleMaterialFiles, materials, removeMaterial, generateExam, examOutput, examStatus, isGeneratingExam }) {
  return (
    <>
      <div className={styles["exam-layout"]}>
        <Panel title="자료 업로드">
          <p className={styles.muted}>PDF, 논문 텍스트, 강의 자료, 족보를 넣은 뒤 예상 문제 생성 버튼을 누르면 문제를 만듭니다.</p>
          <label className={styles["drop-zone"]}>
            <input type="file" multiple accept=".txt,.md,.pdf,.json,.csv" onChange={(event) => {
              handleMaterialFiles(event.target.files);
              event.target.value = "";
            }} />
            <span>자료 파일 선택</span>
            <small>PDF는 파일명과 직접 입력한 메모를 우선 반영합니다.</small>
          </label>
          <div className={styles["material-list"]}>
            {materials.length ? materials.map((item, index) => (
              <div className={styles["material-item"]} key={item.id || `${item.name}-${index}`}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{materialLabel(item)}</small>
                </div>
                <button type="button" aria-label={`${item.name} 삭제`} onClick={() => removeMaterial(index)}>X</button>
              </div>
            )) : <p className={styles.muted}>선택된 자료 파일이 없습니다.</p>}
          </div>
          <textarea value={materialNotes} onChange={(event) => setMaterialNotes(event.target.value)} placeholder="강의 자료나 논문 핵심 내용을 붙여넣기" />
        </Panel>
        <Panel title="시험 힌트">
          <p className={styles.muted}>교수님이 강조한 범위, 출제 스타일, 꼭 나올 것 같은 키워드를 적어두면 문제 생성에 우선 반영합니다.</p>
          <textarea value={examHints} onChange={(event) => setExamHints(event.target.value)} placeholder="예: 3장 정의 비교, 계산 문제 1개, 교수님이 강조한 반례, 서술형 예상 포인트" />
        </Panel>
        <Panel title="문제 생성">
          <button onClick={() => generateExam()} disabled={isGeneratingExam}>{isGeneratingExam ? "생성 중" : "예상 문제 생성"}</button>
          <p className={styles.muted}>{examStatus}</p>
        </Panel>
      </div>
      <Panel title="생성 결과">
        <div className={styles["exam-output"]}>
          {examOutput.length ? examOutput.map((item, index) => <div key={index} className={styles["question-block"]}>{item}</div>) : <p className={styles.muted}>아직 생성된 문제가 없습니다.</p>}
        </div>
      </Panel>
    </>
  );
}

export function AssignmentBoard({ filter, setFilter, assignments, submitted, toggleSubmit, addCustomAssignment, removeCustomAssignment }) {
  return (
    <>
      <Panel title="직접 과제 추가">
        <CustomAssignmentForm onAdd={addCustomAssignment} />
      </Panel>
      <Panel title="D-day 과제 보드" action={<div className={styles.filters}>{["urgent", "open"].map((key) => <button key={key} className={filter === key ? styles.active : ""} onClick={() => setFilter(key)}>{key === "open" ? "미제출" : "마감 임박"}</button>)}</div>}>
        <AssignmentList assignments={assignments} submitted={submitted} toggleSubmit={toggleSubmit} removeCustomAssignment={removeCustomAssignment} />
      </Panel>
    </>
  );
}

export function CustomAssignmentForm({ onAdd }) {
  return (
    <form className={styles["assignment-form"]} onSubmit={onAdd}>
      <label>과제 제목<input name="title" required placeholder="예: 기말 프로젝트 보고서" /></label>
      <label>과제 내용<textarea name="description" placeholder="요구사항, 제출 형식, 참고할 내용" /></label>
      <label>제출 위치<input name="submitTo" placeholder="예: LMS 과제함, 이메일, GitHub 링크, 교수님 연구실 앞 제출함" /></label>
      <div className={styles["form-row"]}>
        <label>과목<input name="course" placeholder="예: AI시스템설계및개발" /></label>
        <label>교수님<input name="professor" placeholder="예: 최영림 교수님" /></label>
      </div>
      <div className={styles["form-row"]}>
        <label>마감일자<input name="due_at" type="datetime-local" /></label>
        <label>점수<input name="points" type="number" min="0" placeholder="예: 100" /></label>
      </div>
      <button>과제 추가</button>
    </form>
  );
}

export function AssignmentList({ assignments, submitted, toggleSubmit, removeCustomAssignment }) {
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
              <div className={styles["assignment-status"]}>
                <span className={cn("d-day", done || left <= 7 ? "urgent" : "")}>{done ? "제출 완료" : ddayLabel(item.due_at)}</span>
                {item.source === "custom" && removeCustomAssignment && <button type="button" className={styles.secondary} onClick={() => removeCustomAssignment(item)}>삭제</button>}
              </div>
            </div>
            <small>{formatDue(item.due_at)} · {item.points ?? "-"}점</small>
            {item.description ? <p>{item.description}</p> : <p className={styles.muted}>{left <= 7 ? "마감이 임박했습니다. 지금 제출 칸을 열어두는 편이 좋습니다." : "루틴 안에 넣어두면 신뢰도가 안정적으로 올라갑니다."}</p>}
            <div className={styles["assignment-actions"]}>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">LMS 열기</a> : <span className={styles["submit-target"]}>{item.submitTo || "제출 위치 미입력"}</span>}
              <button type="button" className={cn("submit-button", done && "submitted")} onClick={() => toggleSubmit(item, !done)}>
                {done ? "제출 완료" : "제출"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function Panel({ title, action, className, children }) {
  return (
    <section className={cn("panel", className)}>
      <div className={styles["panel-heading"]}>
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Summary({ label, value, sub }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>;
}