// 캐릭터 성격 데이터 추가
export const personalityMap = {
  "엄격형": {
    entrance: "흠, 자네인가. 제대로 준비해 왔겠지?",
    opener: "기본 개념이 흔들리면 아무것도 할 수 없네.",
    praise: "나쁘지 않군.",
    hint: "교재의 3장과 반례 부분을 집중적으로 보게."
  },
  "열정형": {
    entrance: "오! 왔는가! 오늘 연구실 분위기 좋은데? 같이 달려보세!",
    opener: "세상을 바꿀 연구를 해보자고!",
    praise: "최고야! 바로 그거라네!",
    hint: "핵심 메커니즘을 실제 예시에 적용하는 게 핵심이야!"
  },
  "츤데레": {
    entrance: "딱히 널 기다린 건 아니지만... 질문 있으면 해보든가.",
    opener: "도와주는 건 이번 한 번뿐이야.",
    praise: "어라, 제법이네? 착각하진 마.",
    hint: "그... 강조했던 비교 분석 표 있잖아, 그거 보면 되잖아."
  }
};

export const slots = Array.from({ length: 6 }, (_, index) => `slot-${index + 1}`);
export const remoteChatApiUrl = "https://aihacktonbackend.onrender.com/api/chat";

export const defaults = {
  professors: {},
  submitted: {},
  trust: 62,
  streak: 0,
  materials: [],
  customAssignments: [],
  chats: {}
};

export function readState() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("professor-lab-state")) };
  } catch {
    return defaults;
  }
}

export function saveState(state) {
  localStorage.setItem("professor-lab-state", JSON.stringify(state));
}

export function materialLabel(item) {
  const lowerName = item.name?.toLowerCase() || "";
  if (lowerName.endsWith(".pdf")) return "PDF 자료";
  if (lowerName.endsWith(".md")) return "마크다운 자료";
  if (lowerName.endsWith(".json")) return "JSON 자료";
  if (lowerName.endsWith(".csv")) return "CSV 자료";
  if (lowerName.endsWith(".txt")) return "텍스트 자료";
  return item.type || "업로드 자료";
}

export function idFor(item) {
  if (item.id) return item.id;
  return `${item.course || "course"}-${item.title}-${item.due_at || "none"}`;
}

export function daysLeft(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

export function ddayLabel(iso) {
  const left = daysLeft(iso);
  if (!Number.isFinite(left)) return "마감 미정";
  if (left < 0) return `D+${Math.abs(left)}`;
  if (left === 0) return "D-day";
  return `D-${left}`;
}

export function formatDue(iso) {
  if (!iso) return "마감일 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

export function sortAssignments(list) {
  return [...list].sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER) - (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER));
}

export function makeChatQuestion(message, professor) {
  const parts = [
    professor.course ? `강의: ${professor.course}` : "",
    professor.name ? `교수님 캐릭터: ${professor.name}` : "",
    `질문: ${message}`
  ].filter(Boolean);
  return parts.join("\n");
}

export function makeChatStyleOptions(professor) {
  return {
    tone: professor.personality === "열정형" ? "친절하고 열정적인" : professor.personality === "엄격형" ? "엄격하지만 명확한" : "친절한",
    formality: professor.personality === "츤데레" || professor.personality === "열정형" ? "반말" : "존댓말",
    emphasis: professor.hintMode === "직접 힌트" ? "개념 설명" : professor.hintMode === "힌트 거의 없음" ? "비교 분석" : "예시 위주"
  };
}

export function formatRemoteChatAnswer(data) {
  const answer = data.answer || "답변을 받았지만 내용이 비어 있습니다.";
  if (!Array.isArray(data.sources) || !data.sources.length) return answer;
  const sources = data.sources
    .map((source) => {
      const topics = Array.isArray(source.topics) && source.topics.length ? ` (${source.topics.join(", ")})` : "";
      return `- ${source.file || "자료"}${topics}`;
    })
    .join("\n");
  return `${answer}\n\n참고 자료\n${sources}`;
}

export function extractKeywords(text) {
  return [...new Set(String(text).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).map(normalizeKeyword).filter((word) => word.length >= 2))].slice(0, 12);
}

export function makeLocalExam(professor, examHints, materials) {
  const style = personalityMap[professor.personality];
  const keywords = extractKeywords([examHints, materials, professor.course].join("\n"));
  const hintLine = examHints.trim() ? `시험 힌트 반영: ${examHints.trim()}` : "시험 힌트가 없어서 자료 핵심 키워드 중심으로 구성.";
  return [
    `${style.opener}\n[객관식] ${keywords[0] || "핵심 개념"}에 대한 설명으로 가장 적절한 것은?\n1. 조건을 무시한다\n2. 정의와 예외를 함께 설명한다\n3. 결과만 암기한다\n4. 맥락과 무관하다\n정답 후보: 2\n해설: ${hintLine}`,
    `${style.opener}\n[단답형] ${keywords[1] || "중요 용어"}의 핵심 정의를 한 문장으로 쓰시오.\n채점 포인트: 정의, 조건, 예외를 빠뜨리지 말 것.`,
    `${style.opener}\n[서술형] ${keywords[2] || "강의 주제"} 개념이 실제 사례나 논문 맥락에서 왜 중요한지 설명하시오.\n채점 포인트: 자료 근거 1개와 본인 설명 1개를 연결할 것.`,
    `[핵심 요약] ${keywords.slice(0, 8).join(", ") || "자료를 입력하면 키워드가 나옵니다."}`
  ];
}

export function normalizeKeyword(word) {
  let normalized = word.replace(/(으로|에서|에게|보다|처럼|까지|부터|하고|이며|이나|거나)$/u, "");
  if (normalized.length > 3 && !/(하는|되는|적인)$/u.test(normalized)) {
    normalized = normalized.replace(/(은|는|이|가|을|를|과|와|의|도|로)$/u, "");
  }
  return normalized;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function titleFor(view) {
  return {
    dashboard: "오늘의 연구실",
    professors: "교수님 캐릭터",
    sim: "교수님 미연시",
    exam: "예상 시험 문제 생성",
    assignments: "과제 알림"
  }[view];
}

export function localReply(professor, message) {
  const keywords = extractKeywords(message).slice(0, 3).join(", ");
  return `${personalityMap[professor.personality].opener} 지금 핵심은 ${keywords || "정의와 적용 조건"}이다. 먼저 한 문장 정의와 예시 하나를 다시 보내게.`;
}