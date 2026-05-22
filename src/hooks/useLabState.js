import { useState, useEffect, useMemo } from "react";
import { 
  readState, saveState, sortAssignments, idFor, daysLeft, 
  personalityMap, clamp, remoteChatApiUrl, makeChatQuestion, 
  makeChatStyleOptions, formatRemoteChatAnswer, localReply, makeLocalExam 
} from "../data.js"; // 상위 경로의 data.js 가져오기

export function useLabState() {
  const [view, setView] = useState("dashboard");
  const [state, setState] = useState(readState);
  const [assignments, setAssignments] = useState([]);
  const [editingSlot, setEditingSlot] = useState(null);
  const [activeSlot, setActiveSlot] = useState(null);
  const [filter, setFilter] = useState("urgent");
  const [materialNotes, setMaterialNotes] = useState("");
  const [examHints, setExamHints] = useState("");
  const [examOutput, setExamOutput] = useState([]);
  const [examStatus, setExamStatus] = useState("자료를 업로드하거나 메모를 입력한 뒤 예상 문제를 생성하세요.");
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);
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
  const customAssignments = state.customAssignments || [];
  
  const boardAssignments = useMemo(() => [...assignments, ...customAssignments], [assignments, customAssignments]);
  const upcoming = useMemo(() => sortAssignments(boardAssignments).filter((item) => !state.submitted[idFor(item)] && daysLeft(item.due_at) >= 0), [boardAssignments, state.submitted]);
  const urgent = boardAssignments.filter((item) => !state.submitted[idFor(item)] && daysLeft(item.due_at) >= 0 && daysLeft(item.due_at) <= 7);
  const openAssignments = boardAssignments.filter((item) => !state.submitted[idFor(item)]);

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
    addChat(message, "user"); // 내부 가독성을 위해 순서 교정 필요 시 수정 가능
    addChat(reply, "assistant");
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
    setChatStatus("외부 학습 자료 API로 교수님 답변을 준비 중입니다...");
    addChat("user", message);

    try {
      const response = await fetch(remoteChatApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: makeChatQuestion(message, activeProfessor),
          styleOptions: makeChatStyleOptions(activeProfessor)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "답변 생성 실패");
      addChat("assistant", formatRemoteChatAnswer(data));
      updateTrust(1);
      setChatStatus("자료와 과제 상황을 참고해서 공부 대화를 이어갑니다.");
    } catch {
      addChat("assistant", localReply(activeProfessor, message));
      setChatStatus("외부 API 연결이 불안정해서 로컬 교수님 모드로 답변했습니다.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleMaterialFiles(files) {
    const loaded = [];
    for (const file of files) {
      loaded.push({
        id: `material-${Date.now()}-${file.name}-${file.size}`,
        name: file.name,
        type: file.type || "자료 파일",
        text: file.name.toLowerCase().endsWith(".pdf") ? `${file.name} PDF 자료. 핵심 내용은 메모 입력란에 추가하면 반영됩니다.` : await file.text()
      });
    }
    if (!loaded.length) return;
    setState((current) => ({ ...current, materials: [...current.materials, ...loaded].slice(-8) }));
    setExamStatus("자료가 업로드되었습니다. 시험 힌트를 확인한 뒤 예상 문제 생성 버튼을 눌러 주세요.");
  }

  function removeMaterial(index) {
    setState((current) => ({
      ...current,
      materials: current.materials.filter((_, itemIndex) => itemIndex !== index)
    }));
    setExamStatus("선택한 자료를 목록에서 제거했습니다.");
  }

  async function generateExam(extraMaterials = [], nextMaterialNotes = materialNotes) {
    const professorForExam = activeProfessor || {
      name: "기본 교수님",
      course: "업로드 자료",
      personality: "엄격형",
      hintMode: examHints.trim() ? "직접 힌트" : "간접 힌트",
      speechMemo: "시험 대비 문제를 짧고 명확하게 출제"
    };

    const combinedMaterials = [nextMaterialNotes, ...state.materials.map((item) => item.text), ...extraMaterials.map((item) => item.text)].join("\n\n").slice(0, 12000);
    if (!combinedMaterials.trim() && !examHints.trim()) {
      setExamStatus("자료나 시험 힌트를 먼저 입력해 주세요.");
      return;
    }

    setIsGeneratingExam(true);
    setExamStatus("LLM이 자료와 시험 힌트를 맞춰 예상 문제를 생성 중입니다...");
    setView("exam");

    try {
      const response = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professor: professorForExam,
          materials: combinedMaterials,
          examHints,
          assignments: upcoming.slice(0, 5)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "예상 문제 생성 실패");
      setExamOutput(Array.isArray(data.questions) ? data.questions : [data.reply].filter(Boolean));
      setExamStatus(data.mode === "local" ? "API 키가 없어 로컬 생성 모드로 예상 문제를 만들었습니다." : "LLM이 시험 힌트를 반영해 예상 문제를 만들었습니다.");
      updateTrust(2);
    } catch {
      setExamOutput(makeLocalExam(professorForExam, examHints, combinedMaterials));
      setExamStatus("서버 연결이 불안정해서 로컬 생성 모드로 예상 문제를 만들었습니다.");
    } finally {
      setIsGeneratingExam(false);
    }
  }

  function addCustomAssignment(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dueValue = form.get("due_at");
    const assignment = {
      id: `custom-${Date.now()}`,
      source: "custom",
      title: form.get("title").trim(),
      description: form.get("description").trim(),
      course: form.get("course").trim(),
      professor: form.get("professor").trim(),
      submitTo: form.get("submitTo").trim(),
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
      points: form.get("points") ? Number(form.get("points")) : null
    };
    if (!assignment.title) return;
    setState((current) => ({
      ...current,
      customAssignments: [assignment, ...(current.customAssignments || [])]
    }));
    event.currentTarget.reset();
    setFilter("open");
  }

  function removeCustomAssignment(item) {
    setState((current) => ({
      ...current,
      customAssignments: (current.customAssignments || []).filter((assignment) => assignment.id !== item.id),
      submitted: Object.fromEntries(Object.entries(current.submitted).filter(([key]) => key !== idFor(item)))
    }));
  }

  const filteredAssignments = boardAssignments.filter((item) => {
    const done = state.submitted[idFor(item)];
    const left = daysLeft(item.due_at);
    if (filter === "open") return !done;
    if (filter === "urgent") return left >= 0 && left <= 7;
    return true;
  });

  const toggleSubmitHandler = (item, checked) => 
    patchState({ 
      submitted: { ...state.submitted, [idFor(item)]: checked }, 
      trust: clamp(state.trust + (checked ? 4 : -4), 0, 100) 
    });

  return {
    view, setView, state, assignments, editingSlot, setEditingSlot, activeSlot, setActiveSlot,
    filter, setFilter, materialNotes, setMaterialNotes, examHints, setExamHints, examOutput,
    examStatus, isGeneratingExam, chatInput, setChatInput, chatStatus, isSending,
    createdProfessors, activeProfessor, chat, urgent, openAssignments, upcoming,
    filteredAssignments, startSim, saveProfessor, chooseQuickAction, sendChat,
    handleMaterialFiles, removeMaterial, generateExam, addCustomAssignment,
    removeCustomAssignment, toggleSubmit: toggleSubmitHandler, patchState
  };
}