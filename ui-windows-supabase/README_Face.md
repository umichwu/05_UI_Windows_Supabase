設計理念（Design Principles）

分層解耦

前端：鏡頭 & 上傳、UI 呈現。

Next.js Route Handlers：Proxy/整形 + Supabase 寫入（不要做重推論）。

推論服務：DeepFace（FastAPI or Docker API），可獨立部署、水平擴展。

可替換後端

本機：FACE_API_BASE_URL=http://localhost:8000（FastAPI）或 http://localhost:5005（DeepFace Docker）。

上雲：只換環境變數，Next.js 不改碼。

標準資料流

前端擷取影格 → /api/face/recognize → 推論 → 寫 app.face_events；觸發器判斷 care_rules → 進 outbox_events → n8n 主動關懷。

週期彙整 app.mood_windows 顯示趨勢。

臉孔辨識與特徵

使用 DeepFace.represent 產生 Facenet512 (512-d) 向量；在 DB 用 pgvector（你已建）做最近鄰查找；距離閾值（cosine）可調。

Enrollment（收樣）至少 3–5 張，向量可平均或多樣本存多筆。

情緒偵測

使用 DeepFace.analyze(actions=['emotion'])，取 dominant_emotion 與分數；信心值寫入 face_events.confidence / emotion_scores。

UI 以 dominant_emotion + 置信顯示；也可寫到 messages.metadata.emotion 供回覆語氣調整。

主動關懷

觸發器依 care_rules（目標情緒/視窗/比例/信心/冷卻）→ 產生 care.trigger outbox事件；n8n 再 LLM 生成貼心訊息＋推播。

隱私 & 體驗

前端有明確同意、錄製指示、暫停；預設不存原始影像，只存 embedding/分數。

控制上傳頻率（預設 1–2s/張）與圖片最大邊長（例如 640px）。

效能與穩定

向量/時間欄位索引已建。

推論逾時、重試與冪等透過 Outbox + n8n 完成。

Route Handlers 使用 Node runtime，只做 proxy & DB。

端點契約（API Contracts）
/api/face/enroll (POST)

Body：{ user_id, images: [base64_jpeg...], model='Facenet512' }

流程：傳給 DeepFace → 取得多張向量 → 平均/逐張寫入 app.face_profiles。

回應：{ samples, model, embedding_count }

/api/face/recognize (POST)

Body：{ image, model='Facenet512', detector='retinaface', metric='cosine', threshold=0.30 }

流程：represent → 在 DB 以 pgvector 取前 k 近鄰 → 距離 < threshold 視為命中 → 同時 analyze(actions=['emotion']) → 寫一筆 app.face_events。

回應：{ recognized_user_id | null, distance, dominant_emotion, emotion_scores, confidence }

若 FACE_API_BASE_URL 未設定，Route Handlers 回 Mock（方便前端先跑）。

必備環境變數

Next.js：NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_CAMERA_INTERVAL_MS / NEXT_PUBLIC_DEV_MODE / FACE_API_BASE_URL

FastAPI：DEEPFACE_MODEL=Facenet512, DETECTOR=retinaface, METRIC=cosine, THRESHOLD=0.30, ALLOWED_ORIGINS=...

服務端寫 DB（若需要跨使用者）請使用 Service Role Key（繞過 RLS）。

中文 Master Prompt（貼給 Claude Code）

你是我的資深全端工程師。請在現有 Next.js + Supabase 專案，明確使用 deepface 實作「臉孔辨識 + 情緒偵測」，並與我現有的表（app.face_events / mood_windows / care_rules / care_incidents、Outbox、n8n）整合。

必須達成

前端（Next.js）

CameraPanel.tsx：getUserMedia、明確同意、錄製指示、暫停/恢復、鏡頭切換；每 NEXT_PUBLIC_CAMERA_INTERVAL_MS 擷取一張圖（壓到 640px）→ 呼叫 /api/face/recognize。

EnrollmentDialog.tsx：一次上傳 3–5 張臉樣本 → 呼叫 /api/face/enroll。

FaceStatusBadge.tsx：顯示 {recognized_user | unknown, dominant_emotion, confidence}。

於聊天頁 Context Panel 新增「Care Center」分頁：

查 app.mood_windows 顯示 1/5/15 分鐘趨勢圖；

列出 app.care_incidents（open/ack），提供「我很好了」→ 將 incident 設 closed；

app.care_rules CRUD（目標情緒/視窗秒數/最低比例/最低信心/冷卻/啟用）。

Route Handlers（Node runtime）

POST /api/face/enroll、/api/face/recognize：

讀 FACE_API_BASE_URL 轉發到推論服務；若未設定則回 Mock。

成功辨識/分析後，將結果寫入 app.face_events；把 dominant_emotion 寫到當前 messages.metadata.emotion（示範一次）。

預留 /api/face/analyze（純情緒）。

推論服務（必用 deepface）

選 A：FastAPI + deepface（推薦）

以 deepface 套件實作 /enroll（DeepFace.represent 多張 → 平均向量或多筆）、/recognize（represent → DB KNN by cosine）、/analyze（DeepFace.analyze(actions=['emotion'])）。

預設 model='Facenet512'、detector='retinaface'、metric='cosine'、threshold=0.30，可由環境變數調整。

提供 requirements.txt / Dockerfile / main.py，設 CORS（允許 localhost 與 Vercel 網域）。

選 B：DeepFace Docker API

提供 docker run 指令與 Route Handler 轉發 /analyze、/represent 範例。

DB 互動（Supabase JS）

face_events：每次 /recognize 寫一筆（recognized_user_id、dominant_emotion、emotion_scores、confidence、distance、is_spoof 可選）。

mood_windows：保留呼叫 app.rollup_mood_windows(user, window_sec) 的前端/排程範例。

權限遵守 RLS；批次/排程與 n8n 請用 Service Role。

n8n 流程

監看 outbox_events(event_type='care.trigger', status='pending', scheduled_at<=now()) → 產生「溫柔關懷」訊息（LLM）→ 寫 messages(role='assistant') → 依 channel 推送 → outbox 標記 ok，incident 設 ack。

README

本機啟動（npm run dev + uvicorn main:app）、Vercel 部署、環境變數說明與測試 curl。

記錄參考文章連結（DeepFace 臉孔辨識與情緒偵測教學）。

請一次輸出：完整 TypeScript（前端 + Route Handlers）、Python（FastAPI deepface）或 Docker 版、安裝指令、測試腳本。請特別標明已使用 deepface 的 represent/analyze 與模型/偵測器/度量/閾值設定。

English Master Prompt (paste to Claude Code)

You are my senior full-stack engineer. In our existing Next.js + Supabase app, use deepface to implement Face Recognition + Emotion Detection and integrate with our tables (app.face_events / mood_windows / care_rules / care_incidents) and Outbox/n8n.

Must deliver

Frontend (Next.js)

CameraPanel.tsx: getUserMedia, consent dialog, recording indicator, pause/resume, camera switch; capture one frame every NEXT_PUBLIC_CAMERA_INTERVAL_MS (downscale to 640px) → call /api/face/recognize.

EnrollmentDialog.tsx: upload 3–5 samples → /api/face/enroll.

FaceStatusBadge.tsx: display {recognized_user | unknown, dominant_emotion, confidence}.

“Care Center” tab:

Query app.mood_windows to plot 1/5/15-minute trends;

List app.care_incidents (open/ack) with “I’m OK now” → set status='closed';

CRUD for app.care_rules (target_emotions/window_sec/min_ratio/min_confidence/cooldown/active).

Route Handlers (Node runtime)

POST /api/face/enroll, /api/face/recognize (and a stub /api/face/analyze):

Read FACE_API_BASE_URL to proxy to the inference service; return mock results if unset.

On success, insert one row into app.face_events and attach dominant_emotion to current messages.metadata.emotion (demo).

Inference Service (must use deepface)

Option A: FastAPI + deepface (preferred)

Implement /enroll using DeepFace.represent (multi-image → average vector or multiple entries), /recognize (represent → DB KNN by cosine), and /analyze (DeepFace.analyze(actions=['emotion'])).

Defaults: model='Facenet512', detector='retinaface', metric='cosine', threshold=0.30; override via env.

Provide requirements.txt / Dockerfile / main.py; enable CORS for localhost + Vercel.

Option B: DeepFace Docker API

Provide docker run and handler proxy examples for /analyze and /represent.

DB interactions (Supabase JS)

Insert into face_events for every /recognize call (recognized_user_id, dominant_emotion, emotion_scores, confidence, distance, is_spoof optional).

Expose a way to trigger app.rollup_mood_windows(user, window_sec) for charts.

Respect RLS; use Service Role for batch/scheduler/n8n.

n8n Flow

Poll outbox_events(event_type='care.trigger', status='pending') → generate a caring message via LLM → insert messages(role='assistant') → push to LINE/WeChat → mark outbox ok, set incident ack.

README

Local run (npm run dev + uvicorn main:app), Vercel deployment, env vars, and curl tests.

Include learning resources links for deepface face recognition & emotion detection.

Output in one response: full TypeScript (frontend + handlers), Python (FastAPI deepface) or Docker version, install commands, and test scripts. Explicitly show deepface usage (represent/analyze) and model/detector/metric/threshold settings.

小測試與驗收清單

Enrollment 成功（face_profiles 有新增）

/recognize 能回 recognized_user_id / dominant_emotion / confidence，face_events 有新增

觸發器依規則產生 care.trigger outbox 事件

n8n 取件 → LLM 產生訊息 → 寫入 messages 並推送

mood_windows 彙整能顯示趨勢

前端可暫停擷取、變更取樣頻率、在本機與 Vercel 只靠 FACE_API_BASE_URL 切換

把這兩份 Master Prompt 貼給 Claude Code，他就能在你的專案上直接產出 deepface 版的前後端整合與文件。需要我幫你把 FastAPI deepface 範例先行產出嗎？我可以一次給你 main.py / requirements.txt / Dockerfile 與 Next.js Route Handlers 的範例檔案。

--------------------------------------------------------



Design Principles
Layered decoupling

Frontend: camera capture & upload, UI rendering.

Next.js Route Handlers: proxy/shape requests and write to Supabase (no heavy inference here).

Inference service: DeepFace (FastAPI or Docker API), independently deployable and horizontally scalable.

Swappable backends

Local: FACE_API_BASE_URL=http://localhost:8000 (FastAPI) or http://localhost:5005 (DeepFace Docker).

Cloud: only switch environment variables—no code changes in Next.js.

Standard data flow

Frontend captures frames → /api/face/recognize → inference → write to app.face_events.

Trigger evaluates care_rules → enqueue outbox_events → n8n performs proactive care.

Periodically roll up to app.mood_windows for trend visualization.

Face recognition & embeddings

Use DeepFace.represent to produce Facenet512 (512-d) embeddings.

Store/search with pgvector in the DB; nearest-neighbor by cosine distance with a configurable threshold.

Enrollment: collect 3–5 images; either average embeddings or store multiple samples.

Emotion detection

Use DeepFace.analyze(actions=['emotion']) to get dominant_emotion and per-emotion scores.

Persist confidence to face_events.confidence and scores to face_events.emotion_scores.

UI shows dominant_emotion + confidence; optionally mirror into messages.metadata.emotion to adjust reply tone.

Proactive care

Trigger logic checks care_rules (target emotions / time window / ratio / min confidence / cooldown) → create a care.trigger outbox event.

n8n uses an LLM to generate a caring message and pushes it to the user.

Privacy & UX

Explicit user consent, visible recording indicator, and a pause toggle.

By default do not store raw images—only embeddings and scores.

Control capture frequency (default 1–2s per frame) and max image size (e.g., 640px on the longest side).

Performance & reliability

Indexes on vector/time columns are in place.

Inference timeouts, retries, and idempotency are handled via Outbox + n8n.

Route Handlers run in the Node runtime and only handle proxying & DB I/O.