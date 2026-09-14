'use client';

import { useState, useEffect, useRef, type KeyboardEvent } from "react";

const base =
  (process.env.NEXT_PUBLIC_API_BASE_URL as string) || "http://localhost:8080";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface DetailRow {
  requirement_name: string;
  notice_criteria: string;
  user_info: string;
  result: string;
  notes: string;
}

interface CheckResult {
  result: string | null;
  summary: string | null;
  details: DetailRow[];
  notice_id: string | null;
  raw?: string;
}

interface SessionResponse {
  session_id: string;
  role: string;
  content: string;
  is_final: boolean;
  result?: string | null;
  summary?: string | null;
  details?: DetailRow[];
  notice_id?: string | null;
  status?: number;
  detail?: string;
}

function labelText(label: string | null | undefined) {
  if (label === "eligible") return "🟢 신청 가능";
  if (label === "ineligible") return "🔴 신청 불가";
  if (label === "needs_review") return "🟡 추가 확인 필요";
  return label ?? "판정 없음";
}

function badgeClass(label: string | null | undefined) {
  if (label === "eligible") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (label === "not_eligible" || label === "ineligible") return "bg-red-50 text-red-800 border-red-200";
  if (label === "needs_review") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
}

function verdictClass(v: string | null | undefined) {
  if (v === "met") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (v === "not_met") return "text-red-700 bg-red-50 border-red-200";
  if (v === "needs_review") return "text-amber-700 bg-amber-50 border-amber-200";
  if (v === "unverified") return "text-zinc-600 bg-zinc-50 border-zinc-200";
  return "text-zinc-600 bg-zinc-50 border-zinc-200";
}

function verdictLabel(v: string | null | undefined) {
  if (v === "met") return "⭕ 충족";
  if (v === "not_met") return "❌ 미충족";
  if (v === "needs_review") return "⚠️ 확인 필요";
  if (v === "unverified") return "확인 불가";
  return "미확인";
}

function formatNoticeMeta(text: string) {
  const lines = text.split("\n").filter(Boolean);
  return lines[0]?.trim() || "공고 텍스트 분석 결과";
}

export default function CheckPage() {
  const [notice, setNotice] = useState("");
  const [noticePlaceholder, setNoticePlaceholder] = useState(
    "공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요."
  );
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [submittedNotice, setSubmittedNotice] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [solarUnavailable, setSolarUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, string | null> | null>(null);
  const [profError, setProfError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const io = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`${base}/api/onboarding/progress`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setProfileLoading(false);
      })
      .catch(() => {
        setProfError("프로필을 불러오지 못했습니다.");
        setProfileLoading(false);
      });
  }, []);

  useEffect(() => {
    const chatEnd = document.getElementById("chat-end");
    if (chatEnd) {
      chatEnd.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (sessionId && !loading && io.current) {
      io.current.focus();
    }
  }, [sessionId, loading]);

  const startSession = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setSolarUnavailable(false);
    setSessionId(null);

    if (!notice.trim()) {
      setError("공고 내용을 입력해주세요.");
      setLoading(false);
      return;
    }

    // 프로필이 아직 로드되지 않았으면 로딩이 끝날 때까지 기다린다.
    // 이미 로딩 중이면 응답을 기다리고, 로딩이 끝났으면 즉시 사용한다.
    // setProfile은 비동기 상태 업데이트이므로, 방금 가져온 데이터를 로컬 변수에
    // 함께 담아두어야 이후 요청 본문에 반영할 수 있다.
    let activeProfile: Record<string, string | null> | null = profile;
    if (profileLoading) {
      try {
        const r = await fetch(`${base}/api/onboarding/progress`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = await r.json();
        setProfile(data);
        activeProfile = data;
      } catch {
        setProfError("프로필을 불러오지 못했습니다.");
      }
    }

    const submittedText = notice.trim();
    setSubmittedNotice(submittedText);

    const userMsg = notice;
    setMessages((m) => [...m, { role: "user", content: userMsg }]);

    try {
      const body: Record<string, unknown> = { notice_content: notice };
      if (activeProfile) {
        body.dob = activeProfile.dob ?? null;
        body.region = activeProfile.region ?? null;
        body.residence_duration = activeProfile.residence_duration ?? null;
        body.housing_status = activeProfile.housing_status ?? null;
        body.marital_status = activeProfile.marital_status ?? null;
        body.income_info = activeProfile.income_info ?? null;
        body.asset_info = activeProfile.asset_info ?? null;
        body.car_value = activeProfile.car_value ?? null;
      }

      const res = await fetch(`${base}/api/chat/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: SessionResponse = await res.json();

      if (res.status === 503) {
        setSessionId(null);
        setSolarUnavailable(true);
        setError(data.detail ? String(data.detail) : "Solar 판정을 사용할 수 없습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Solar 판정 엔진 미설정\n" +
              (data.detail ?? "백엔드에 Solar API 키가 설정되어 있지 않거나 호출이 실패했습니다."),
          },
        ]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.detail ? String(data.detail) : "판정 시작 중 오류가 발생했습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: "판정 시작 중 오류가 발생했습니다.\n" + (data.detail ?? ""),
          },
        ]);
        setLoading(false);
        return;
      }

      setSessionId(data.session_id ?? null);

      if (data.is_final) {
        setSessionId(null);
        const checked: CheckResult = {
          result: data.result ?? null,
          summary: data.summary ?? null,
          details: Array.isArray(data.details) ? data.details : [],
          notice_id: data.notice_id ?? null,
          raw: data.content ?? undefined,
        };
        setResult(checked);

        const assistantText = [
          labelText(checked.result),
          checked.summary ? "\n" + checked.summary.replace(/\*\*/g, '').trim() : "",
          checked.details.length > 0
            ? "\n\n자격조건 대조\n" +
              checked.details
                .map(
                  (d) =>
                    `- ${d.requirement_name}\n  공고 기준: ${d.notice_criteria ?? "—"}\n  내 조건: ${d.user_info ?? "—"}\n  판정: ${verdictLabel(d.result)}`,
                )
                .join("\n")
            : "",
        ]
          .filter(Boolean)
          .join("");

        setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: (data.content ?? "").replace(/\*\*/g, '') }]);
        setNoticePlaceholder("Solar의 질문에 답하고 Ctrl+Enter로 보내세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "네트워크 오류가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    setLoading(true);
    setError(null);
    setSolarUnavailable(false);

    if (!sessionId) {
      setError("세션이 없습니다. 공고 내용을 다시 입력해주세요.");
      setLoading(false);
      return;
    }

    const userMsg = text;

    const existing = submittedNotice.trim();
    if (!existing) {
      setSubmittedNotice(text.trim());
    }
    setMessages((m) => [...m, { role: "user", content: userMsg }]);

    try {
      const res = await fetch(`${base}/api/chat/message`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, content: text }),
      });

      const data: SessionResponse = await res.json();

      if (res.status === 503) {
        setSessionId(null);
        setSolarUnavailable(true);
        setError(data.detail ? String(data.detail) : "Solar 판정을 사용할 수 없습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Solar 판정 엔진 미설정\n" +
              (data.detail ?? "백엔드에 Solar API 키가 설정되어 있지 않거나 호출이 실패했습니다."),
          },
        ]);
        setSessionId(null);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.detail ? String(data.detail) : "메시지 전송 중 오류가 발생했습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: "메시지 전송 중 오류가 발생했습니다.\n" + (data.detail ?? ""),
          },
        ]);
        setSessionId(null);
        setLoading(false);
        return;
      }

      if (data.is_final && data.result) {
        setSessionId(null);
        const checked: CheckResult = {
          result: data.result,
          summary: data.summary ?? null,
          details: Array.isArray(data.details) ? data.details : [],
          notice_id: data.notice_id ?? null,
          raw: data.content ?? undefined,
        };
        setResult(checked);

        const assistantText = [
          labelText(checked.result),
          checked.summary ? "\n" + checked.summary.replace(/\*\*/g, '').trim() : "",
          checked.details.length > 0
            ? "\n\n자격조건 대조\n" +
              checked.details
                .map(
                  (d) =>
                    `- ${d.requirement_name}\n  공고 기준: ${d.notice_criteria ?? "—"}\n  내 조건: ${d.user_info ?? "—"}\n  판정: ${verdictLabel(d.result)}`,
                )
                .join("\n")
            : "",
        ]
          .filter(Boolean)
          .join("");

        setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
        setSessionId(null);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: (data.content ?? "").replace(/\*\*/g, '') }]);
        setNoticePlaceholder("Solar의 질문에 답하고 Ctrl+Enter로 보내세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "네트워크 오류가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotice(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      setNoticePlaceholder('첨부 파일이 선택되었습니다. 내용을 확인하려면 텍스트를 붙여넣거나 전송하세요.');
    } else {
      setAttachedFileName(null);
      setNoticePlaceholder('공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.');
    }
    // 파일 input 정리를 위해 값 초기화 (동일 파일 재선택 가능)
    e.target.value = '';
  };

  const submitText = () => {
    const v = notice.trim();
    if (!v) return;
    if (sessionId) {
      sendMessage(v);
      setNotice("");
    } else {
      startSession();
      setNotice("");
    }
  };

  const resetCheck = () => {
    setNotice("");
    setSubmittedNotice("");
    setMessages([]);
    setLoading(false);
    setSessionId(null);
    setResult(null);
    setSolarUnavailable(false);
    setError(null);
    setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitText();
    }
  };

  const profileCard = profile
    ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <div className="font-medium text-zinc-900">내 정보 (온보딩 저장)</div>
        <ul className="mt-2 space-y-1">
          {[
            ["dob", "생년월일"],
            ["region", "거주 지역"],
            ["residence_duration", "거주 기간"],
            ["housing_status", "무주택 여부"],
            ["marital_status", "혼인 여부"],
            ["income_info", "소득 정보"],
            ["asset_info", "자산 정보"],
            ["car_value", "자동차 가액"],
          ].map(([k, label]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="text-zinc-500">{label}</span>
              <span className="font-mono text-zinc-800">
                {profile[k] ? String(profile[k]) : "미제공"}
              </span>
            </li>
          ))}
        </ul>
        {profError && <p className="mt-2 text-xs text-red-600">{profError}</p>}
        <p className="mt-2 text-xs text-zinc-500">
          위 프로필을 공고 판정에 함께 사용합니다. 수정하려면 프로필 수정을 눌러주세요.
        </p>
      </div>
    )
    : null;



  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">청년주택 적격성 체크</h1>
            <p className="mt-1 text-sm text-zinc-600">
              공고 내용을 붙여넣고 보내면 Solar가 신청 가능 여부를 분석해드려요.
              정보가 부족하면 하나씩 물어봐요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button
                type="button"
                onClick={resetCheck}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200"
              >
                새 공고 분석
              </button>
            )}
            <a
              href="/onboarding"
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              프로필 수정
            </a>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="flex flex-col w-[50%] border-r border-zinc-200 bg-white">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-600">
                공고 내용을 여기에 붙여넣거나 파일을 올려 주세요.
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg p-4 ${
                  m.role === "user" ? "ml-auto bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.content.split("\n").map((line, j) => (
                  <p key={j} className="whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
              </div>
            ))}

            {loading && (
              <div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600">
                응답 대기 중...
              </div>
            )}

            {solarUnavailable &&
              !messages.some((m) => m.content.includes("Solar 판정 엔진 미설정")) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">Solar 판정 엔진 미설정</p>
                  <p>{error}</p>
                  <p className="mt-1">
                    백엔드에 Solar API 키가 설정되어 있지 않거나 호출이 실패했습니다.
                  </p>
                </div>
              )}
            <div id="chat-end" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitText();
            }}
            className="border-t border-zinc-200 p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <input
                type="file"
                id="notice-file-input"
                accept=".pdf,.hwp,.hwpz,.txt,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => document.getElementById('notice-file-input')?.click()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                공고 첨부
              </button>
              {attachedFileName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    <path d="M14 2v6h6"/>
                  </svg>
                  {attachedFileName}
                </span>
              )}
              <button
                type="button"
                onClick={() => setNoticePlaceholder('공고 내용을 여기에 붙여넣으세요. (Ctrl+Enter로 전송)')}
                disabled={loading}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M16 10h4M16 14h4M4 6h16M4 12h12M4 18h16"/>
                </svg>
                텍스트로 붙여넣기
              </button>
            </div>
            <textarea
              ref={io}
              value={notice}
              onChange={handleChange}
              className="min-h-[96px] resize-y rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              placeholder={noticePlaceholder}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || profileLoading || !notice.trim()}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "응답 대기 중..." : sessionId ? "답변 보내기" : "전송 및 분석"}
              </button>
            </div>
          </form>
        </aside>

        <main className="flex flex-col w-[60%] border-l border-zinc-200 bg-zinc-50">
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {!submittedNotice.trim() && !result && (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center text-sm text-zinc-600">
                먼저 공고를 올려 주세요. 왼쪽 채팅창에 공고 내용을 붙여넣거나 파일을 올리면, 오른쪽에 공고 정보와 판정 결과가 표시됩니다.
              </div>
            )}

            {submittedNotice.trim() && (
              <>
                {/* 1. 공고 헤더 카드 */}
                <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">현재 공고</h2>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-zinc-900 leading-snug">
                      {submittedNotice.slice(0, 80)}{submittedNotice.length > 80 ? '…' : ''}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>입력 방식: 직접 입력</span>
                      <span>글자 수: {submittedNotice.length}자</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                    분석을 시작하면 여기에 공고의 핵심 정보(공고명, 모집기관, 신청기간, 문의처 등)가 표시됩니다.
                  </div>
                </section>

                {/* 3. 내 정보 대조 미리보기 카드 (profile 있을 때) */}
                {profile && (
                  <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">내 정보 (온보딩 저장)</h2>
                      <button
                        type="button"
                        onClick={() => window.location.href = "/onboarding"}
                        className="text-xs text-zinc-500 hover:text-zinc-700 underline underline-offset-2"
                      >
                        수정하기
                      </button>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {profile.dob && (
                        <>
                          <dt className="text-zinc-500">생년월일</dt>
                          <dd className="text-zinc-900">{profile.dob}</dd>
                        </>
                      )}
                      {profile.region && (
                        <>
                          <dt className="text-zinc-500">거주 지역</dt>
                          <dd className="text-zinc-900">{profile.region}</dd>
                        </>
                      )}
                      {profile.residence_duration && (
                        <>
                          <dt className="text-zinc-500">거주 기간</dt>
                          <dd className="text-zinc-900">{profile.residence_duration}</dd>
                        </>
                      )}
                      {profile.housing_status && (
                        <>
                          <dt className="text-zinc-500">무주택 여부</dt>
                          <dd className="text-zinc-900">{profile.housing_status}</dd>
                        </>
                      )}
                      {profile.marital_status && (
                        <>
                          <dt className="text-zinc-500">혼인 여부</dt>
                          <dd className="text-zinc-900">{profile.marital_status}</dd>
                        </>
                      )}
                      {profile.income_info && (
                        <>
                          <dt className="text-zinc-500">소득 정보</dt>
                          <dd className="text-zinc-900">{profile.income_info}</dd>
                        </>
                      )}
                      {profile.asset_info && (
                        <>
                          <dt className="text-zinc-500">자산 정보</dt>
                          <dd className="text-zinc-900">{profile.asset_info}</dd>
                        </>
                      )}
                      {profile.car_value && (
                        <>
                          <dt className="text-zinc-500">자동차 가액</dt>
                          <dd className="text-zinc-900">{profile.car_value}</dd>
                        </>
                      )}
                    </dl>
                    {!profile.dob && !profile.region && !profile.residence_duration && !profile.housing_status && !profile.marital_status && !profile.income_info && !profile.asset_info && !profile.car_value && (
                      <p className="text-sm text-zinc-500">
                        아직 저장된 프로필 정보가 없어요.{' '}
                        <button
                          type="button"
                          onClick={() => window.location.href = "/onboarding"}
                          className="text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
                        >
                          온보딩을 완료
                        </button>
                        해 주세요.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}

            {loading && !result && (
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 text-sm text-zinc-600">
                분석 중입니다. 공고와 내 정보를 바탕으로 신청 가능 여부를 확인하고 있어요.
              </div>
            )}

            {result && (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-zinc-900">판정 완료</h2>
                  <button
                    type="button"
                    onClick={resetCheck}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                  >
                    새 공고 분석
                  </button>
                </div>

                {/* 2. 자격조건 요약 카드 */}
                <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">자격조건 요약</h2>
                    {result.details && result.details.length > 0 && (
                      <span className="text-xs text-zinc-500">{result.details.length}개 조건</span>
                    )}
                  </div>
                  {result.summary ? (
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {result.summary.replace(/\*\*/g, '').trim() || '요약 정보가 제공되지 않았습니다.'}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-500">요약 정보가 제공되지 않았습니다.</p>
                  )}
                </section>

                {/* 4. 판정 결과 카드 */}
                <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">판정 결과</h2>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(result.result)}`}>
                      {labelText(result.result)}
                    </span>
                  </div>

                  <div className={`rounded-xl border p-5 ${badgeClass(result.result)}`}>
                    <div className="text-lg font-semibold">{labelText(result.result)}</div>
                    {result.summary && <p className="mt-2 text-zinc-800">{result.summary.replace(/\*\*/g, '')}</p>}
                  </div>

                  {/* 자격 조건 대조표 */}
                  {result.details && result.details.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-zinc-800">자격 조건 대조</h3>
                      <div className="space-y-2">
                        {result.details
                          .filter(
                            (d) =>
                              result.result !== "eligible" || d.result !== "needs_review"
                          )
                          .map((d, i) => (
                            <div key={i} className={`rounded-lg border p-3 ${verdictClass(d.result)}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium text-zinc-900">{d.requirement_name}</div>
                                  <div className="text-xs text-zinc-500 mt-0.5">{d.notice_criteria}</div>
                                </div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${verdictClass(d.result)}`}>
                                  {verdictLabel(d.result)}
                                </span>
                              </div>
                              {d.user_info && (
                                <div className="mt-1.5 text-xs text-zinc-600">
                                  내 정보: {d.user_info}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 신청 전 확인할 사항 */}
                  <section className="rounded-xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
                    <div className="text-sm font-medium text-zinc-800">신청 전 확인할 사항</div>
                    <ul className="text-sm text-zinc-600 space-y-1 list-disc marker:text-zinc-400">
                      <li>공고 신청기간과 제출 방법을 시행기관 안내에서 다시 확인하세요.</li>
                      <li>소득·자산·자동차 가액은 사용자가 직접 확인하는 값이 있을 수 있으니, 필요 시 증빙 서류를 준비하세요.</li>
                      <li>이 판정은 공고문 근거로 한 1차 확인이며, 최종 입주자격은 시행기관의 심사를 통해 결정됩니다.</li>
                    </ul>
                  </section>

                  {result.raw && (
                    <details className="rounded-xl border border-zinc-200 bg-white">
                      <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-zinc-700">
                        Solar 원본 응답 보기
                      </summary>
                      <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-zinc-50 p-4 text-xs leading-relaxed whitespace-pre-wrap">
                        {result.raw}
                      </pre>
                    </details>
                  )}

                  <p className="text-xs text-zinc-500">
                    이 판정은 공고문 근거로 한 1차 확인이며, 최종 입주자격은 시행기관의 심사를 통해
                    결정됩니다. 고정 응답 없이 Solar Pro4 응답을 그대로 파싱한 결과입니다.
                  </p>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
