import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  Heart,
  ImagePlus,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Modal } from "./MarkdownView";
import { StatusIcon } from "./StatusIcon";
import { date, errorText, request, statusLabels } from "./types";
import type {
  Guide,
  Participant,
  Session,
  Submission,
  WallItem,
  WallResponse,
} from "./types";

export function Auth({
  session,
  mode,
  close,
  onSuccess,
}: {
  session: Session;
  mode: "join" | "login" | "setup";
  close: () => void;
  onSuccess: (session: Session) => void;
}) {
  const [currentMode, setMode] = useState(mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await request<Pick<Session, "user" | "csrf">>(
        "/" + (currentMode === "join" ? "register" : currentMode),
        "POST",
        {
          name: form.get("name"),
          password: form.get("password"),
          ...(currentMode === "join"
            ? { inviteCode: form.get("inviteCode") || "" }
            : {}),
        },
        session.csrf,
      );
      onSuccess({ ...session, ...result, setupRequired: false });
      close();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        currentMode === "setup"
          ? "Create facilitator account"
          : currentMode === "join"
            ? "Join the workshop"
            : "Welcome back"
      }
      close={close}
    >
      {currentMode !== "setup" && (
        <div className="segmented">
          <button
            className={currentMode === "join" ? "selected" : ""}
            onClick={() => {
              setMode("join");
              setError("");
            }}
          >
            Join
          </button>
          <button
            className={currentMode === "login" ? "selected" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
        </div>
      )}
      <form onSubmit={submit} className="form-stack">
        <label>
          Your name
          <input
            name="name"
            autoComplete="username"
            required
            minLength={2}
            maxLength={60}
            autoFocus
            placeholder="Alex Morgan"
          />
        </label>
        <label>
          {currentMode === "login" ? "Passphrase" : "Choose a passphrase"}
          <input
            type="password"
            name="password"
            autoComplete={
              currentMode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={12}
            maxLength={128}
            placeholder="At least 12 characters"
          />
        </label>
        {currentMode === "join" && session.inviteRequired && (
          <label>
            Workshop invite code
            <input name="inviteCode" required autoComplete="off" />
          </label>
        )}
        {currentMode === "join" && (
          <p className="privacy-note">
            <ShieldCheck size={17} />
            Your name, checkmarks, notes and submissions are visible to the
            facilitator. Images reach the completion wall only with your consent,
            facilitator approval, 15/15 completion and board release. Do not use
            an organizational password.
          </p>
        )}
        {currentMode === "setup" && (
          <p className="privacy-note">
            <ShieldCheck size={17} />
            Local owner setup. This account can see participant notes and
            screenshots. Keep this passphrase private.
          </p>
        )}
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : currentMode === "setup"
              ? "Create facilitator account"
              : currentMode === "join"
                ? "Join workshop"
                : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  );
}

export function SubmitView({
  session,
  submission,
  setSubmission,
  done,
  notify,
}: {
  session: Session;
  submission: Submission | null;
  setSubmission: (value: Submission | null) => void;
  done: number;
  notify: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remaining = Math.max(0, 15 - done);
  const eligibility = !submission ? '' : !submission.consent
    ? 'Private: you did not consent to wall sharing.'
    : submission.status === 'pending'
      ? `Awaiting facilitator review. The wall also requires 15/15 completed steps; ${done}/15 are complete.`
      : submission.status === 'changes-requested'
        ? 'Changes requested: replace or update this submission for another review.'
        : remaining > 0
          ? `Approved, but not on the kudos wall yet. Complete the remaining ${remaining} ${remaining === 1 ? 'step' : 'steps'} (${done}/15 complete).`
          : 'Approved and ready for the kudos wall whenever the facilitator has released it.';
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  function chooseFile(selected: File | null) {
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : "");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a screenshot first.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("image", file);
    form.set("consent", form.get("consent") ? "true" : "false");
    form.delete("redacted");
    setBusy(true);
    setError("");
    try {
      const result = await request<{ submission: Submission }>(
        "/submissions",
        "POST",
        form,
        session.csrf,
      );
      setSubmission(result.submission);
      chooseFile(null);
      notify("Screenshot submitted for facilitator review.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content">
      <div className="eyebrow">Workshop evidence</div>
      <h1>Your finish line</h1>
      <p className="lead">
        A checked answer. A report. One moment worth sharing.
      </p>
      <div className="completion-band">
        <Award size={32} />
        <div>
          <strong>{done} of 15 steps complete</strong>
          <p>Self-reported progress · not deployment certification</p>
        </div>
      </div>
      {submission && (
        <section className="submission-current">
          <div className="section-heading">
            <h2>Your submission</h2>
            <span className={"badge " + submission.status}>
              {submission.status.replaceAll("-", " ")}
            </span>
          </div>
          <img
            src={"/api/submissions/" + submission.id + "/image"}
            alt="Your workshop submission"
          />
          <p>{submission.caption}</p>
          {submission.feedback && (
            <blockquote>
              <strong>Facilitator feedback</strong>
              <p>{submission.feedback}</p>
            </blockquote>
          )}
          <p className={'wall-eligibility ' + (submission.status === 'approved' && remaining === 0 && submission.consent ? 'eligible' : '')} role="status">
            <strong>Kudos wall:</strong> {eligibility}
          </p>
          <div className="toolbar">
            <span className="muted">
              Wall requires consent + facilitator approval + 15/15 completed steps + board release
            </span>
            <button
              className="button danger"
              onClick={async () => {
                if (!confirm("Remove this screenshot and its kudos?")) return;
                try {
                  await request("/submissions", "DELETE", {}, session.csrf);
                  setSubmission(null);
                  notify("Submission removed.");
                } catch (caught) {
                  setError(errorText(caught));
                }
              }}
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        </section>
      )}
      <form onSubmit={submit} className="upload-form">
        <h2>{submission ? "Replace your screenshot" : "Share your result"}</h2>
        <p className="muted">
          PNG, JPEG or WebP · maximum 5 MB. Remove private subscription IDs,
          account details, resource names, keys and costs before uploading.
        </p>
        <label className="upload-zone">
          <ImagePlus size={30} />
          <strong>{file ? file.name : "Choose a screenshot"}</strong>
          <span>Validated answer, report or workshop result</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Workshop screenshot"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected && selected.size > 5 * 1024 * 1024) {
                setError("The image exceeds 5 MB.");
                chooseFile(null);
              } else {
                setError("");
                chooseFile(selected ?? null);
              }
            }}
          />
        </label>
        {preview && (
          <img
            className="upload-preview"
            src={preview}
            alt="Screenshot preview before submission"
          />
        )}
        <label>
          What did you accomplish?
          <textarea
            name="caption"
            required
            minLength={3}
            maxLength={500}
            placeholder="My local Agent ACO answer and the matching Excel report…"
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="redacted" required />I have removed
          sensitive information from this image.
        </label>
        <label className="check-label">
          <input type="checkbox" name="consent" />
          Share my name, caption and screenshot with signed-in workshop
          participants after facilitator approval and board release.
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Uploading…" : "Submit for review"}
          <ArrowRight size={17} />
        </button>
      </form>
    </section>
  );
}

export function Wall({
  session,
  notify,
}: {
  session: Session;
  notify: (message: string) => void;
}) {
  const [items, setItems] = useState<WallItem[]>([]);
  const [released, setReleased] = useState(false);
  const [releasedAt, setReleasedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<WallItem | null>(null);
  async function load() {
    try {
      const result = await request<WallResponse>("/wall");
      setItems(result.items);
      setReleased(result.released);
      setReleasedAt(result.releasedAt);
      setError("");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    request<WallResponse>("/wall").then(result => { if (!cancelled) { setItems(result.items); setReleased(result.released); setReleasedAt(result.releasedAt); setLoading(false); } }).catch(caught => { if (!cancelled) { setError(errorText(caught)); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  async function setBoard(next: boolean) {
    if (!confirm(next
      ? `Release ${items.length} eligible ${items.length === 1 ? 'photo' : 'photos'} to signed-in participants?`
      : 'Close the Kudos board? Participant photos will be hidden until you release it again.')) return;
    try {
      const state = await request<Omit<WallResponse, 'items'>>('/admin/wall', 'PUT', { released: next }, session.csrf);
      setReleased(state.released);
      setReleasedAt(state.releasedAt);
      await load();
      notify(next ? 'Kudos board released to participants.' : 'Kudos board closed; approved photos remain saved.');
    } catch (caught) {
      setError(errorText(caught));
    }
  }
  return (
    <section className="page-content wide-content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Made it together</div>
          <h1>Workshop kudos</h1>
        </div>
        <button
          className="icon-button"
          title="Refresh completion wall"
          aria-label="Refresh completion wall"
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <p className="lead">Real work, shared by the people who built it.</p>
      <p className="muted">
        15 self-reported steps complete · consented screenshots · facilitator
        reviewed · board released
      </p>
      {session.user?.role === 'admin' && (
        <section className={'board-release-panel ' + (released ? 'released' : 'closed')}>
          <div>
            <span className="eyebrow">Facilitator publishing</span>
            <h2>{released ? 'Kudos board released' : 'Kudos board closed'}</h2>
            <p>{released
              ? `Participants can see eligible photos${releasedAt ? ` · released ${date(releasedAt)}` : ''}.`
              : `Previewing ${items.length} eligible ${items.length === 1 ? 'photo' : 'photos'}. Participants cannot see these photos yet.`}</p>
          </div>
          <button className={'button ' + (released ? 'secondary' : 'primary')} onClick={() => void setBoard(!released)}>
            {released ? <LockKeyhole size={17} /> : <Send size={17} />}
            {released ? 'Close board' : 'Release board'}
          </button>
        </section>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="empty-state">Loading the completion wall…</div>
      ) : !released && session.user?.role !== 'admin' ? (
        <div className="empty-state">
          <LockKeyhole size={42} />
          <h2>The facilitator is reviewing workshop photos</h2>
          <p>Photos will appear here after the Kudos board is released.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Award size={42} />
          <h2>The first finish is still ahead</h2>
          <p>No approved completion screenshots yet.</p>
        </div>
      ) : (
        <div className="wall-grid">
          {items.map((item) => (
            <article className="wall-card" key={item.id}>
              <button
                className="image-button"
                aria-label={"View " + item.name + " screenshot"}
                onClick={() => setExpanded(item)}
              >
                <img
                  src={"/api/submissions/" + item.id + "/image"}
                  alt={item.caption}
                />
              </button>
              <div className="wall-body">
                <div className="section-heading">
                  <h2>{item.name}</h2>
                  <Award size={20} className="gold" />
                </div>
                <p>{item.caption}</p>
                <footer>
                  <span>{date(item.createdAt)}</span>
                  <button
                    title={
                      item.applauded ? "Remove kudos" : "Give kudos"
                    }
                    aria-label={"Kudos for " + item.name}
                    aria-pressed={item.applauded}
                    aria-disabled={!released}
                    disabled={!released}
                    onClick={async () => {
                      try {
                        await request(
                          "/wall/" + item.id + "/kudos",
                          "POST",
                          {},
                          session.csrf,
                        );
                        await load();
                        notify(
                          item.applauded ? "Kudos removed." : "Kudos sent.",
                        );
                      } catch (caught) {
                        setError(errorText(caught));
                      }
                    }}
                  >
                    <Heart
                      size={17}
                      fill={item.applauded ? "currentColor" : "none"}
                    />
                    {item.kudos}
                  </button>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}
      {expanded && (
        <Modal
          title={expanded.name + " · Workshop result"}
          close={() => setExpanded(null)}
          wide
        >
          <img
            className="expanded-image"
            src={"/api/submissions/" + expanded.id + "/image"}
            alt={expanded.caption}
          />
          <p>{expanded.caption}</p>
        </Modal>
      )}
    </section>
  );
}

export function Admin({
  guide,
  session,
  notify,
}: {
  guide: Guide;
  session: Session;
  notify: (message: string) => void;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState('');
  const [resetError, setResetError] = useState('');
  const reviewAlert = useRef<HTMLDivElement>(null);
  useEffect(() => { if (actionError) reviewAlert.current?.scrollIntoView({ block: 'nearest' }); }, [actionError]);
  const [updated, setUpdated] = useState("");
  const [busy, setBusy] = useState(false);
  const steps = guide.sections.filter((section) => section.step);
  const count = (person: Participant) =>
    steps.filter((step) =>
      person.progress.some(
        (item) => item.unit === step.id && item.status === "done",
      ),
    ).length;
  async function load() {
    try {
      const result = await request<{ participants: Participant[] }>(
        "/admin/participants",
      );
      setParticipants(result.participants);
      setUpdated(new Date().toISOString());
      setError("");
    } catch (caught) {
      setError(errorText(caught));
    }
  }
  useEffect(() => {
    let cancelled = false;
    const refresh = () => request<{ participants: Participant[] }>("/admin/participants").then(result => { if (!cancelled) { setParticipants(result.participants); setUpdated(new Date().toISOString()); setError(""); } }).catch(caught => { if (!cancelled) setError(errorText(caught)); });
    void refresh();
    const interval = setInterval(refresh, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  async function review(status: string, feedback: string) {
    if (!selected?.submission) return;
    const selectedDone = count(selected);
    setBusy(true);
    setActionError('');
    try {
      await request(
        "/admin/submissions/" + selected.submission.id,
        "PUT",
        { status, feedback },
        session.csrf,
      );
      if (status === 'approved') {
        notify(!selected.submission.consent
          ? 'Screenshot approved; it remains private because sharing consent is off.'
          : selectedDone === 15
            ? 'Screenshot approved and ready for facilitator board release.'
            : `Screenshot approved; the kudos wall waits for ${15 - selectedDone} remaining ${15 - selectedDone === 1 ? 'step' : 'steps'} (${selectedDone}/15).`);
      } else notify('Changes requested; the screenshot is not on the kudos wall.');
      setSelected(null);
      await load();
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  const pending = participants.filter(
    (person) => person.submission?.status === "pending",
  ).length;
  const blocked = participants.filter((person) =>
    person.progress.some((item) => item.status === "blocked"),
  ).length;
  const finished = participants.filter((person) => count(person) === 15).length;
  const filtered = participants.filter(
    (person) =>
      person.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "blocked" &&
          person.progress.some((item) => item.status === "blocked")) ||
        (filter === "pending" && person.submission?.status === "pending") ||
        (filter === "finished" && count(person) === 15)),
  );
  function exportRoster() {
    const cell = (value: string) =>
      '"' +
      (/^[=+@\-\t\r]/.test(value) ? "'" : "") +
      value.replaceAll('"', '""') +
      '"';
    const rows = [
      ["Name", "Completed steps", "Blocked checkpoints", "Submission status"],
      ...participants.map((person) => [
        person.name,
        String(count(person)),
        String(
          person.progress.filter((item) => item.status === "blocked").length,
        ),
        person.submission?.status ?? "none",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(cell).join(",")).join("\r\n")], {
        type: "text/csv",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "workshop-roster.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="page-content wide-content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Facilitator workspace</div>
          <h1>The room, at a glance</h1>
        </div>
        <button className="button secondary" onClick={exportRoster}>
          <Download size={16} />
          Export roster
        </button>
      </div>
      <p className="lead">
        Participant-reported checkpoints and submitted evidence.
      </p>
      <div className="metrics">
        <div>
          <Users />
          <strong>{participants.length}</strong>
          <span>Participants</span>
        </div>
        <div>
          <CircleAlert />
          <strong>{blocked}</strong>
          <span>Need attention</span>
        </div>
        <div>
          <ImagePlus />
          <strong>{pending}</strong>
          <span>Awaiting review</span>
        </div>
        <div>
          <Award />
          <strong>{finished}</strong>
          <span>15 steps reported</span>
        </div>
      </div>
      <div className="roster-toolbar">
        <label className="search-box">
          <input
            aria-label="Search participants"
            placeholder="Find a participant"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter participants"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Everyone</option>
          <option value="blocked">Needs attention</option>
          <option value="pending">Awaiting review</option>
          <option value="finished">15 steps complete</option>
        </select>
        <button
          className="icon-button"
          title="Refresh roster"
          aria-label="Refresh roster"
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <h2>
            {participants.length
              ? "No matching participants"
              : "Your workshop starts here"}
          </h2>
          <p>
            {participants.length
              ? "Try another name or filter."
              : "No participants have joined this server yet."}
          </p>
        </div>
      ) : (
        <div className="table-scroll roster">
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Checkpoint map</th>
                <th>Completed</th>
                <th>Evidence</th>
                <th>Last sign-in</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((person) => (
                <tr key={person.id}>
                  <td>
                    <strong>{person.name}</strong>
                    {person.progress.some(
                      (item) => item.status === "blocked",
                    ) && (
                      <span className="needs-attention">Needs attention</span>
                    )}
                  </td>
                  <td>
                    <div className="step-map">
                      {steps.map((step) => {
                        const status =
                          person.progress.find((item) => item.unit === step.id)
                            ?.status ?? "todo";
                        return (
                          <span
                            key={step.id}
                            className={status}
                            title={`${step.title}: ${statusLabels[status]}`}
                          >
                            {step.step}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>{count(person)} / 15</td>
                  <td>
                    <span
                      className={"badge " + (person.submission?.status ?? "")}
                    >
                      {person.submission?.status.replaceAll("-", " ") ??
                        "Not submitted"}
                    </span>
                    {person.submission?.status === 'approved' && person.submission.consent === 1 && count(person) < 15 && (
                      <small className="wall-waiting">Wall waits: {count(person)}/15</small>
                    )}
                  </td>
                  <td className="muted">{date(person.lastSeen)}</td>
                  <td>
                    <button
                      className="icon-button"
                      title={"Review " + person.name}
                      aria-label={"Review " + person.name}
                      onClick={() => { setActionError(''); setResetError(''); setSelected(person); }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {updated && (
        <p className="sync-line">
          Updated {date(updated)} · guide revision {guide.revision}
        </p>
      )}
      {selected && (
        <Modal
          title={selected.name + " · Checkpoint review"}
          close={() => setSelected(null)}
          wide
        >
          <div className="review-layout">
            <div>
              <h3>Reported checkpoints</h3>
              {steps.map((step) => {
                const state = selected.progress.find(
                  (item) => item.unit === step.id,
                );
                return (
                  <div className="review-step" key={step.id}>
                    <span
                      className={"status-icon " + (state?.status ?? "todo")}
                    >
                      <StatusIcon status={state?.status ?? "todo"} />
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{statusLabels[state?.status ?? "todo"]}</small>
                      {state?.note && <p>{state.note}</p>}
                    </div>
                  </div>
                );
              })}
              <details className="reset-account">
                <summary>Reset participant passphrase</summary>
                <form
                  className="form-stack"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    setResetError('');
                    try {
                      await request(
                        "/admin/participants/" +
                          selected.id +
                          "/reset-password",
                        "POST",
                        { password: form.get("password") },
                        session.csrf,
                      );
                      notify("Passphrase changed; previous sessions revoked.");
                    } catch (caught) {
                      setResetError(errorText(caught));
                    }
                  }}
                >
                  <input
                    aria-label="New participant passphrase"
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    placeholder="New private passphrase"
                    autoComplete="new-password"
                  />
                  {resetError && <div className="error-banner" role="alert">{resetError}</div>}
                  <button className="button secondary">Reset passphrase</button>
                </form>
              </details>
            </div>
            <div>
              {selected.submission ? (
                <>
                  <img
                    className="expanded-image"
                    src={
                      "/api/submissions/" + selected.submission.id + "/image"
                    }
                    alt={selected.submission.caption}
                  />
                  <p>{selected.submission.caption}</p>
                  <p className="privacy-note">
                    {selected.submission.consent
                      ? count(selected) === 15
                        ? "Wall eligible: sharing consent is on and 15/15 steps are reported complete. Approval adds it to the private facilitator preview; releasing the board publishes it to participants."
                        : `Sharing consent is on, but only ${count(selected)}/15 steps are reported complete. Approval queues the screenshot; it stays out of the facilitator release set until 15/15.`
                      : "Participant has not consented to wall sharing. Approval keeps this image private."}
                  </p>
                  <form
                    className="form-stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void review(
                        "approved",
                        String(form.get("feedback") ?? ""),
                      );
                    }}
                  >
                    <label>
                      Review note
                      <textarea
                        name="feedback"
                        maxLength={1000}
                        defaultValue={selected.submission.feedback}
                        placeholder="What is visibly confirmed, or what needs another look?"
                      />
                    </label>
                    {actionError && <div ref={reviewAlert} className="error-banner" role="alert">{actionError}</div>}
                    <div className="toolbar">
                      <button className="button primary" disabled={busy}>
                        <Check size={17} />
                        Approve screenshot
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={(event) => {
                          const form = event.currentTarget.closest("form")!;
                          void review(
                            "changes-requested",
                            String(new FormData(form).get("feedback") ?? ""),
                          );
                        }}
                      >
                        Request changes
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="empty-state">
                  <ImagePlus size={34} />
                  <p>No screenshot submitted.</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
