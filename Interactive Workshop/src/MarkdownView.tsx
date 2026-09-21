import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Expand, X, Download } from "lucide-react";
import type { ReactNode } from "react";
import type { Section, Progress } from "./types";

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
let sequence = 0;
let renderQueue = Promise.resolve();
export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={wide ? "modal modal-wide" : "modal"}
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={close}
          title="Close"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
function Diagram({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    renderQueue = renderQueue.then(async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
        });
        const result = await mermaid.render(
          "workshop-diagram-" + ++sequence,
          source,
        );
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled)
          setError(
            "Diagram rendering is unavailable. The source is available below.",
          );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source]);
  return (
    <figure className="diagram-frame">
      <div className="figure-tools">
        <span>Architecture</span>
        <button
          className="icon-button"
          disabled={!svg}
          onClick={() => setExpanded(true)}
          title="Expand diagram"
          aria-label="Expand diagram"
        >
          <Expand size={18} />
        </button>
      </div>
      {svg ? (
        <div
          className="mermaid-image"
          data-testid="mermaid-diagram"
          tabIndex={0}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p role="status">{error || "Rendering diagram…"}</p>
      )}
      {error && <pre>{source}</pre>}
      {expanded && (
        <Modal
          title="Architecture diagram"
          close={() => setExpanded(false)}
          wide
        >
          <div
            className="diagram-expanded"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </Modal>
      )}
    </figure>
  );
}
function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  if (language === "mermaid") return <Diagram source={value} />;
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>
          {language === "text" ? "Workshop prompt" : language || "Reference"}
        </span>
        <button
          className="copy-button"
          title="Copy to clipboard"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setError(false);
              setTimeout(() => setCopied(false), 2200);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{value}</code>
      </pre>
      {error && (
        <span role="alert">
          Clipboard unavailable. Select the prompt text to copy.
        </span>
      )}
    </div>
  );
}
function Screenshot({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const resolved = src.startsWith("docs/assets/")
    ? import.meta.env.BASE_URL + "workshop-assets/" + src.slice(12)
    : src;
  return (
    <figure className="screenshot-frame">
      <button
        className="image-button"
        onClick={() => setOpen(true)}
        title="Expand image"
        aria-label={"Expand: " + alt}
        disabled={error}
      >
        <img
          src={resolved}
          alt={alt}
          loading="lazy"
          onError={() => setError(true)}
        />
        <span className="image-expand">
          <Expand size={17} />
        </span>
      </button>
      {error && (
        <p role="alert">
          Image unavailable. Open the README asset to inspect it.
        </p>
      )}
      {open && (
        <Modal title="Workshop evidence" close={() => setOpen(false)} wide>
          <img className="expanded-image" src={resolved} alt={alt} />
          <p className="caption">{alt}</p>
          <a
            className="button secondary"
            href={resolved}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} />
            Open original
          </a>
        </Modal>
      )}
    </figure>
  );
}
export function MarkdownView({
  section,
  progress,
  onTask,
  navigate,
  signedIn,
  referenceBase,
  readOnly = false,
}: {
  section: Section;
  progress: Progress[];
  onTask: (id: string, done: boolean) => void;
  navigate: (id: string) => void;
  signedIn: boolean;
  referenceBase?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ children }) => <h3 id={slug(String(children))}>{children}</h3>,
          h4: ({ children }) => <h4 id={slug(String(children))}>{children}</h4>,
          pre: ({ children }) => <div>{children}</div>,
          code: ({ className, children }) => {
            const value = String(children).replace(/\n$/, "");
            const language = className?.replace("language-", "") ?? "";
            return language || value.includes("\n") ? (
              <CodeBlock language={language} value={value} />
            ) : (
              <code>{children}</code>
            );
          },
          table: ({ children }) => (
            <div className="table-scroll" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
          img: ({ src, alt }) => (
            <Screenshot src={src ?? ""} alt={alt ?? "Workshop image"} />
          ),
          p: ({ children, node }) =>
            node?.children.some(
              (child) =>
                child.type === "element" &&
                (child.tagName === "img" ||
                  (child.tagName === "a" &&
                    child.children.some(
                      (item) =>
                        item.type === "element" && item.tagName === "img",
                    ))),
            ) ? (
              <div>{children}</div>
            ) : (
              <p>{children}</p>
            ),
          a: ({ href, children, node }) => {
            if (
              node?.children.some(
                (child) => child.type === "element" && child.tagName === "img",
              )
            )
              return <>{children}</>;
            if (href?.startsWith("#"))
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(href.slice(1));
                  }}
                >
                  {children}
                </a>
              );
            const destination = /^https?:/.test(href ?? "")
              ? href
              : href?.startsWith("docs/assets/")
                ? import.meta.env.BASE_URL + "workshop-assets/" + href.slice(12)
                : referenceBase
                  ? referenceBase + (href ?? "")
                  : "/api/reference?path=" + encodeURIComponent(href ?? "");
            return (
              <a href={destination} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          li: ({ children, node }) => {
            if (
              node?.properties.className &&
              String(node.properties.className).includes("task-list-item")
            ) {
              const collect = (value: unknown): string => {
                const item = value as { value?: string; children?: unknown[] };
                return (
                  item.value ?? (item.children ?? []).map(collect).join("")
                );
              };
              const text = collect(node).replace(/\s+/g, " ").trim();
              const task = section.tasks.find(
                (item) => item.label.replace(/\s+/g, " ").trim() === text,
              );
              if (task)
                return (
                  <li className="task-row">
                    <label>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={
                          progress.find((item) => item.unit === task.id)
                            ?.status === "done"
                        }
                        onChange={(event) => {
                          if (!readOnly) onTask(task.id, event.target.checked);
                        }}
                        aria-label={task.label}
                      />
                      <span>{task.label}</span>
                    </label>
                    {readOnly ? <small>Track this in the secure workshop</small> : !signedIn && <small>Sign in to save</small>}
                  </li>
                );
            }
            return <li>{children}</li>;
          },
        }}
      >
        {section.markdown}
      </ReactMarkdown>
    </div>
  );
}
