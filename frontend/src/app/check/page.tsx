'use client';

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const base =
  (process.env.NEXT_PUBLIC_API_BASE_URL as string) || "http://localhost:8080";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
  isFinal?: boolean;
}

interface SessionResponse {
  session_id: string;
  content: string;
  is_final: boolean;
  result?: string | null;
  summary?: string | null;
  details?: Array<{
    requirement_name: string;
    result: string;
    user_info?: string | null;
    notice_criteria?: string | null;
    notes?: string | null;
  }>;
  notice_id?: string | null;
  rank?: string | null;
  applicant_type?: string | null;
  pre_check?: string | null;
}

interface CheckResult {
  result: string | null;
  summary: string | null;
  details: Array<{
    requirement_name: string;
    result: string;
    user_info?: string | null;
    notice_criteria?: string | null;
    notes?: string | null;
  }>;
  notice_id: string | null;
  raw?: string;
  rank?: string | null;
  applicant_type?: string | null;
  pre_check?: string | null;
}

function labelText(label: string | null | undefined) {
  if (label === "eligible") return "신청 가능";
  if (label === "ineligible") return "신청 불가";
  if (label === "needs_review") return "추가 확인 필요";
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
  if (v === "met") return "충족";
  if (v === "not_met") return "미충족";
  if (v === "needs_review") return "확인 필요";
  if (v === "unverified") return "확인 불가";
  return "미확인";
}

function isMarkdownTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return false;
  if (/^\|[\s\-:|]+\|$/.test(t)) return false;
  return true;
}

/** 채팅패널에서 빈 줄이 많아지는 것을 줄이기 위한 응답 텍스트 압축 */
function formatChatContent(raw: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isMarkdownTableRow(line)) {
      const tableRows: string[] = [];
      while (i < lines.length && isMarkdownTableRow(lines[i])) {
        tableRows.push(lines[i]);
        i++;
      }
      for (const row of tableRows) {
        const trimmed = row.trim();
        const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
        const inner2 = inner.endsWith("|") ? inner.slice(0, -1) : inner;
        const cells = inner2.split("|").map((c) => c.trim());
        out.push(cells.join(" | "));
      }
      continue;
    }
    out.push(line);
    i++;
  }
  let text = out.join("\n");
  text = text.replace(/\n[ \t]*\n[ \t]*\n[ \t]*(?=\n|$)/g, "\n\n");
  text = text.trim();
  return text;
}

/** 좌측 채팅 패널 상단에 표시되는 공고 카드.
 *  기존 우측 패널의 "현재 공고" 카드와 동일한 구성 (전문 펼쳐보기/접기 + 정보 표시). */
function NoticeCard({
  notice,
  attachedFileName,
  onToggle,
  expanded,
}: {
  notice: string;
  attachedFileName: string | null;
  onToggle: () => void;
  expanded: boolean;
}) {
  const lines = notice.split('\n');
  const isLong = lines.length >= 9;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">현재 공고</h2>
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] leading-snug">
        {notice.slice(0, 80)}{notice.length > 80 ? '…' : ''}
      </h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>입력 방식: {attachedFileName ? `파일 첨부 (${attachedFileName})` : '직접 입력'}</span>
        <span>글자 수: {notice.length}자</span>
      </div>

      {/* 공고 전문 (접기/펼치기) */}
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-sky-800">공고 전문</span>
          {attachedFileName && (
            <span className="text-xs text-sky-700">
              — {attachedFileName}
            </span>
          )}
        </div>
        <div className="mt-2">
          <div className={isLong && !expanded ? 'line-clamp-4' : ''}>
            {lines.map((line, j) => (
              <p key={j} className="whitespace-pre-wrap text-sm leading-relaxed text-sky-900">
                {line}
              </p>
            ))}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={onToggle}
              className="mt-2 text-xs text-sky-700 hover:text-sky-900"
            >
              {expanded ? '접기' : '펼쳐보기'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CheckPage() {
  const [notice, setNotice] = useState("");
  const [noticePlaceholder, setNoticePlaceholder] = useState(
    "공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요."
  );
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [fileParseError, setFileParseError] = useState<string | null>(null);
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
  const [noticeExpanded, setNoticeExpanded] = useState(false);
  const toggleNotice = () => setNoticeExpanded((prev) => !prev);
  const [expandedMsg, setExpandedMsg] = useState<Set<number>>(new Set());
  const toggleMsg = (i: number) =>
    setExpandedMsg((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const io = useRef<HTMLTextAreaElement>(null);

  // data 폴더에 저장된 파싱 공고 목록/전문
  const [parsedNotices, setParsedNotices] = useState<
    Array<{ id: string; title: string; pages: number | undefined; char_count: number }>
  >([]);
  const [parsedNoticesLoading, setParsedNoticesLoading] = useState(false);
  const [parsedNoticeModalOpen, setParsedNoticeModalOpen] = useState(false);
  const [selectedParsedNoticeId, setSelectedParsedNoticeId] = useState<string | null>(null);

  // 마운트 시 파싱 공고 자동 로드 + 목록 있으면 모달 자동 오픈
  useEffect(() => {
    let cancelled = false;
    setParsedNoticesLoading(true);
    fetch(`${base}/api/parsed-notices`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const notices = (data as {
          notices?: Array<{
            id: string;
            title: string;
            pages: number | undefined;
            char_count: number;
          }>;
        }).notices || [];
        setParsedNotices(notices);
        if (notices.length > 0 && !cancelled) {
          setParsedNoticeModalOpen(true);
        }
      })
      .catch(() => {
        // 로딩 실패는 조용히 넘김
      })
      .finally(() => {
        if (!cancelled) setParsedNoticesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const selectParsedNotice = async (id: string) => {
    setSelectedParsedNoticeId(id);
    setParsedNoticesLoading(true);
    try {
      const res = await fetch(
        `${base}/api/parsed-notices/${encodeURIComponent(id)}`,
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!res.ok) {
        setError("공고 데이터를 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      const content = (data as { content?: string }).content;
      if (!content || typeof content !== "string") {
        setError("공고 데이터가 올바르지 않습니다.");
        return;
      }
      // 공고 설정 → 채팅 영역에 공고 카드 즉시 표시 → 모달 닫기 → 판정 시작
      // textarea는 비워 두고, 공고 내용은 submittedNotice로 채팅 패널 상단 카드에만 표시
      setSubmittedNotice(content);
      setParsedNoticeModalOpen(false);
      startSession(content); // 공고 내용을 직접 전달하여 상태 업데이트 지연 문제 회피
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setParsedNoticesLoading(false);
      setSelectedParsedNoticeId(null);
    }
  };

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

  const startSession = async (noticeContent?: string) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setSolarUnavailable(false);
    setSessionId(null);

    // 공고 내용 우선순위: 파라미터 > 현재 상태
    const text = (noticeContent ?? notice).trim();
    if (!text) {
      setError("공고 내용을 입력해주세요.");
      setLoading(false);
      return;
    }

    let activeProfile: Record<string, string | null> | null = null;
    try {
      const r = await fetch(`${base}/api/onboarding/progress`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data = await r.json();
      setProfile(data);
      activeProfile = data as Record<string, string | null>;
    } catch {
      setProfError("프로필을 불러오지 못했습니다.");
    }

    const submittedText = text;
    setSubmittedNotice(submittedText);

    const userMsg = text;
    setMessages((m) => [...m, { role: "user", content: userMsg }]);

    try {
      const body: Record<string, unknown> = { notice_content: text };
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

      const data = await res.json();

      if (res.status === 503) {
        setSessionId(null);
        setSolarUnavailable(true);
        setError((data as Record<string, unknown>).detail ? String((data as Record<string, unknown>).detail) : "Solar 판정을 사용할 수 없습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              typeof (data as Record<string, unknown>).detail === "string"
                ? (data as Record<string, unknown>).detail as string
                : "백엔드에 Solar API 키가 설정되어 있지 않거나 호출이 실패했습니다.",
          },
        ]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError((data as Record<string, unknown>).detail ? String((data as Record<string, unknown>).detail) : "판정 시작 중 오류가 발생했습니다.");
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

      if (data.is_final || data.result) {
        setSessionId(null);
        const checked: CheckResult = {
          result: data.result ?? null,
          summary: data.summary ?? null,
          details: Array.isArray(data.details) ? data.details : [],
          notice_id: data.notice_id ?? null,
          raw: data.content ?? undefined,
        };
        setResult(checked);

        setSessionId(null);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.content ?? "",
            isFinal: true,
          },
        ]);
        setNoticePlaceholder("Solar의 질문에 답하고 Ctrl+Enter로 보내세요.");
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.content ?? "",
          },
        ]);
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

  const sendMessage = async (text: string, fieldKey: string | null = null) => {
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
        body: JSON.stringify({ session_id: sessionId, content: text, field_key: fieldKey ?? null }),
      });

      const data = await res.json();

      if (res.status === 503) {
        setSessionId(null);
        setSolarUnavailable(true);
        setError((data as Record<string, unknown>).detail ? String((data as Record<string, unknown>).detail) : "Solar 판정을 사용할 수 없습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Solar 판정 엔진 미설정\n" +
              ((data as Record<string, unknown>).detail ?? "백엔드에 Solar API 키가 설정되어 있지 않거나 호출이 실패했습니다."),
            },
          ]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError((data as Record<string, unknown>).detail ? String((data as Record<string, unknown>).detail) : "메시지 전송 중 오류가 발생했습니다.");
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: "메시지 전송 중 오류가 발생했습니다.\n" + ((data as Record<string, unknown>).detail ?? ""),
          },
        ]);
        setSessionId(null);
        setLoading(false);
        return;
      }

      if (data.is_final || data.result) {
        setSessionId(null);
        const checked: CheckResult = {
          result: data.result ?? null,
          summary: data.summary ?? null,
          details: Array.isArray(data.details) ? data.details : [],
          notice_id: data.notice_id ?? null,
          raw: data.content ?? undefined,
        };
        setResult(checked);

        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.content ?? "",
            isFinal: true,
          },
        ]);
        setSessionId(null);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.content ?? "",
          },
        ]);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachedFileName(null);
      setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
      return;
    }

    const ext = String(file.name).split(".").pop() || "";
    const supported = [
      "pdf", "hwp", "hwpz", "pages", "doc", "docx", "xls", "xlsx",
      "ppt", "pptx", "txt", "csv", "html", "htm", "md", "rtf",
      "png", "jpg", "jpeg", "gif", "webp",
    ];
    const lower = ext.toLowerCase();
    if (!supported.includes(lower)) {
      setFileParseError(
        `지원하지 않는 파일 형식입니다(.${ext}). ` +
          "지원 형식: pdf, hwp, hwpz, doc, docx, xls, xlsx, ppt, pptx, txt, csv, html, md, rtf, png, jpg, jpeg, gif, webp"
      );
      setAttachedFileName(null);
      setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
      e.target.value = "";
      return;
    }

    setAttachedFileName(file.name);
    setFileParseError(null);
    setParsingFile(true);
    setNoticePlaceholder("첨부 파일을 파싱 중입니다...");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${base}/api/document/parse`, {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const data = (await res.json()) as {
        status?: string;
        text?: string;
        detail?: string;
        model?: string;
        character_count?: number;
      };

      if (res.status === 503 || (data.status === "unavailable")) {
        setFileParseError(
          data.detail ||
            "서버에 문서 파싱용 Solar API 키가 설정되어 있지 않습니다. 관리자에게 문의하세요."
        );
        setNoticePlaceholder("문서 파싱이 불가능합니다. 텍스트를 붙여넣어 주세요.");
        setAttachedFileName(null);
        e.target.value = "";
        return;
      }

      if (res.status === 400) {
        setFileParseError(data.detail || "지원하지 않는 파일 형식입니다.");
        setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
        setAttachedFileName(null);
        e.target.value = "";
        return;
      }

      if (!res.ok || data.status === "parse_failed" || !data.text) {
        setFileParseError(
          data.detail ||
            "문서에서 텍스트를 추출하지 못했습니다. 텍스트로 직접 붙여넣어 주세요."
        );
        setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
        setAttachedFileName(null);
        e.target.value = "";
        return;
      }

      setNotice(data.text || "");
      setNoticePlaceholder(
        `첨부 "${file.name}"에서 텍스트를 추출했습니다. (${data.character_count ?? 0}자) Ctrl+Enter로 전송하세요.`
      );
    } catch {
      setFileParseError("파일 전송 중 네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
      setNoticePlaceholder("공고 내용을 붙여넣고 Ctrl+Enter로 전송하세요.");
      setAttachedFileName(null);
      e.target.value = "";
    } finally {
      setParsingFile(false);
    }

    e.target.value = "";
  };

  const submitText = () => {
    const v = notice.trim();
    if (!v) {
      return;
    }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitText();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="청년주택 적격성 워크스페이스"
              className="h-20 w-auto"
            />
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">청년주택 적격성 체크</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                공고 내용을 붙여넣고 보내면 Solar가 신청 가능 여부를 분석해드려요.
                정보가 부족하면 하나씩 물어봐요.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && (
              <button
                type="button"
                onClick={resetCheck}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
              >
                새 공고 분석
              </button>
            )}
            <a
              href="/onboarding"
              className="rounded-md px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              프로필 수정
            </a>
            <button
              type="button"
              onClick={() => setParsedNoticeModalOpen(true)}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
            >
              공고 선택
            </button>
          </div>
        </div>
      </header>

      {/* ===== 데이터 공고 선택 모달 ===== */}
      {parsedNoticeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => setParsedNoticeModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[80vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                공고 선택
              </h3>
              <button
                type="button"
                onClick={() => setParsedNoticeModalOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                닫기
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-2">
              {parsedNoticesLoading && (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
                  <svg className="h-4 w-4 animate-spin text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="text-sm text-[var(--text-secondary)]">
                    공고를 불러오는 중...
                  </span>
                </div>
              )}

              {!parsedNoticesLoading && parsedNotices.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
                   불러올 수 있는 공고 데이터가 없습니다.
                </div>
              )}

              {!parsedNoticesLoading &&
                parsedNotices.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => selectParsedNotice(n.id)}
                    disabled={selectedParsedNoticeId === n.id}
                    className={`w-full text-left rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedParsedNoticeId === n.id
                        ? "ring-1 ring-[var(--primary)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                          {n.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {n.pages !== undefined ? `${n.pages}쪽 · ` : ""}
                          {n.char_count.toLocaleString()}자
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                        선택
                      </span>
                    </div>
                  </button>
                ))}
            </div>

            {parsedNotices.length > 0 && (
              <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 text-xs text-[var(--text-muted)]">
                이 공고로 판정이 바로 시작됩니다. 공고 내용은 공고 전문에서 확인해 주세요.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ===== 좌측: 채팅 패널 (65%) ===== */}
        <aside className="flex flex-col flex-1 w-[65%] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] pb-10">
          <div className="flex flex-col flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* ==== 데이터 공고 선택 목록 (빈 상태에서 표시) ==== */}
            {messages.length === 0 && submittedNotice.trim() === "" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-4 text-center text-sm text-[var(--text-secondary)]">
                  공고 내용을 여기에 붙여넣거나 파일을 올려 주세요.
                </div>

                {parsedNoticesLoading && (
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
                    <svg className="h-4 w-4 animate-spin text-[var(--text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span className="text-sm text-[var(--text-secondary)]">
                      공고를 불러오는 중...
                    </span>
                  </div>
                )}

                {!parsedNoticesLoading && parsedNotices.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
                    불러올 수 있는 공고 데이터가 없습니다.
                  </div>
                )}

                {!parsedNoticesLoading &&
                  parsedNotices.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => selectParsedNotice(n.id)}
                      disabled={selectedParsedNoticeId === n.id}
                      className={`w-full text-left rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedParsedNoticeId === n.id
                          ? "ring-1 ring-[var(--primary)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)] leading-snug">
                            {n.title}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {n.pages !== undefined ? `${n.pages}쪽 · ` : ""}
                            {n.char_count.toLocaleString()}자
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                          선택
                        </span>
                      </div>
                    </button>
                  ))}

                {parsedNotices.length > 0 && (
                  <div className="text-xs text-[var(--text-muted)] text-center">
                    위 공고 중 하나를 선택하면 판정이 바로 시작됩니다.
                  </div>
                )}
              </div>
            )}

            {/* ===== [추가] 채팅 패널 상단에 공고 카드 표시 ===== */}
            {submittedNotice.trim() && (
              <NoticeCard
                notice={submittedNotice}
                attachedFileName={attachedFileName}
                expanded={noticeExpanded}
                onToggle={toggleNotice}
              />
            )}

            {/* 메시지 목록 */}
            {messages.map((m, i) => {
              const lines = m.content.split('\n');
              const isLong = lines.length >= 9;
              return (
                m.role === "user" ? (
                  <div
                    key={i}
                    className="ml-auto max-w-[80%] rounded-2xl bg-[var(--primary)] p-3 text-white"
                  >
                    <div className={isLong && !expandedMsg.has(i) ? 'line-clamp-4' : ''}>
                      {lines.map((line, j) => (
                        <p key={j} className="whitespace-pre-wrap text-sm leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleMsg(i)}
                        className="mt-2 text-xs text-white/70 hover:text-white"
                      >
                        {expandedMsg.has(i) ? '접기' : '펼쳐보기'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="max-w-[80%] rounded-2xl bg-zinc-100 border border-zinc-200 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src="/Upstage_Logo_Purple.svg.webp"
                        alt="Solar"
                        className="h-8 w-auto select-none"
                      />
                      <span className="text-xs font-medium text-zinc-500">Solar</span>
                    </div>
                    <div className={isLong && !expandedMsg.has(i) ? 'line-clamp-4' : ''}>
                      <div className="markdown-body text-sm leading-relaxed text-zinc-900">
                        <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} rehypePlugins={[rehypeRaw]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleMsg(i)}
                        className="mt-2 text-xs text-zinc-500 hover:text-zinc-800"
                      >
                        {expandedMsg.has(i) ? '접기' : '펼쳐보기'}
                      </button>
                    )}
                  </div>
                )
              );
            })}

            {loading && (
              <div className="rounded-lg bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
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

          {/* 입력 영역 (sticky bottom) */}
          <div className="border-t border-[var(--border)] p-3 sticky bottom-3" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex max-w-[620px] items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 shadow-sm mx-auto w-full">
              {/* 왼쪽: 클립 아이콘 버튼 (첨부파일) */}
              <input
                type="file"
                id="chat-file-input"
                accept=".pdf,.hwp,.hwpz,.pages,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.html,.htm,.md,.rtf,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading || parsingFile}
              />
              <button
                type="button"
                onClick={() => document.getElementById('chat-file-input')?.click()}
                disabled={loading || parsingFile}
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] disabled:opacity-40"
                title="공고 파일 첨부"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M10 14 7 17l-1 1"/>
                  <path d="M14 14 17 17l1 1"/>
                </svg>
              </button>

              {/* 가운데: 입력칸 */}
              <textarea
                ref={io}
                value={notice}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="공고 내용을 입력하세요. Enter로 전송, Shift+Enter로 줄바꿈."
                disabled={loading}
                className="flex-1 min-h-[24px] max-h-[200px] resize-none rounded-xl border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
                rows={1}
              />

              {/* 첨부 파일명 뱃지 */}
              {attachedFileName && (
                <span className="shrink-0 rounded-lg bg-sky-100 px-2 py-1 text-xs text-sky-800 truncate max-w-[140px]">
                  {attachedFileName}
                </span>
              )}

              {/* 파일 파싱 에러 뱃지 */}
              {fileParseError && (
                <span className="shrink-0 rounded-lg bg-red-100 px-2 py-1 text-xs text-red-800 truncate max-w-[140px]">
                  {fileParseError}
                </span>
              )}

              {/* 오른쪽: 전송 버튼 */}
              <button
                type="submit"
                disabled={loading || profileLoading || !notice.trim()}
                className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] shadow-sm transition-colors hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : (
                  <svg className="mr-1 inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                )}
                {loading ? "응답 대기..." : sessionId ? "답장" : "전송"}
              </button>
            </div>

            {/* 파싱 중 안내 */}
            {parsingFile && (
              <p className="mt-1.5 text-xs text-center text-[var(--text-muted)]">공고 파일을 파싱하는 중입니다…</p>
            )}
          </div>
        </aside>

        {/* ===== 우측: 정보 패널 (35%) ===== */}
        <main className="flex flex-col flex-1 w-[35%] min-h-0 border-l border-[var(--border)] bg-[var(--background)] overflow-y-auto">
          <div className="px-5 py-5 space-y-5">
            {/* 내 정보 — 판정이 나오기 전까지만 표시. 판정 후에는 결과 카드로 대체 */}
            {profile && !result ? (
              <section className="myinfo-section">
                <div className="flex items-center justify-between">
                  <h2 className="myinfo-section-title">내 정보 (온보딩 저장)</h2>
                  <button
                    type="button"
                    onClick={() => window.location.href = "/onboarding"}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-2"
                  >
                    수정하기
                  </button>
                </div>
                <div className="myinfo-grid">
                  {([
                    ["dob", "생년월일"],
                    ["region", "현재 거주 지역"],
                    ["residence_duration", "거주 기간"],
                    ["housing_status", "무주택 여부"],
                    ["marital_status", "혼인 여부"],
                    ["income_info", "소득"],
                    ["asset_info", "자산"],
                    ["car_value", "자동차 가액"],
                  ] as [string, string][]).map(([k, name]) => {
                    const value = profile[k as keyof typeof profile];
                    const isEmpty = !value || String(value).trim() === '';
                    return (
                      <div
                        key={k}
                        className={`myinfo-tile ${isEmpty ? 'no-value' : ''}`}
                      >
                        <div className="myinfo-tile-name">{name}</div>
                        <div className="myinfo-tile-value">
                          {value ? (
                            <span>{String(value)}</span>
                          ) : (
                            <span className="myinfo-empty-badge">미입력</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button className="myinfo-edit-btn" type="button" onClick={() => window.location.href = "/onboarding"}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    정보 수정하기
                  </button>
                </div>
              </section>
            ) : profileLoading ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  프로필을 불러오는 중...
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 text-sm text-[var(--text-secondary)]">
                <p className="mb-2">프로필을 불러오지 못했습니다.</p>
                <button
                  type="button"
                  onClick={() => window.location.href = "/onboarding"}
                  className="text-[var(--primary)] hover:underline font-medium"
                >
                  온보딩으로 이동하여 정보 입력하기
                </button>
              </div>
            )}
 
            {/* [제거됨] 기존 우측 패널의 "현재 공고" 섹션 — 이제 좌측 채팅 패널 상단으로 이동 */}
 
            <p className="text-xs text-[var(--text-muted)]">
              이 판정은 공고문 근거로 한 1차 확인이며, 최종 입주자격은 시행기관의 심사를 통해
              결정됩니다. 고정 응답 없이 Solar Pro4 응답을 그대로 파싱한 결과입니다.
            </p>
 
            {loading && !result && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 text-sm text-[var(--text-secondary)]">
                분석 중입니다. 공고와 내 정보를 바탕으로 신청 가능 여부를 확인하고 있어요.
              </div>
            )}
 
            {/* 판정 완료 결과 카드 */}
            {result && (
              <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">판정 완료</h2>
                </div>

                {/* 판정 결과: 신청 가능 여부 / 순위 — 좌우 배치 */}
                <div className="flex gap-3">
                  {/* 신청 가능 여부 카드 */}
                  <div className={`flex-1 rounded-xl border-2 p-5 ${badgeClass(result.result)}`}>
                    <div className="text-lg font-semibold">
                      {labelText(result.result)}
                    </div>
                    {result.summary && (
                      <p className="mt-2 text-sm leading-relaxed">
                        {result.summary.replace(/\*\*/g, '')}
                      </p>
                    )}
                  </div>

                  {/* 순위 카드 */}
                  <div className="flex flex-col justify-center rounded-xl border-2 border-zinc-200 bg-zinc-50 p-5">
                    {result.rank ? (
                      <>
                        <div className="text-3xl font-bold text-[var(--text-primary)]">
                          {result.rank}
                        </div>
                        {result.applicant_type && (
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            {result.applicant_type}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-zinc-400">순위 정보 없음</div>
                    )}
                  </div>
                </div>

                {/* 결과 페이지 전용 자격 조건 대조 (중복) */}
                {result.details && result.details.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">자격 조건 대조</h3>
                    <div className="summary-line">
                      {result.details.filter(d => d.result === 'met').length}개 충족 ·
                      {result.details.filter(d => d.result === 'needs_review').length}개 확인 필요 ·
                      {result.details.filter(d => d.result === 'not_met').length}개 미충족
                    </div>
                    <div className="requirement-grid">
                      {result.details.map((d, i) => {
                        return (
                          <div
                            key={i}
                            className="requirement-tile"
                            onClick={(e) => {
                              e.currentTarget.classList.toggle('open');
                            }}
                          >
                            <div className="requirement-tile-head">
                              <div>
                                <div className="requirement-tile-name">{d.requirement_name}</div>
                              </div>
                              <div className="requirement-tile-arrow">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </div>
                            <div className={`requirement-tile-status ${d.result === 'met' ? 'met' : d.result === 'not_met' ? 'not-met' : 'needs-review'}`}>
                              <span className="dot"></span>
                              {verdictLabel(d.result)}
                            </div>
                            <div className="requirement-tile-myinfo">
                              {d.user_info ? (
                                <strong>{d.user_info}</strong>
                              ) : (
                                <span className="text-zinc-500">내 정보 없음</span>
                              )}
                            </div>
                            <div className="requirement-tile-detail">
                              <div className="requirement-tile-detail-inner">
                                <div className="label">공고 기준</div>
                                {d.notice_criteria}
                                {d.notes && d.notes !== '' && (
                                  <div style={{ marginTop: '6px', color: 'var(--text-muted)' }}>
                                    {d.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 신청 전 확인할 사항 (결과 전용) */}
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
                  <div className="text-sm font-medium text-[var(--text-primary)]">신청 전 확인할 사항</div>
                  {result.pre_check ? (
                    <div className="markdown-body text-sm text-[var(--text-secondary)] space-y-1">
                      <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} rehypePlugins={[rehypeRaw]}>
                        {result.pre_check}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc marker:text-[var(--text-muted)]">
                      <li>공고 신청기간과 제출 방법을 시행기관 안내에서 다시 확인하세요.</li>
                      <li>소득·자산·자동차 가액은 사용자가 직접 확인하는 값이 있을 수 있으니, 필요 시 증빙 서류를 준비하세요.</li>
                      <li>이 판정은 공고문 근거로 한 1차 확인이며, 최종 입주자격은 시행기관의 심사를 통해 결정됩니다.</li>
                    </ul>
                  )}
                </section>

                <p className="text-xs text-[var(--text-muted)]">
                  이 판정은 공고문 근거로 한 1차 확인이며, 최종 입주자격은 시행기관의 심사를 통해
                  결정됩니다. 고정 응답 없이 Solar Pro4 응답을 그대로 파싱한 결과입니다.
                </p>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
