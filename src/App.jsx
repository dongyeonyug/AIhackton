import React from "react";
import styles from "./App.module.css";
import favoriteTitle from "./assets/favorite-title.png";
import vnHero from "./assets/vn-hero.png";

// 분리한 데이터 및 훅, 컴포넌트 임포트
import { titleFor } from "./data.js";
import { useLabState } from "./hooks/useLabState.js";
import { 
  HomeScreen, Dashboard, SimView, ProfessorGrid, 
  ProfessorDialog, ExamView, AssignmentBoard 
} from "./components/statusBar.jsx";

const cn = (...names) => names.filter(Boolean).map((name) => styles[name]).join(" ");

function App() {
  const {
    showHome, view, setView, state, editingSlot, setEditingSlot, filter, setFilter,
    materialNotes, setMaterialNotes, examHints, setExamHints, examOutput, examStatus,
    isGeneratingExam, chatInput, setChatInput, chatStatus, isSending, createdProfessors,
    activeProfessor, chat, urgent, openAssignments, upcoming, filteredAssignments,
    startSim, saveProfessor, chooseQuickAction, sendChat, handleMaterialFiles,
    removeMaterial, generateExam, addCustomAssignment, removeCustomAssignment, toggleSubmit, patchState
  } = useLabState();

  if (showHome) {
    return <HomeScreen onStart={() => patchState({ showHome: false })} vnHero={vnHero} favoriteTitle={favoriteTitle} />;
  }

  return (
    <div className={styles["app-shell"]}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles["brand-mark"]}>?</span>
          <div>
            <strong>강의실</strong>
            <small>시험 대비 · 과제 알림 · 신뢰도 관리</small>
          </div>
        </div>
        <nav className={styles["nav-tabs"]}>
          {[
            ["dashboard", "홈", "home-icon"],
            ["professors", "교수님", "user-icon"],
            ["sim", "미연시", "book-icon"],
            ["exam", "예상 문제", "note-icon"],
            ["assignments", "과제", "feather-icon"]
          ].map(([key, label, icon]) => (
            <button key={key} className={cn(icon, view === key && "active")} onClick={() => {
              if (key === "assignments") setFilter("urgent");
              setView(key);
            }}>
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
        </section>

        {view === "dashboard" && (
          <Dashboard
            urgent={urgent.length}
            open={openAssignments.length}
            professorCount={createdProfessors.length}
            streak={state.streak}
            assignments={upcoming.slice(0, 4)}
            submitted={state.submitted}
            toggleSubmit={toggleSubmit}
            professors={state.professors}
            go={(target) => {
              if (target === "assignments") setFilter("urgent");
              setView(target);
            }}
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
            examHints={examHints}
            setExamHints={setExamHints}
            handleMaterialFiles={handleMaterialFiles}
            materials={state.materials}
            removeMaterial={removeMaterial}
            generateExam={generateExam}
            examOutput={examOutput}
            examStatus={examStatus}
            isGeneratingExam={isGeneratingExam}
          />
        )}

        {view === "assignments" && (
          <AssignmentBoard
            filter={filter}
            setFilter={setFilter}
            assignments={filteredAssignments}
            submitted={state.submitted}
            toggleSubmit={toggleSubmit}
            addCustomAssignment={addCustomAssignment}
            removeCustomAssignment={removeCustomAssignment}
          />
        )}
      </main>

      {editingSlot && <ProfessorDialog slot={editingSlot} onClose={() => setEditingSlot(null)} onSave={saveProfessor} />}
    </div>
  );
}

export default App;