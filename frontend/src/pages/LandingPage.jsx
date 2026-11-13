import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";

const FONT = "'Inter', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'Fira Mono', 'Consolas', monospace";
const MOCK_SPEED = 18;
const MOCK_DELAY = 600;
const HOVER_DEBOUNCE = 300;

const MOCK_CONVOS = {
  hr: {
    accent: "#8b5cf6",
    bubbleAccent: "#7c3aed",
    chipBg: "rgba(139,92,246,0.15)",
    chipBorder: "rgba(139,92,246,0.25)",
    chipText: "#a78bfa",
    label: "hr",
    name: "Human Resources",
    question: "What is the parental leave policy?",
    answer:
      "Apex Systems provides 16 weeks of fully paid parental leave for primary caregivers and 8 weeks for secondary caregivers. Leave may begin up to 2 weeks before the expected due date. Both birth and adoptive parents are eligible, and leave can be taken in one continuous block or split into two periods within the first year.",
    source: "leave_policy.txt",
    score: "94%",
  },
  engineering: {
    accent: "#0ea5e9",
    bubbleAccent: "#0284c7",
    chipBg: "rgba(14,165,233,0.15)",
    chipBorder: "rgba(14,165,233,0.25)",
    chipText: "#38bdf8",
    label: "engineering",
    name: "Engineering",
    question: "How does the deployment pipeline work?",
    answer:
      "All production deployments go through a three-stage pipeline: CI runs tests and builds the artifact, staging receives the build for smoke tests and canary validation, then a manual approval gate triggers the production rollout. Rollbacks are automated — if error rate exceeds 1% within 10 minutes of deploy, the previous artifact is redeployed without human intervention.",
    source: "deployment_runbook.txt",
    score: "91%",
  },
  finance: {
    accent: "#10b981",
    bubbleAccent: "#059669",
    chipBg: "rgba(16,185,129,0.15)",
    chipBorder: "rgba(16,185,129,0.25)",
    chipText: "#34d399",
    label: "finance",
    name: "Finance",
    question: "What is the expense reimbursement limit?",
    answer:
      "Individual contributors may approve purchases up to $500 per transaction within an approved budget line. People managers have authority up to $5,000, directors up to $25,000, and VPs up to $100,000. Any transaction exceeding $500,000 requires CEO and board approval. Approval must be obtained before committing — retroactive approval is not permitted.",
    source: "budget_policy.txt",
    score: "97%",
  },
};

const DEPTS = [
  {
    key: "hr",
    name: "Human Resources",
    accent: "#8b5cf6",
    tagline: "Policies, benefits, compensation, and employee handbooks.",
  },
  {
    key: "engineering",
    name: "Engineering",
    accent: "#0ea5e9",
    tagline: "Runbooks, architecture decisions, and incident postmortems.",
  },
  {
    key: "finance",
    name: "Finance",
    accent: "#10b981",
    tagline: "Budget policy, expense guidelines, and audit documentation.",
  },
  {
    key: "admin",
    name: "Admin Panel",
    accent: "#94a3b8",
    tagline: "Document management, user controls, and live RAGAS evaluation scores.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Select your role",
    desc: "Authenticate as HR, Engineering, or Finance. Your role determines which documents are in scope.",
  },
  {
    n: "02",
    title: "Ask in plain language",
    desc: "No query syntax. No keyword matching. Ask exactly what you need to know.",
  },
  {
    n: "03",
    title: "Get cited answers",
    desc: "Every answer includes the source document and a relevance score. Nothing is made up.",
  },
];

const TECH_GROUPS = [
  {
    label: "RETRIEVAL",
    items: [
      { name: "Qdrant", desc: "Cloud vector store" },
      { name: "BM25s", desc: "Sparse lexical retrieval" },
      { name: "Hybrid Search", desc: "BM25 + dense fusion" },
      { name: "RRF Fusion", desc: "Reciprocal rank fusion" },
      { name: "bge-small-en", desc: "Semantic embeddings" },
    ],
  },
  {
    label: "GENERATION",
    items: [
      { name: "Google Gemini", desc: "Answer generation" },
      { name: "gemini-3.5-flash", desc: "Foundation LLM engine" },
      { name: "Cross-Encoder", desc: "MiniLM neural reranking" },
      { name: "Streaming SSE", desc: "Real-time token synthesis" },
      { name: "Grounding Verifier", desc: "Citation trust verification" },
    ],
  },
  {
    label: "INFRASTRUCTURE",
    items: [
      { name: "FastAPI", desc: "Async Python API" },
      { name: "Supabase PostgreSQL", desc: "Cloud user & auth store" },
      { name: "React 18 & Vite", desc: "Frontend architecture" },
      { name: "Render & Vercel", desc: "Cloud & edge deployment" },
      { name: "Docker", desc: "Containerized deployment" },
    ],
  },
  {
    label: "SECURITY",
    items: [
      { name: "RBAC", desc: "Role-gated retrieval" },
      { name: "Prompt Guardrails", desc: "Injection & firewall guard" },
      { name: "PII Scrubber", desc: "Real-time data redaction" },
      { name: "Audit Trail", desc: "Tamper-evident security logs" },
      { name: "HttpOnly Cookies", desc: "XSS-safe JWT revocation" },
    ],
  },
  {
    label: "OBSERVABILITY",
    items: [
      { name: "LangSmith", desc: "Query tracing & telemetry" },
      { name: "RAGAS", desc: "Evaluation framework" },
      { name: "Trust Scoring", desc: "0-100% confidence meter" },
      { name: "Feedback Loop", desc: "User citation telemetry" },
    ],
  },
];

function useMockTyping(key) {
  const text = MOCK_CONVOS[key].answer;
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    idxRef.current = 0;
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        idxRef.current += 1;
        setDisplayed(text.slice(0, idxRef.current));
        if (idxRef.current >= text.length) {
          clearInterval(intervalRef.current);
          setDone(true);
        }
      }, MOCK_SPEED);
    }, MOCK_DELAY);

    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, [key]);

  return { displayed, done };
}

function MockChatWindow({ deptKey }) {
  const { isDark } = useTheme();
  const [currentKey, setCurrentKey] = useState(deptKey);
  const [opacity, setOpacity] = useState(1);
  const convo = MOCK_CONVOS[currentKey];
  const { displayed, done } = useMockTyping(currentKey);

  useEffect(() => {
    if (deptKey === currentKey) return;
    setOpacity(0);
    const t = setTimeout(() => {
      setCurrentKey(deptKey);
      setOpacity(1);
    }, 220);
    return () => clearTimeout(t);
  }, [deptKey]);

  return (
    <div
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(20, 22, 33, 0.88) 0%, rgba(14, 16, 24, 0.80) 100%)"
          : "linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(248, 250, 252, 0.88) 100%)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
        boxShadow: isDark
          ? "0 28px 60px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
          : "0 24px 48px -10px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        height: 420,
        position: "relative",
      }}
    >
      {/* ── macOS Titlebar / Header ── */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(255, 255, 255, 0.5)",
          position: "relative",
        }}
      >
        {/* Left: macOS Traffic Lights */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, width: 72 }}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#ff5f56",
              border: "1px solid rgba(224, 68, 62, 0.8)",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#ffbd2e",
              border: "1px solid rgba(222, 161, 35, 0.8)",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#27c93f",
              border: "1px solid rgba(26, 171, 41, 0.8)",
              boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
              display: "inline-block",
            }}
          />
        </div>

        {/* Center: Department Indicator & Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            transition: "opacity 0.22s",
            opacity,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: convo.accent,
              boxShadow: `0 0 8px ${convo.accent}`,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            {convo.name}
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 500,
              color: isDark ? "rgba(255, 255, 255, 0.35)" : "#64748b",
            }}
          >
            Workspace
          </span>
        </div>

        {/* Right: Minimal Subtle Preview Pill */}
        <div style={{ display: "flex", justifyContent: "flex-end", width: 72 }}>
          <span
            style={{
              fontSize: "0.58rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: 9999,
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              color: isDark ? "rgba(255, 255, 255, 0.35)" : "#94a3b8",
            }}
          >
            Preview
          </span>
        </div>
      </div>

      {/* ── Messages Container ── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            height: "100%",
            boxSizing: "border-box",
            overflowY: "hidden",
            scrollbarWidth: "none",
            transition: "opacity 0.22s",
            opacity,
          }}
        >
          {/* User Message (macOS Bubble) */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                background: `linear-gradient(135deg, ${convo.bubbleAccent} 0%, ${convo.accent} 100%)`,
                color: "#ffffff",
                padding: "9px 15px",
                borderRadius: "18px 18px 4px 18px",
                fontSize: "0.82rem",
                maxWidth: "78%",
                lineHeight: 1.5,
                fontWeight: 500,
                boxShadow: `0 4px 14px ${convo.bubbleAccent}35`,
                letterSpacing: "-0.01em",
              }}
            >
              {convo.question}
            </div>
          </div>

          {/* Assistant Response (macOS Clean Glass Card) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, alignItems: "flex-start" }}>
            <div
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.09)" : "1px solid #e2e8f0",
                color: isDark ? "rgba(255, 255, 255, 0.90)" : "#0f172a",
                padding: "12px 16px",
                borderRadius: "18px 18px 18px 4px",
                fontSize: "0.82rem",
                maxWidth: "92%",
                lineHeight: 1.62,
                minHeight: 24,
                boxShadow: isDark
                  ? "0 4px 16px rgba(0, 0, 0, 0.2)"
                  : "0 2px 8px rgba(0, 0, 0, 0.04)",
                letterSpacing: "-0.005em",
              }}
            >
              {displayed || " "}
              {!done && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "1em",
                    background: convo.accent,
                    marginLeft: 3,
                    verticalAlign: "text-bottom",
                    animation: "blink 0.8s step-end infinite",
                    borderRadius: 1,
                  }}
                />
              )}
            </div>

            {/* Polished macOS Tag Citation Chip */}
            {done && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "4px 10px 4px 6px",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e2e8f0",
                  background: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
                  backdropFilter: "blur(12px)",
                  borderRadius: 9999,
                  fontSize: "0.72rem",
                  color: isDark ? "rgba(255, 255, 255, 0.7)" : "#475569",
                  animation: "fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: isDark ? "0 2px 8px rgba(0, 0, 0, 0.2)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                  cursor: "pointer",
                }}
              >
                {/* Grounding Confidence Meter Badge */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    fontWeight: 600,
                    fontSize: "0.66rem",
                    padding: "1px 7px",
                    borderRadius: 9999,
                    border: "1px solid rgba(16, 185, 129, 0.30)",
                  }}
                  title="Verified Grounding Confidence"
                >
                  <span>🛡️</span>
                  <span>{convo.score} Grounded</span>
                </span>
                <span
                  style={{
                    background: convo.chipBg,
                    color: convo.chipText,
                    border: `1px solid ${convo.chipBorder}`,
                    borderRadius: 9999,
                    padding: "1px 7px",
                    fontSize: "0.64rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {convo.label}
                </span>
                <span style={{ fontWeight: 500, fontFamily: MONO, fontSize: "0.68rem" }}>
                  {convo.source}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Fade gradient mask */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            background: isDark
              ? "linear-gradient(to bottom, transparent, rgba(15, 17, 26, 0.95))"
              : "linear-gradient(to bottom, transparent, rgba(248, 250, 252, 0.95))",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Modern Floating macOS Input Area ── */}
      <div
        style={{
          padding: "10px 14px 14px 14px",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px 8px 16px",
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.95)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #cbd5e1",
            borderRadius: 16,
            boxShadow: isDark
              ? "0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
              : "0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 #ffffff",
            transition: "all 0.2s ease",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: isDark ? "rgba(255, 255, 255, 0.35)" : "#94a3b8",
              cursor: "default",
              userSelect: "none",
            }}
          >
            {convo.label === "hr"
              ? "Ask anything about HR documents…"
              : convo.label === "engineering"
              ? "Ask anything about Engineering docs…"
              : "Ask anything about Finance docs…"}
          </span>

          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${convo.bubbleAccent} 0%, ${convo.accent} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: `0 2px 6px ${convo.bubbleAccent}40`,
              cursor: "default",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .chat-messages::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function HeroDeptCard({ dept, onEnter, active, onHover, onLeave }) {
  const { isDark } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isHighlighted = hovered || active;
  const borderColor = isDark
    ? (hovered ? "rgba(255,255,255,0.18)" : active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)")
    : (hovered ? "#cbd5e1" : active ? "#e2e8f0" : "#e2e8f0");

  return (
    <div
      onClick={() => onEnter(dept)}
      onMouseEnter={() => { setHovered(true); onHover(); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); onLeave(); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: isDark
          ? (hovered ? "rgba(255,255,255,0.04)" : active ? "rgba(255,255,255,0.02)" : "transparent")
          : (hovered ? "#ffffff" : active ? "#f8fafc" : "#ffffff"),
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: hovered ? `4px solid ${dept.accent}66` : `1px solid ${borderColor}`,
        padding: hovered ? "12px 20px 12px 17px" : "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, transform 0.1s, box-shadow 0.15s",
        transform: hovered && !pressed ? "scale(1.005)" : pressed ? "scale(0.99)" : "scale(1)",
        boxShadow: !isDark ? (hovered ? "0 4px 12px rgba(0,0,0,0.04)" : "0 1px 3px rgba(0,0,0,0.02)") : "none",
        opacity: 1,
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isHighlighted ? dept.accent : `${dept.accent}60`,
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: isDark ? (isHighlighted ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.60)") : (isHighlighted ? "#0f172a" : "#475569"), letterSpacing: "-0.01em" }}>
          {dept.name}
        </div>
        <div style={{ fontSize: "0.72rem", color: isDark ? (isHighlighted ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.30)") : (isHighlighted ? "#475569" : "#64748b"), marginTop: 2, lineHeight: 1.4 }}>
          {dept.tagline}
        </div>
      </div>

      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 500,
          color: dept.accent,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(-10px)",
          transition: "opacity 0.15s, transform 0.15s",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        Open workspace →
      </span>
    </div>
  );
}

export default function LandingPage() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [activeDept, setActiveDept] = useState("hr");
  const hoverTimerRef = useRef(null);

  function handleCardHover(key) {
    if (key === "admin") return;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setActiveDept(key), HOVER_DEBOUNCE);
  }

  function handleCardLeave() {
    clearTimeout(hoverTimerRef.current);
  }

  function handleEnter(dept) {
    // 1. If already authenticated: navigate according to department RBAC
    if (user) {
      if (user.role === "admin" || user.role === "demo_admin") {
        if (dept.key === "admin") {
          navigate(user.role === "admin" ? "/admin-panel" : "/demo-admin");
        } else {
          navigate(`/chat/${dept.key}`);
        }
        return;
      }

      if (user.role.toLowerCase() === dept.key.toLowerCase()) {
        navigate("/chat");
        return;
      }

      // Authenticated user attempting to access unauthorized department -> Access Denied (DO NOT logout)
      navigate(`/chat/${dept.key}`, { state: { targetDepartment: dept.key } });
      return;
    }

    // 2. Unauthenticated visitor -> Redirect to login page
    navigate("/login");
  }

  return (
    <div style={{ background: isDark ? "#0f1115" : "#f8fafc", color: isDark ? "#fff" : "#0f172a", fontFamily: FONT, overflowX: "clip", minHeight: "100vh" }}>
      <style>{`
        .how-it-works-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        .how-it-works-step {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          padding: 36px 30px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .how-it-works-step:hover {
          transform: translateY(-3px);
          border-color: rgba(139, 92, 246, 0.45);
          background: rgba(139, 92, 246, 0.04);
          box-shadow: 0 10px 24px -4px rgba(139, 92, 246, 0.12);
        }
        .how-it-works-step-num {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.22);
          letter-spacing: 0.08em;
          margin-bottom: 20px;
          transition: color 0.25s ease;
        }
        .how-it-works-step:hover .how-it-works-step-num {
          color: #a78bfa;
        }
        .built-on-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        .built-on-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          padding: 28px 22px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
        }
        .built-on-item:hover {
          transform: translateY(-3px);
          border-color: rgba(139, 92, 246, 0.45);
          background: rgba(139, 92, 246, 0.04);
          box-shadow: 0 10px 24px -4px rgba(139, 92, 246, 0.12);
        }
        .built-on-label {
          display: block;
          font-family: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.28);
          margin-bottom: 22px;
          transition: color 0.25s ease;
        }
        .built-on-item:hover .built-on-label {
          color: #a78bfa;
        }
        html.light .how-it-works-step {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        html.light .how-it-works-step:hover {
          border-color: rgba(139, 92, 246, 0.55);
          background: rgba(139, 92, 246, 0.03);
          box-shadow: 0 10px 24px -4px rgba(139, 92, 246, 0.12);
        }
        html.light .how-it-works-step-num {
          color: #94a3b8;
        }
        html.light .how-it-works-step h3 {
          color: #0f172a !important;
        }
        html.light .how-it-works-step p {
          color: #475569 !important;
        }
        html.light .built-on-item {
          background: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        html.light .built-on-item:hover {
          border-color: rgba(139, 92, 246, 0.55);
          background: rgba(139, 92, 246, 0.03);
          box-shadow: 0 10px 24px -4px rgba(139, 92, 246, 0.12);
        }
        html.light .built-on-label {
          color: #94a3b8;
        }
        html.light .built-on-item .tech-name {
          color: #0f172a !important;
        }
        html.light .built-on-item .tech-desc {
          color: #64748b !important;
        }
        @media (max-width: 1023px) {
          .hero-section { padding: 48px 24px !important; align-items: flex-start !important; }
          .hero-grid { grid-template-columns: 1fr !important; column-gap: 0 !important; }
          .hero-right { max-width: 100% !important; margin-left: 0 !important; margin-top: 36px !important; }
          .how-it-works-section { padding: 72px 24px !important; }
          .how-it-works-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .how-it-works-step { padding: 28px 24px !important; }
          .built-on-section { padding: 72px 24px !important; }
          .built-on-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
          .built-on-item { padding: 24px 20px !important; }
          .landing-footer { padding: 24px !important; }
          .landing-header { padding: 14px 24px !important; }
        }
        @media (max-width: 639px) {
          .built-on-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
        }
        @media (max-width: 479px) {
          .landing-header { padding: 12px 16px !important; }
          .landing-nav-actions { gap: 8px !important; }
          .hero-section { padding: 40px 20px !important; }
          .how-it-works-section { padding: 56px 20px !important; }
          .how-it-works-step { padding: 24px 20px !important; }
          .built-on-section { padding: 56px 20px !important; }
          .built-on-item { padding: 20px 18px !important; }
        }
      `}</style>

      {/* ── TOP NAV BAR (STICKY) ────────────────────────── */}
      <header
        className="landing-header-wrapper"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          width: "100%",
          background: isDark ? "rgba(15, 17, 21, 0.90)" : "rgba(248, 250, 252, 0.90)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
          boxShadow: isDark
            ? "0 4px 20px -2px rgba(0, 0, 0, 0.45)"
            : "0 2px 12px -2px rgba(0, 0, 0, 0.06)",
          transition: "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <div
          className="landing-header"
          style={{
            padding: "16px 48px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: 1160,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a78bfa",
                fontSize: "0.85rem",
                fontWeight: 700,
              }}
            >
              N
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "-0.01em", color: isDark ? "#fff" : "#0f172a" }}>
              NexusRAG
            </span>
          </div>

          <div className="landing-nav-actions" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {user ? (
              <>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    color: isDark ? "rgba(255,255,255,0.9)" : "#334155",
                    letterSpacing: "-0.01em",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.full_name || user.email}
                </span>

                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.08)",
                    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(124,58,237,0.2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: isDark ? "#a78bfa" : "#7c3aed",
                    fontWeight: 600,
                  }}
                >
                  {user.role}
                </span>

                {/* Theme toggle placed directly between department badge and Sign Out button */}
                <ThemeToggle />

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (logout) await logout();
                    } catch (err) {
                      console.error("Sign out error:", err);
                    } finally {
                      navigate("/login");
                    }
                  }}
                  style={{
                    background: "transparent",
                    color: isDark ? "rgba(255,255,255,0.5)" : "#64748b",
                    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = isDark ? "#fff" : "#0f172a";
                    e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.3)" : "#94a3b8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = isDark ? "rgba(255,255,255,0.5)" : "#64748b";
                    e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#cbd5e1";
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  style={{
                    background: "transparent",
                    color: isDark ? "#fff" : "#0f172a",
                    border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  style={{
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section
        className="hero-section"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "80px 48px",
          boxSizing: "border-box",
        }}
      >
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "flex-start",
            columnGap: 72,
            width: "100%",
          }}
        >
          {/* left */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: isDark ? "rgba(255,255,255,0.28)" : "#64748b",
                marginBottom: 14,
              }}
            >
              Role-Based Knowledge
            </span>

            <h1
              style={{
                fontSize: "2.475rem",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1.1,
                margin: 0,
                color: isDark ? "#fff" : "#0f172a",
              }}
            >
              The knowledge base<br />that knows<br />who's asking.
            </h1>

            <p
              style={{
                marginTop: 0,
                fontSize: "0.9rem",
                color: isDark ? "rgba(255,255,255,0.38)" : "#475569",
                lineHeight: 1.65,
                letterSpacing: "-0.01em",
                maxWidth: 380,
              }}
            >
              Role-based document retrieval. Every answer cited.
              Built for teams that handle sensitive information.
            </p>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
              <p
                style={{
                  margin: "0 0 14px 0",
                  fontSize: "0.58rem",
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: isDark ? "rgba(255,255,255,0.5)" : "#64748b",
                }}
              >
                Select a role to explore
              </p>
              {DEPTS.map((dept) => (
                <HeroDeptCard
                  key={dept.key}
                  dept={dept}
                  onEnter={handleEnter}
                  active={activeDept === dept.key}
                  onHover={() => handleCardHover(dept.key)}
                  onLeave={handleCardLeave}
                />
              ))}
            </div>
          </div>

          {/* right */}
          <div className="hero-right" style={{ maxWidth: "87%", marginTop: 28, marginLeft: 60 }}>
            <MockChatWindow deptKey={activeDept} />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section
        className="how-it-works-section"
        style={{
          borderTop: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e2e8f0",
          padding: "120px 48px",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: isDark ? "#ffffff" : "#0f172a",
            margin: "0 0 44px 0",
            textAlign: "left"
          }}
        >
          How it works
        </h2>
        <div className="how-it-works-grid">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="how-it-works-step"
            >
              <span className="how-it-works-step-num">
                {step.n}
              </span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.02em", color: isDark ? "#fff" : "#0f172a", margin: "0 0 10px 0" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "0.825rem", color: isDark ? "rgba(255,255,255,0.40)" : "#475569", lineHeight: 1.65, margin: 0 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TECH ─────────────────────────────────────────── */}
      <section
        className="built-on-section"
        style={{
          borderTop: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e2e8f0",
          padding: "100px 48px",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.75rem, 3.2vw, 2.25rem)",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: isDark ? "#ffffff" : "#0f172a",
            margin: "0 0 44px 0",
            textAlign: "left"
          }}
        >
          Built on
        </h2>
        <div className="built-on-grid">
          {TECH_GROUPS.map((group) => (
            <div
              key={group.label}
              className="built-on-item"
            >
              <span className="built-on-label">
                [{group.label}]
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {group.items.map((t) => (
                  <div key={t.name}>
                    <div className="tech-name" style={{ fontSize: "0.875rem", fontWeight: 600, color: isDark ? "#fff" : "#0f172a", letterSpacing: "-0.01em" }}>
                      {t.name}
                    </div>
                    <div className="tech-desc" style={{ fontSize: "0.75rem", color: isDark ? "rgba(255,255,255,0.45)" : "#64748b", marginTop: 2 }}>
                      {t.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer
        className="landing-footer"
        style={{
          borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #e2e8f0",
          padding: "28px 48px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: isDark ? "rgba(255,255,255,0.38)" : "#64748b",
            letterSpacing: "-0.01em",
            textAlign: "center",
          }}
        >
          &copy; 2026 NexusRAG. Built by Om Ashok Kulkarni. All rights reserved.
        </span>
      </footer>

    </div>
  );
}
