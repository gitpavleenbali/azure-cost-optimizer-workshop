export type Status = "todo" | "done" | "blocked" | "deferred";
export type User = { id: string; name: string; role: "admin" | "participant" };
export type Section = {
  id: string;
  title: string;
  group: string;
  markdown: string;
  step: number | null;
  minutes: number;
  tasks: { id: string; label: string }[];
};
export type Guide = { title: string; revision: string; sections: Section[] };
export type Progress = {
  unit: string;
  status: Status;
  note: string;
  updatedAt: string;
};
export type Submission = {
  id: string;
  caption: string;
  consent: number;
  status: string;
  feedback: string;
  createdAt: string;
};
export type Session = {
  user: User | null;
  csrf: string;
  setupRequired: boolean;
  setupAllowed: boolean;
  inviteRequired: boolean;
};
export type Participant = {
  id: string;
  name: string;
  createdAt: string;
  lastSeen: string;
  progress: Progress[];
  submission: Submission | null;
};
export type WallItem = {
  id: string;
  name: string;
  caption: string;
  createdAt: string;
  kudos: number;
  applauded: boolean;
  own: boolean;
};
export type WallResponse = {
  released: boolean;
  releasedAt: string | null;
  items: WallItem[];
};

export async function request<T>(
  route: string,
  method = "GET",
  body?: unknown,
  csrf = "",
): Promise<T> {
  const response = await fetch("/api" + route, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({
      error: "The server is unavailable. Your last saved progress is retained.",
    }));
  if (response.status === 401 && route !== '/login') window.dispatchEvent(new Event('workshop-session-expired'));
  if (!response.ok)
    throw new Error(data.error ?? "Request failed. Please try again.");
  return data as T;
}
export const groups = [
  { id: "tour", label: "Solution tour (Optional)", detail: "Architecture & real output" },
  { id: "prepare", label: "Get ready", detail: "Access & workstation" },
  {
    id: "sprint1",
    label: "Sprint 1 (Required)",
    detail: "11:30-13:00 · Local experience",
  },
  {
    id: "sprint2",
    label: "Sprint 2 (Required)",
    detail: "13:45-15:15 · Hosted experience",
  },
  { id: "bonus", label: "Beyond workshop (Optional)", detail: "Foundry & next steps" },
];
export const statusLabels: Record<Status, string> = {
  todo: "Not started",
  done: "Complete",
  blocked: "Blocked",
  deferred: "Deferred",
};
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
export const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
