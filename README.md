# 교수님 연구실 React 버전

교수님 성격을 선택하고, 미연시 화면에서 교수님과 공부 대화를 하는 React 앱입니다. 과제는 LMS JSON을 읽어 D-day 순서로 보여주고, 채팅은 로컬 API 서버를 통해 OpenAI Responses API와 연결됩니다.

## 실행

터미널 1:

```bash
npm run api
```

터미널 2:

```bash
npm run dev
```

브라우저:

```text
http://127.0.0.1:4173/
```

## LLM 연결

API 키가 없으면 로컬 교수님 모드로 대체 답변합니다. 실제 LLM을 쓰려면 API 서버를 이렇게 실행합니다.

```bash
OPENAI_API_KEY=sk-your-key-here npm run api
```

모델 변경:

```bash
OPENAI_API_KEY=sk-your-key-here OPENAI_MODEL=gpt-5.2 npm run api
```

## 주요 파일

- `src/App.jsx`: React 앱 전체 로직과 화면 컴포넌트
- `src/main.jsx`: React 엔트리
- `src/App.module.css`: CSS Modules 기반 디자인
- `server.js`: `/api/chat` LLM 프록시 서버
- `vite.config.js`: Vite 설정과 `/api` 프록시
- `data/all_assignments.json`: LMS 과제 데이터

## 빌드 확인

```bash
npm run build
```
