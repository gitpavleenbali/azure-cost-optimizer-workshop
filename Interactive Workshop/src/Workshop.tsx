import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Download,
  Layers3,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Play,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { MarkdownView, Modal } from "./MarkdownView";
import { Admin, Auth, SubmitView, Wall } from "./Community";
import { StatusIcon } from "./StatusIcon";
import { introductionId, readRoute, sectionForAnchor } from './navigation';
import { date, errorText, groups, request, statusLabels } from "./types";
import type { Guide, Progress, Session, Status, Submission } from "./types";

export default function Workshop() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [session, setSessionState] = useState<Session>({
    user: null,
    csrf: "",
    setupRequired: false,
    setupAllowed: false,
    inviteRequired: false,
  });
  const [progress, setProgress] = useState<Progress[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [selected, setSelected] = useState(
    () => readRoute(location.pathname, location.hash).anchor,
  );
  const [view, setView] = useState(
    () => readRoute(location.pathname, location.hash).view,
  );
  const [auth, setAuth] = useState<"join" | "login" | "setup" | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 780px)').matches);
  const [search, setSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [account, setAccount] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("workshop-theme") ?? "light",
  );
  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sidebarElement = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const current =
    (guide && sectionForAnchor(guide.sections, selected)) ??
    guide?.sections[0];
  const openGroup = expandedGroup ?? current?.group ?? 'tour';
  const currentProgress = progress.find((item) => item.unit === current?.id);
  const note = drafts[current?.id ?? ""] ?? currentProgress?.note ?? "";
  const userId = session.user?.id;
  function setSession(identity: Session) {
    setSessionState(identity);
    setProgress([]);
    setSubmission(null);
    setDrafts({});
  }
  const done =
    guide?.sections.filter(
      (section) =>
        section.step &&
        progress.some(
          (item) => item.unit === section.id && item.status === "done",
        ),
    ).length ?? 0;
  const percent = Math.round((done / 15) * 100);
  const hasStarted = progress.some(
    (item) => item.status !== "todo" || item.note.trim().length > 0,
  );
  useEffect(() => {
    const query = matchMedia('(max-width: 780px)');
    const changed = () => setNarrow(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (narrow && sidebar) sidebarElement.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [narrow, sidebar]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("workshop-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    Promise.all([request<Guide>("/content"), request<Session>("/session")])
      .then(([content, identity]) => {
        setGuide(content);
        setSession(identity);
      })
      .catch((caught) => setError(errorText(caught)));
  }, []);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    request<{ progress: Progress[]; submission: Submission | null }>(
      "/progress",
    )
      .then((data) => {
        if (cancelled) return;
        setProgress(data.progress);
        setSubmission(data.submission);
      })
      .catch((caught) => { if (!cancelled) setError(errorText(caught)); });
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => {
    const handle = () => {
      const route = readRoute(location.pathname, location.hash);
      setSelected(route.anchor);
      setView(route.view);
      setExpandedGroup(null);
      setSidebar(false);
    };
    window.addEventListener("hashchange", handle);
    window.addEventListener('popstate', handle);
    return () => { window.removeEventListener("hashchange", handle); window.removeEventListener('popstate', handle); };
  }, []);
  useEffect(() => {
    if (!guide || view !== 'guide') return;
    const frame = requestAnimationFrame(() => {
      main.current?.scrollTo({ top: 0, behavior: 'instant' });
      if (selected !== current?.id) document.getElementById(selected)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [guide, selected, current?.id, view]);
  useEffect(() => {
    const expired = () => {
      setSessionState(previous => ({ ...previous, user: null, csrf: '' }));
      setProgress([]);
      setSubmission(null);
      setDrafts({});
      setAccount(false);
      setAuth('login');
      setView('guide');
    };
    window.addEventListener('workshop-session-expired', expired);
    return () => window.removeEventListener('workshop-session-expired', expired);
  }, []);
  function navigate(id: string) {
    const target = guide && sectionForAnchor(guide.sections, id);
    if (target) {
      setSelected(id);
      setExpandedGroup(target.group);
      setView("guide");
      setSidebar(false);
      if (location.pathname + location.hash !== '/#' + id) history.pushState(null, "", "/#" + id);
      main.current?.scrollTo({ top: 0 });
      setTimeout(() => {
        if (target.id !== id)
          document.getElementById(id)?.scrollIntoView({ block: "start" });
        else heading.current?.focus();
      }, 50);
    }
  }
  function openView(next: string) {
    setView(next);
    setSidebar(false);
    history.pushState(
      null,
      "",
      next === "admin" ? "/facilitator" : next === 'submit' ? '/evidence' : next === 'wall' ? '/kudos' : "/#" + selected,
    );
    main.current?.scrollTo({ top: 0 });
  }
  async function save(unit: string, status: Status, text?: string) {
    if (!session.user) {
      setAuth("join");
      return;
    }
    if (!guide || saving) return;
    setSaving(true);
    setError("");
    setToast('');
    try {
      const result = await request<{ progress: Progress[] }>(
        "/progress/" + encodeURIComponent(unit),
        "PUT",
        {
          status,
          note: text ?? progress.find((item) => item.unit === unit)?.note ?? "",
          revision: guide.revision,
        },
        session.csrf,
      );
      setProgress(result.progress);
      setToast(status === "done" ? "Checkpoint saved." : "Progress saved.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }
  const nextStep = guide?.sections.find(
    (section) =>
      section.step &&
      !progress.some(
        (item) => item.unit === section.id && item.status === "done",
      ),
  );
  const neighbors =
    current && guide
      ? {
          previous: guide.sections[guide.sections.indexOf(current) - 1],
          next: guide.sections[guide.sections.indexOf(current) + 1],
        }
      : {};
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside ref={sidebarElement} inert={narrow && !sidebar} aria-label="Workshop navigation" className={"sidebar " + (sidebar ? "is-open" : "")} onKeyDown={event => {
        if (!narrow || !sidebar) return;
        if (event.key === 'Escape') { setSidebar(false); requestAnimationFrame(() => menuButton.current?.focus()); }
        if (event.key === 'Tab') {
          const elements = Array.from(sidebarElement.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input') ?? []);
          const first = elements[0]; const last = elements.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <a
          className="brand"
          href={'/#' + introductionId}
          onClick={(event) => {
            event.preventDefault();
            navigate(introductionId);
          }}
        >
          <span className="brand-mark">
            <Layers3 size={27} />
          </span>
          <span>
            <strong>
              Azure Cost
              <br />
              Intelligence
            </strong>
            <small>WORKSHOP FIELD GUIDE</small>
          </span>
        </a>
        <div className="progress-panel">
          <div className="section-heading">
            <span>Your progress</span>
            <strong>{percent}%</strong>
          </div>
          <progress value={done} max={15} aria-label="Workshop progress" />
          <div className="progress-detail">
            <span>{done} of 15 steps</span>
            <span>{session.user ? "Saved to workshop" : "Not signed in"}</span>
          </div>
          <button
            className="resume-button"
            onClick={() =>
              navigate(
                hasStarted
                  ? nextStep?.id ?? "sprint-2-checkpoint"
                  : "part-1-solution-tour",
              )
            }
          >
            <Play size={14} />
            {hasStarted ? "Continue workshop" : "Start solution tour"}
            <ArrowRight size={15} />
          </button>
        </div>
        <label className="search-box nav-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a section"
            aria-label="Search workshop sections"
          />
        </label>
        <nav aria-label="Workshop sections" className="guide-nav">
          {groups.map((group, groupIndex) => {
            const sections =
              guide?.sections.filter(
                (section) =>
                  section.group === group.id &&
                  (!search ||
                    section.title.toLowerCase().includes(search.toLowerCase())),
              ) ?? [];
            return (
              <div className="nav-group" key={group.id}>
                <button
                  className={
                    "group-button " +
                    (current?.group === group.id && view === "guide"
                      ? "active-group"
                      : "")
                  }
                  aria-expanded={openGroup === group.id || !!search}
                  onClick={() =>
                    setExpandedGroup(openGroup === group.id ? "" : group.id)
                  }
                >
                  <span className="group-number">0{groupIndex + 1}</span>
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.detail}</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
                {(openGroup === group.id || search) && (
                  <div className="nav-sections">
                    {sections.map((section) => {
                      const status =
                        progress.find((item) => item.unit === section.id)
                          ?.status ?? "todo";
                      return (
                        <button
                          key={section.id}
                          className={
                            "section-link " +
                            (current?.id === section.id && view === "guide"
                              ? "active"
                              : "")
                          }
                          aria-current={
                            current?.id === section.id && view === "guide"
                              ? "page"
                              : undefined
                          }
                          onClick={() => navigate(section.id)}
                        >
                          <span className={"status-icon " + status}>
                            <StatusIcon status={status} size={14} />
                          </span>
                          <span>
                            {section.title.replace(/^Step \d+: /, "")}
                          </span>
                          {section.step && (
                            <small>
                              {String(section.step).padStart(2, "0")}
                            </small>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="nav-bottom">
          <button
            className={view === "submit" ? "active" : ""}
            onClick={() =>
              session.user ? openView("submit") : setAuth("join")
            }
          >
            <ClipboardCheck size={18} />
            My evidence
            {submission?.status === "approved" && <Check size={14} />}
          </button>
          <button
            className={view === "wall" ? "active" : ""}
            onClick={() => (session.user ? openView("wall") : setAuth("join"))}
          >
            <Award size={18} />
            Workshop kudos
          </button>
          {session.user?.role === 'admin' && <button
            className={view === "admin" ? "active" : ""}
            onClick={() => openView("admin")}
          >
            <LayoutDashboard size={18} />
            Facilitator
          </button>}
          <a href="/api/guide/download">
            <BookOpen size={18} />
            Original README
            <Download size={14} />
          </a>
        </div>
        <footer className="sidebar-footer">
          <ShieldCheck size={15} />
          <span>Human-reviewed. Evidence-backed.</span>
        </footer>
      </aside>
      <div className="workspace" inert={narrow && sidebar}>
        <header className="topbar">
          <div className="topbar-title">
            <button
              ref={menuButton}
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <span className="eyebrow">HANDS-ON · TWO SPRINTS</span>
              <strong>Azure Cost Optimizer</strong>
            </div>
            <span className="workshop-pill">Interactive workshop</span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {session.user ? (
              <button
                className="account-button"
                onClick={() => setAccount(true)}
              >
                <span className="avatar">
                  {session.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>{session.user.name}</span>
              </button>
            ) : (
              <button
                className="button primary compact"
                onClick={() => setAuth("join")}
              >
                Join workshop
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </header>
        <main id="main" className="main-scroll" ref={main}>
          {error && (
            <div className="error-banner global-error" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError("")}
                title="Dismiss error"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!guide ? (
            <div className="empty-state">
              <Layers3 size={38} />
              <h1>
                {error ? "Workshop unavailable" : "Opening the field guide…"}
              </h1>
              {error && (
                <button
                  className="button secondary"
                  onClick={() => location.reload()}
                >
                  Retry
                </button>
              )}
            </div>
          ) : view === "admin" ? (
            session.user?.role === "admin" ? (
              <Admin guide={guide} session={session} notify={setToast} />
            ) : (
              <section className="page-content">
                <div className="eyebrow">Facilitator workspace</div>
                <h1>
                  {session.setupRequired
                    ? "Set up your workshop"
                    : "Facilitator sign-in"}
                </h1>
                <div className="empty-state">
                  <ShieldCheck size={42} />
                  <p>
                    {session.setupRequired
                      ? session.setupAllowed
                        ? "Create the local facilitator account before participants join."
                        : "The server owner needs to complete setup on the server computer."
                      : "Participant progress and submissions are restricted to the facilitator."}
                  </p>
                  {session.setupRequired ? (
                    session.setupAllowed && (
                      <button
                        className="button primary"
                        onClick={() => setAuth("setup")}
                      >
                        Create facilitator account
                        <ArrowRight size={17} />
                      </button>
                    )
                  ) : (
                    <button
                      className="button primary"
                      onClick={async () => {
                        try {
                          if (session.user) {
                            await request("/logout", "POST", {}, session.csrf);
                            setSession({ ...session, user: null, csrf: "" });
                          }
                          setAuth("login");
                        } catch (caught) {
                          setError(errorText(caught));
                        }
                      }}
                    >
                      Sign in as facilitator
                    </button>
                  )}
                </div>
              </section>
            )
          ) : (view === 'submit' || view === 'wall') && !session.user ? (
            <section className="page-content"><div className="eyebrow">Participant workspace</div><h1>{view === 'submit' ? 'Your evidence' : 'Workshop kudos'}</h1><div className="empty-state"><ShieldCheck size={42} /><p>Sign in to access participant evidence and shared results.</p><button className="button primary" onClick={() => setAuth('login')}>Sign in</button></div></section>
          ) : view === "submit" && session.user ? (
            session.user.role === "admin" ? (
              <section className="page-content">
                <h1>Participant evidence</h1>
                <p className="lead">
                  Review submissions from the facilitator dashboard.
                </p>
                <button
                  className="button primary"
                  onClick={() => openView("admin")}
                >
                  Open dashboard
                </button>
              </section>
            ) : (
              <SubmitView
                session={session}
                submission={submission}
                setSubmission={setSubmission}
                done={done}
                notify={setToast}
              />
            )
          ) : view === "wall" && session.user ? (
            <Wall session={session} notify={setToast} />
          ) : (
            current && (
              <article className="page-content guide-content" key={current.id}>
                <div className="breadcrumb">
                  <span>
                    {groups.find((group) => group.id === current.group)?.label}
                  </span>
                  <ChevronRight size={13} />
                  <span>
                    {current.step
                      ? "Step " + String(current.step).padStart(2, "0")
                      : "Field guide"}
                  </span>
                  <span className="reading-time">
                    <Clock3 size={13} />
                    {current.minutes} min read
                  </span>
                </div>
                <div className="article-heading">
                  <div>
                    <span className="eyebrow">
                      {current.step
                        ? `CHECKPOINT ${String(current.step).padStart(2, "0")} / 15`
                        : "AZURE COST INTELLIGENCE"}
                    </span>
                    <h1 ref={heading} tabIndex={-1}>
                      {current.title
                        .replace(/^Step \d+: /, "")
                        .replace(/^Architecture \d+: /, "")}
                    </h1>
                  </div>
                  {current.step && (
                    <span
                      className={
                        "step-state " + (currentProgress?.status ?? "todo")
                      }
                    >
                      <StatusIcon status={currentProgress?.status ?? "todo"} size={19} />
                      {statusLabels[currentProgress?.status ?? "todo"]}
                    </span>
                  )}
                </div>
                {current.id === "workshop-outcome" && (
                  <div className="journey-strip">
                    <div>
                      <span>01</span>
                      <strong>Connect locally</strong>
                      <small>Sample, evidence, model</small>
                    </div>
                    <ArrowRight size={18} />
                    <div>
                      <span>02</span>
                      <strong>Experience Azure</strong>
                      <small>Deploy, validate, share</small>
                    </div>
                  </div>
                )}
                <MarkdownView
                  section={current}
                  progress={progress}
                  signedIn={!!session.user}
                  navigate={navigate}
                  onTask={(id, checked) =>
                    void save(id, checked ? "done" : "todo")
                  }
                />
                <section className="checkpoint-panel">
                  <div className="section-heading">
                    <h2>
                      {current.step
                        ? "Required checkpoint"
                        : "Reading checkpoint (Optional)"}
                    </h2>
                    <span className="muted">
                      {current.step
                        ? "Counts toward the 15 evaluated steps"
                        : "Does not affect evaluation"}
                    </span>
                  </div>
                  <div className="status-options">
                    {(["todo", "done", "blocked", "deferred"] as Status[]).map(
                      (status) => (
                        <button
                          key={status}
                          className={
                            "status-option " +
                            status +
                            ((currentProgress?.status ?? "todo") === status
                              ? " selected"
                              : "")
                          }
                          aria-pressed={
                            (currentProgress?.status ?? "todo") === status
                          }
                          onClick={() => void save(current.id, status, note)}
                          disabled={saving}
                        >
                          <StatusIcon status={status} />
                          {statusLabels[status]}
                        </button>
                      ),
                    )}
                  </div>
                  <label>
                    Private note to your facilitator
                    <textarea
                      value={note}
                      onChange={(event) => setDrafts({ ...drafts, [current.id]: event.target.value })}
                      maxLength={1200}
                      placeholder="Evidence checked, approval pending, or a blocker. No credentials or private billing details."
                    />
                  </label>
                  <div className="toolbar">
                    <span className="muted">
                      {saving
                        ? "Saving…"
                        : currentProgress
                          ? "Saved " + date(currentProgress.updatedAt)
                          : session.user
                            ? "No checkpoint saved yet"
                            : "Sign in to save your progress"}
                    </span>
                    <button
                      className="button secondary"
                      disabled={saving}
                      onClick={() =>
                        void save(
                          current.id,
                          currentProgress?.status ?? "todo",
                          note,
                        )
                      }
                    >
                      Save note
                    </button>
                  </div>
                </section>
                <nav className="page-navigation" aria-label="Adjacent sections">
                  {neighbors.previous ? (
                    <button onClick={() => navigate(neighbors.previous.id)}>
                      <ArrowLeft size={18} />
                      <span>
                        <small>Previous</small>
                        {neighbors.previous.title.replace(/^Step \d+: /, "")}
                      </span>
                    </button>
                  ) : (
                    <span />
                  )}
                  {neighbors.next && (
                    <button onClick={() => navigate(neighbors.next.id)}>
                      <span>
                        <small>Next</small>
                        {neighbors.next.title.replace(/^Step \d+: /, "")}
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  )}
                </nav>
                <footer className="document-footer">
                  Source: workshop README · revision {guide.revision}
                  <span>Reading or checking a box runs no Azure commands.</span>
                </footer>
              </article>
            )
          )}
        </main>
        <div className="workspace-footer">
          <span>
            <span className="connection-dot" />
            {session.user ? "Connected to workshop" : "Read-only guest"}
          </span>
          <span>Self-reported progress · human-reviewed results</span>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {auth && (
        <Auth
          session={session}
          mode={auth}
          close={() => setAuth(null)}
          onSuccess={(identity) => {
            setSession(identity);
            setToast(
              identity.user?.role === "admin"
                ? "Facilitator account ready."
                : "Your workshop is ready.",
            );
          }}
        />
      )}
      {account && (
        <Modal title="Your workshop account" close={() => setAccount(false)}>
          <div className="form-stack">
            <p>
              <strong>{session.user?.name}</strong> ·{" "}
              {session.user?.role === "admin" ? "Facilitator" : "Participant"}
            </p>
            <p className="privacy-note">
              Your progress is stored on this workshop server. It follows your
              account, not this browser. A different local server has a separate
              roster.
            </p>
            <a className="button secondary" href="/api/me/export">
              <Download size={17} />
              Export my progress
            </a>
            <button
              className="button secondary"
              onClick={async () => {
                try {
                  await request("/logout", "POST", {}, session.csrf);
                  setSession({ ...session, user: null, csrf: "" });
                  setAccount(false);
                  openView("guide");
                } catch (caught) {
                  setError(errorText(caught));
                }
              }}
            >
              <LogOut size={17} />
              Sign out
            </button>
            {session.user?.role === "participant" && (
              <button
                className="button danger"
                onClick={async () => {
                  if (
                    !confirm(
                      "Permanently delete your account, progress, notes, screenshot and kudos?",
                    )
                  )
                    return;
                  try {
                    await request("/me", "DELETE", {}, session.csrf);
                    setSession({ ...session, user: null, csrf: "" });
                    setAccount(false);
                    openView("guide");
                    setToast("Your workshop data was deleted.");
                  } catch (caught) {
                    setError(errorText(caught));
                  }
                }}
              >
                <Trash2 size={17} />
                Delete my workshop data
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
