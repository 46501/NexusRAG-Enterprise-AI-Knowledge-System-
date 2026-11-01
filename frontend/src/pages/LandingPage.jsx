import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMe, login } from "../services/auth";

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
    email: "hr@demo.com",
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
    email: "engineering@demo.com",
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
    email: "finance@demo.com",
    question: "What is the expense reimbursement limit?",
    answer:
      "Individual contributors may approve purchases up to $500 per transaction within an approved budget line. People managers have authority up to $5,000, directors up to $25,000, and VPs up to $100,000. Any transaction exceeding $500,000 requires CEO and board approval. Approval must be obtained before committing — retroactive approval is not permitted.",
    source: "budget_policy.txt",
    score: "97%",
  },
};

const DEPTS = [
  {
    email: "hr@demo.com",
    password: "hr-demo-2026",
    key: "hr",
    name: "Human Resources",
    accent: "#8b5cf6",
    tagline: "Policies, benefits, compensation, and employee handbooks.",
  },
  {
    email: "engineering@demo.com",
    password: "eng-demo-2026",
    key: "engineering",
    name: "Engineering",
    accent: "#0ea5e9",
    tagline: "Runbooks, architecture decisions, and incident postmortems.",
  },
  {
    email: "finance@demo.com",
    password: "fin-demo-2026",
    key: "finance",
    name: "Finance",
    accent: "#10b981",
    tagline: "Budget policy, expense guidelines, and audit documentation.",
  },
  {
    email: "admin@example.com",
    password: "admin-demo-2026",
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
      { name: "Qdrant", desc: "Vector store" },
      { name: "BM25s", desc: "Sparse retrieval" },
      { name: "Hybrid Search", desc: "BM25 + dense fusion" },
      { name: "RRF Fusion", desc: "Reciprocal rank fusion" },
      { name: "bge-small", desc: "Embeddings" },
    ],
  },
  {
    label: "GENERATION",
    items: [
      { name: "GPT-4o-mini", desc: "Answer generation" },
      { name: "cross-encoder", desc: "Result reranking" },
    ],
  },
  {
    label: "INFRASTRUCTURE",
    items: [
      { name: "FastAPI", desc: "Async Python API" },
      { name: "PostgreSQL", desc: "User store" },
      { name: "React", desc: "Frontend" },
      { name: "Traefik", desc: "Reverse proxy + TLS" },
      { name: "Docker", desc: "Containerized deployment" },
      { name: "JWT", desc: "Auth tokens" },
    ],
  },
  {
    label: "SECURITY",
    items: [
      { name: "RBAC", desc: "Role-gated retrieval" },
      { name: "HttpOnly Cookies", desc: "XSS protection" },
      { name: "Rate Limiting", desc: "Brute force protection" },
    ],
  },
  {
    label: "OBSERVABILITY",
    items: [
      { name: "LangSmith", desc: "Query tracing" },
      { name: "RAGAS", desc: "RAG evaluation" },
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
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        height: 404,
      }}
    >
      {/* header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
          background: `${convo.accent}18`,
          transition: "background 0.3s, opacity 0.22s",
          opacity,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: convo.accent,
            display: "inline-block",
            boxShadow: `0 0 5px ${convo.accent}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          {convo.name}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.58rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Preview
        </span>
      </div>

      {/* messages — flex:1 so they fill the remaining height, fade at bottom */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            height: "100%",
            boxSizing: "border-box",
            overflowY: "hidden",
            scrollbarWidth: "none",
            transition: "opacity 0.22s",
            opacity,
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div
              style={{
                background: convo.bubbleAccent,
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "14px 4px 14px 14px",
                fontSize: "0.8rem",
                maxWidth: "75%",
                lineHeight: 1.5,
              }}
            >
              {convo.question}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.82)",
                padding: "10px 14px",
                borderRadius: "4px 14px 14px 14px",
                fontSize: "0.8rem",
                maxWidth: "88%",
                lineHeight: 1.6,
                minHeight: 20,
              }}
            >
              {displayed || " "}
              {!done && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: "0.9em",
                    background: "rgba(255,255,255,0.5)",
                    marginLeft: 2,
                    verticalAlign: "text-bottom",
                    animation: "blink 0.8s step-end infinite",
                  }}
                />
              )}
            </div>

            {done && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 9999,
                  fontSize: "0.7rem",
                  color: "rgba(255,255,255,0.5)",
                  animation: "fadeIn 0.35s ease",
                }}
              >
                <span
                  style={{
                    background: convo.chipBg,
                    color: convo.chipText,
                    border: `1px solid ${convo.chipBorder}`,
                    borderRadius: 9999,
                    padding: "1px 6px",
                    fontSize: "0.65rem",
                    fontWeight: 500,
                  }}
                >
                  {convo.label}
                </span>
                {convo.source}
                <span style={{ color: "rgba(255,255,255,0.25)" }}>{convo.score}</span>
              </div>
            )}
          </div>
        </div>

        {/* fade-out gradient so text doesn't hard-clip */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            background: "linear-gradient(to bottom, transparent, #0d0d0d)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* grayed input — signals non-interactive */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          opacity: 0.4,
        }}
      >
        <div
          style={{
            padding: "7px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.2)",
            cursor: "default",
          }}
        >
          {convo.label === "hr" ? "Ask about HR policies…" : convo.label === "engineering" ? "Ask about Engineering docs…" : "Ask about Finance docs…"}
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

function HeroDeptCard({ dept, onEnter, loading, active, onHover, onLeave }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const borderColor = active ? "rgba(255,255,255,0.08)" : hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)";

  return (
    <div
      onClick={() => loading === null && onEnter(dept)}
      onMouseEnter={() => { setHovered(true); onHover(); }}
      onMouseLeave={() => { setHovered(false); setPressed(false); onLeave(); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: active ? `4px solid ${dept.accent}66` : `1px solid ${borderColor}`,
        padding: active ? "12px 20px 12px 17px" : "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: loading !== null ? "not-allowed" : "pointer",
        transition: "background 0.15s, border-color 0.15s, transform 0.1s",
        transform: hovered && !pressed ? "scale(1.005)" : pressed ? "scale(0.99)" : "scale(1)",
        opacity: loading !== null && loading !== dept.email ? 0.4 : 1,
        userSelect: "none",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? dept.accent : `${dept.accent}60`,
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.60)", letterSpacing: "-0.01em" }}>
          {loading === dept.email ? "Signing in…" : dept.name}
        </div>
        <div style={{ fontSize: "0.72rem", color: active ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.30)", marginTop: 2, lineHeight: 1.4 }}>
          {dept.tagline}
        </div>
      </div>

      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 500,
          color: dept.accent,
          opacity: hovered && loading !== dept.email ? 1 : 0,
          transform: hovered && loading !== dept.email ? "translateX(0)" : "translateX(-10px)",
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
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
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

  async function handleEnter(dept) {
    setError(null);
    setLoading(dept.email);
    try {
      await logout();
      await login(dept.email, dept.password);
      const me = await getMe();
      setUser(me);
      const dest = me.role === "admin" ? "/admin-panel" : me.role === "demo_admin" ? "/demo-admin" : "/chat";
      navigate(dest);
    } catch {
      setError("Demo login failed. Make sure demo users are seeded.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ background: "#0f1115", color: "#fff", fontFamily: FONT, overflowX: "hidden" }}>
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
        @media (max-width: 1023px) {
          .hero-section { padding: 48px 24px !important; align-items: flex-start !important; }
          .hero-grid { grid-template-columns: 1fr !important; column-gap: 0 !important; }
          .hero-right { max-width: 100% !important; margin-left: 0 !important; margin-top: 36px !important; }
          .how-it-works-section { padding: 72px 24px !important; }
          .how-it-works-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .how-it-works-step { padding: 28px 24px !important; }
          .built-on-section { padding: 72px 24px !important; }
          .built-on-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 36px !important; }
          .built-on-item { border-left: none !important; padding-left: 0 !important; padding-right: 0 !important; }
          .landing-footer { padding: 24px !important; }
          .landing-header { padding: 14px 24px !important; }
        }
        @media (max-width: 479px) {
          .landing-header { padding: 12px 20px !important; }
          .hero-section { padding: 40px 20px !important; }
          .built-on-grid { grid-template-columns: 1fr !important; }
          .how-it-works-section { padding: 56px 20px !important; }
          .how-it-works-step { padding: 24px 20px !important; }
          .built-on-section { padding: 56px 20px !important; }
        }
      `}</style>

      {/* ── TOP NAV BAR ───────────────────────────────────── */}
      <header
        className="landing-header"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
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
          <span style={{ fontSize: "0.85rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#fff" }}>
            NexusRAG
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user ? (
            <>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.9)",
                  letterSpacing: "-0.01em",
                }}
              >
                {user.full_name || user.email}
              </span>

              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#a78bfa",
                  fontWeight: 600,
                }}
              >
                {user.role}
              </span>

              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.15)",
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
                color: "rgba(255,255,255,0.28)",
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
                color: "#fff",
              }}
            >
              The knowledge base<br />that knows<br />who's asking.
            </h1>

            <p
              style={{
                marginTop: 0,
                fontSize: "0.9rem",
                color: "rgba(255,255,255,0.38)",
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
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Select a role to explore
              </p>
              {DEPTS.map((dept) => (
                <HeroDeptCard
                  key={dept.key}
                  dept={dept}
                  onEnter={handleEnter}
                  loading={loading}
                  active={activeDept === dept.key}
                  onHover={() => handleCardHover(dept.key)}
                  onLeave={handleCardLeave}
                />
              ))}
            </div>

            {error && (
              <p style={{ marginTop: 16, fontSize: "0.75rem", color: "#f87171" }}>{error}</p>
            )}
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
          borderTop: "1px solid rgba(255,255,255,0.12)",
          padding: "120px 48px",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: "0 0 56px 0" }}>
          How it works
        </p>
        <div className="how-it-works-grid">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="how-it-works-step"
            >
              <span className="how-it-works-step-num">
                {step.n}
              </span>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, letterSpacing: "-0.02em", color: "#fff", margin: "0 0 10px 0" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: "0.825rem", color: "rgba(255,255,255,0.40)", lineHeight: 1.65, margin: 0 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.15)",
          padding: "100px 48px",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: "0 0 48px 0" }}>
          Built on
        </p>
        <div className="built-on-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 0 }}>
          {TECH_GROUPS.map((group, i) => (
            <div
              key={group.label}
              className="built-on-item"
              style={{
                borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)",
                paddingLeft: i === 0 ? 0 : 32,
                paddingRight: i === TECH_GROUPS.length - 1 ? 0 : 32,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: MONO,
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.2)",
                  marginBottom: 24,
                }}
              >
                [{group.label}]
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {group.items.map((t) => (
                  <div key={t.name}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
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
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "28px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.18)" }}>rag.shikharjain.com</span>
      </footer>

    </div>
  );
}
