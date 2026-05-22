import http from "node:http";

const port = Number(process.env.API_PORT || 4174);
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const personalities = {
  "엄격형": "기본 개념부터 점검하겠다.",
  "츤데레": "딱히 걱정돼서 그러는 건 아닌데, 그 부분은 잡고 가자.",
  "연구자": "좋습니다. 가정과 근거를 나눠 보면 선명해집니다.",
  "열정형": "좋아, 지금 질문 아주 좋다!",
  "방임형": "음, 대충 넘어가도 될 것 같지만 그러면 시험이 싫어할걸."
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/chat") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const payload = JSON.parse(await readBody(req));
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      sendJson(res, 200, { mode: "local", reply: localReply(payload) });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        instructions: makeInstructions(payload),
        input: makeInput(payload),
        max_output_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, { error: data.error?.message || "OpenAI API error" });
      return;
    }

    sendJson(res, 200, { mode: "llm", reply: getText(data) || localReply(payload) });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

function makeInstructions(payload) {
  const professor = payload.professor || {};
  return [
    "너는 한국 대학생의 공부를 돕는 미연시 교수님 캐릭터다.",
    "사용자의 질문, 답안, 과제 계획을 실제 공부에 도움 되게 피드백한다.",
    "반드시 한국어로 답하고, 2~5문장으로 짧게 답한다.",
    "교수님 성격과 말투를 유지하되, 장난보다 학습 도움을 우선한다.",
    "답변 끝에는 사용자가 바로 할 수 있는 공부 행동이나 질문 하나를 던진다.",
    `교수님 이름: ${professor.name || "교수님"}`,
    `담당 강의: ${professor.course || "미정"}`,
    `성격: ${professor.personality || "엄격형"}`,
    `힌트 방식: ${professor.hintMode || "간접 힌트"}`,
    `말투 메모: ${professor.speechMemo || "없음"}`
  ].join("\n");
}

function makeInput(payload) {
  const history = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
  const transcript = history.map((item) => `${item.role === "assistant" ? "교수님" : "학생"}: ${item.content}`).join("\n");

  return [
    `현재 신뢰도: ${payload.trust ?? "-"}`,
    `연속학습: ${payload.streak ?? "-"}`,
    `다가오는 과제: ${assignments.map((item) => `${item.course} / ${item.title} / ${item.due_at || "마감 미정"}`).join(" | ") || "없음"}`,
    `강의 자료/논문 메모: ${(payload.materials || "").slice(0, 5000)}`,
    `최근 대화:\n${transcript || "없음"}`,
    `학생의 새 메시지:\n${payload.message || ""}`
  ].join("\n\n");
}

function localReply(payload) {
  const professor = payload.professor || {};
  const personality = professor.personality || "엄격형";
  const keywords = String(payload.message || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map(normalizeKeyword)
    .filter((word) => word.length > 1)
    .slice(0, 3)
    .join(", ");

  return `${personalities[personality] || personalities["엄격형"]} ${professor.course || "이번 강의"}에서 지금 핵심은 ${keywords || "정의와 적용 조건"}이다. 먼저 정의를 한 문장으로 쓰고, 예시 하나와 헷갈리는 점 하나를 붙여서 다시 보내게. 그러면 ${professor.hintMode || "간접 힌트"} 방식으로 채점해주겠다.`;
}

function normalizeKeyword(word) {
  let normalized = word.replace(/(으로|에서|에게|보다|처럼|까지|부터|하고|이며|이나|거나)$/u, "");
  if (normalized.length > 3 && !/(하는|되는|적인)$/u.test(normalized)) {
    normalized = normalized.replace(/(은|는|이|가|을|를|과|와|의|도|로)$/u, "");
  }
  return normalized;
}

function getText(data) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request too large"));
    });
    req.on("end", () => resolve(body || "{}"));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Professor lab API running at http://127.0.0.1:${port}`);
  if (!process.env.OPENAI_API_KEY) console.log("OPENAI_API_KEY is not set. Using local fallback replies.");
});
