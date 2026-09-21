import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import cookieParser from "cookie-parser";
import sharp from "sharp";
import { createSqliteStore } from './store-sqlite.mjs';
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  content,
  validUnits,
  stepIds,
  workshopRoot,
  appRoot,
} from "./content.mjs";

const scrypt = promisify(scryptCallback);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const loopback = (address) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
const credentials = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[\p{L}\p{N} ._'()-]+$/u),
    password: z.string().min(12).max(128),
  })
  .strict();
const safeUser = (user) => ({ id: user.id, name: user.name, role: user.role });
const sessionLifetime = 12 * 60 * 60 * 1000;

export function createApp(options = {}) {
  const dataDir =
    options.dataDir ??
    path.join(workshopRoot, ".workshop", "interactive-workshop");
  const origin = options.origin ?? "http://127.0.0.1:4310";
  const secure = options.secure ?? false;
  const inviteCode =
    options.inviteCode ?? process.env.WORKSHOP_INVITE_CODE ?? "";
  const setupCode =
    options.setupCode ?? process.env.WORKSHOP_SETUP_CODE ?? "";
  const ownerObjectId = String(options.ownerObjectId ?? "").trim().toLowerCase();
  const store = options.store ?? createSqliteStore(dataDir);
  const db = store.db;
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", 1);
  const writeAudit = (event, actor) => store.audit(event, actor);
  const adminExists = () => store.hasAdmin();
  const hostedOwner = (req) =>
    options.hosted &&
    ownerObjectId.length > 0 &&
    req.get("x-ms-client-principal-id")?.trim().toLowerCase() === ownerObjectId;
  const protectedSetup = (req) =>
    options.hosted &&
    setupCode.length >= 32 &&
    typeof req.body?.setupCode === "string" &&
    timingSafeEqual(
      Buffer.from(hash(req.body.setupCode)),
      Buffer.from(hash(setupCode)),
    );
  const progressFor = (userId) => store.progress(userId, content.revision);
  const completed = async (userId) =>
    (await progressFor(userId)).filter(
      (item) => stepIds.includes(item.unit) && item.status === "done",
    ).length;
  const submissionFor = (userId) => store.submission(userId);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: secure ? [] : null,
        },
      },
      strictTransportSecurity: secure ? undefined : false,
    }),
  );
  app.use((req, res, next) => {
    const allowedHost = new URL(origin).host;
    if (req.get("host") !== allowedHost && !options.allowTestHost)
      return res.status(403).json({ error: "Unrecognized host." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Origin check failed." });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use("/api", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const token = req.cookies.workshop_session;
    if (typeof token === "string" && token.length < 128) {
      const session = await store.session(hash(token), Date.now());
      if (session) req.account = session;
    }
    if (
      req.account &&
      !["GET", "HEAD"].includes(req.method) &&
      req.get("x-csrf-token") !== req.account.csrf
    )
      return res
        .status(403)
        .json({ error: "Session confirmation expired. Reload and try again." });
    next();
  });
  const requireUser = (req, res, next) =>
    req.account
      ? next()
      : res.status(401).json({ error: "Sign in to continue." });
  const requireAdmin = (req, res, next) =>
    req.account?.role === "admin"
      ? next()
      : res.status(403).json({ error: "Facilitator access required." });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const issueSession = async (res, user) => {
    const token = randomBytes(32).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    await store.addSession(hash(token), user.id, csrf, Date.now() + sessionLifetime);
    res.cookie("workshop_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      maxAge: sessionLifetime,
      path: "/",
    });
    return { user: safeUser(user), csrf };
  };
  const addAccount = async (name, password, role) => {
    const salt = randomBytes(16).toString("hex");
    const derived = (await scrypt(password, salt, 64)).toString("hex");
    if (role === "admin" && await adminExists())
      throw Object.assign(new Error("Facilitator setup is already complete."), {
        status: 409,
      });
    const user = { id: randomUUID(), name, role };
    const now = new Date().toISOString();
    try {
      await store.addUser({ ...user, login: name.toLocaleLowerCase('en-US'), password: derived, salt, createdAt: now });
    } catch {
      throw Object.assign(
        new Error("That name is unavailable. Choose another or sign in."),
        { status: 409 },
      );
    }
    await writeAudit("account-created", user.id);
    return user;
  };
  app.get("/api/content", (_req, res) => res.json(content));
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => { try { await store.health(); res.json({ status: 'ready', persistence: store.kind }); } catch { res.status(503).json({ status: 'unavailable' }); } });
  app.get("/api/session", async (req, res) =>
    res.json({
      user: req.account ? safeUser(req.account) : null,
      csrf: req.account?.csrf ?? "",
      setupRequired: !await adminExists(),
      setupAllowed:
        !await adminExists() &&
        ((!options.hosted && loopback(req.socket.remoteAddress)) || hostedOwner(req)),
      inviteRequired: !!inviteCode,
      revision: content.revision,
    }),
  );
  app.post("/api/setup", authLimit, async (req, res) => {
    if (
      await adminExists() ||
      (options.hosted
        ? !hostedOwner(req) && !protectedSetup(req)
        : !loopback(req.socket.remoteAddress))
    )
      return res
        .status(403)
        .json({
          error: "Facilitator setup is unavailable for this identity.",
        });
    const { name, password } = credentials.parse({
      name: req.body?.name,
      password: req.body?.password,
    });
    res
      .status(201)
      .json(await issueSession(res, await addAccount(name, password, "admin")));
  });
  app.post("/api/register", authLimit, async (req, res) => {
    if (!await adminExists())
      return res
        .status(409)
        .json({ error: "The facilitator must finish local setup first." });
    const body = z
      .object({
        name: z.string(),
        password: z.string(),
        inviteCode: z.string().max(200).optional(),
      })
      .strict()
      .parse(req.body);
    if (
      inviteCode &&
      !timingSafeEqual(
        Buffer.from(hash(body.inviteCode ?? "")),
        Buffer.from(hash(inviteCode)),
      )
    )
      return res
        .status(403)
        .json({ error: "The workshop invite code is incorrect." });
    const { name, password } = credentials.parse({
      name: body.name,
      password: body.password,
    });
    if (await store.userCount() >= 5000)
      return res
        .status(409)
        .json({ error: "This workshop has reached its participant limit." });
    res
      .status(201)
      .json(await issueSession(res, await addAccount(name, password, "participant")));
  });
  app.post("/api/login", authLimit, async (req, res) => {
    const { name, password } = credentials.parse(req.body);
    const user = await store.userByLogin(name.toLocaleLowerCase('en-US'));
    const candidate = await scrypt(
      password,
      user?.salt ?? "invalid-user-fixed-salt",
      64,
    );
    if (!user || !timingSafeEqual(candidate, Buffer.from(user.password, "hex")))
      return res
        .status(401)
        .json({ error: "Name or passphrase is incorrect." });
    res.json(await issueSession(res, user));
  });
  app.post("/api/logout", requireUser, async (req, res) => {
    await store.revokeSession(hash(req.cookies.workshop_session));
    res.clearCookie("workshop_session", {
      path: "/",
      secure,
      sameSite: "strict",
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  app.get("/api/progress", requireUser, async (req, res) =>
    res.json({
      progress: await progressFor(req.account.id),
      submission: await submissionFor(req.account.id),
      revision: content.revision,
    }),
  );
  app.put("/api/progress/:unit", requireUser, async (req, res) => {
    const body = z
      .object({
        status: z.enum(["todo", "done", "blocked", "deferred"]),
        note: z.string().max(1200).default(""),
        revision: z.string(),
      })
      .strict()
      .parse(req.body);
    if (body.revision !== content.revision)
      return res
        .status(409)
        .json({
          error: "The guide changed. Reload before recording progress.",
        });
    if (!validUnits.has(req.params.unit))
      return res.status(400).json({ error: "Unknown workshop checkpoint." });
    await store.saveProgress(req.account.id, content.revision, req.params.unit, body.status, body.note);
    res.json({ progress: await progressFor(req.account.id) });
  });
  app.get("/api/me/export", requireUser, async (req, res) =>
    res
      .attachment("workshop-progress.json")
      .json({
        participant: safeUser(req.account),
        revision: content.revision,
        progress: await progressFor(req.account.id),
        submission: await submissionFor(req.account.id),
      }),
  );
  app.delete("/api/me", requireUser, async (req, res) => {
    if (req.account.role === "admin")
      return res
        .status(403)
        .json({ error: "Facilitator accounts cannot be deleted here." });
    await writeAudit("participant-deleted", req.account.id);
    await store.deleteUser(req.account.id);
    res.clearCookie("workshop_session", {
      path: "/",
      secure,
      sameSite: "strict",
      httpOnly: true,
    });
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 1000 },
    fileFilter: (_req, file, callback) =>
      callback(
        null,
        ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype),
      ),
  });
  app.post(
    "/api/submissions",
    requireUser,
    rateLimit({
      windowMs: 600000,
      limit: 8,
      message: { error: "Upload limit reached. Please try again later." },
    }),
    upload.single("image"),
    async (req, res) => {
      if (req.account.role !== "participant")
        return res
          .status(403)
          .json({ error: "Use a participant account to submit work." });
      if (!req.file)
        return res
          .status(400)
          .json({ error: "Choose a PNG, JPEG or WebP image under 5 MB." });
      const { caption, consent } = z
        .object({
          caption: z.string().trim().min(3).max(500),
          consent: z.enum(["true", "false"]),
        })
        .strict()
        .parse(req.body);
      let image;
      try {
        const metadata = await sharp(req.file.buffer, {
          limitInputPixels: 16000000,
        }).metadata();
        if (
          !["png", "jpeg", "webp"].includes(metadata.format) ||
          (metadata.pages ?? 1) !== 1
        )
          throw new Error();
        image = await sharp(req.file.buffer, { limitInputPixels: 16000000 })
          .rotate()
          .resize({
            width: 2560,
            height: 2560,
            fit: "inside",
            withoutEnlargement: true,
          })
          .png()
          .toBuffer();
        if (image.length > 8 * 1024 * 1024) throw new Error();
      } catch {
        return res
          .status(400)
          .json({
            error:
              "That file could not be decoded safely. Use a smaller static screenshot.",
          });
      }
      await store.saveSubmission({ id: randomUUID(), userId: req.account.id, image, caption, consent: consent === 'true' ? 1 : 0, createdAt: new Date().toISOString() });
      await writeAudit("screenshot-submitted", req.account.id);
      res.status(201).json({ submission: await submissionFor(req.account.id) });
    },
  );
  app.delete("/api/submissions", requireUser, async (req, res) => {
    await store.deleteSubmission(req.account.id);
    res.json({ ok: true });
  });
  app.get("/api/submissions/:id/image", requireUser, async (req, res) => {
    const row = await store.submissionById(req.params.id);
    const board = await store.boardState();
    if (
      !row ||
      !(
        req.account.role === "admin" ||
        row.user_id === req.account.id ||
        (board.released && row.status === "approved" &&
          row.consent &&
          await completed(row.user_id) === 15)
      )
    )
      return res.status(404).json({ error: "Screenshot not available." });
    res.type("png").send(await store.image(row));
  });
  app.get("/api/wall", requireUser, async (req, res) => {
    const board = await store.boardState();
    if (!board.released && req.account.role !== 'admin')
      return res.json({ ...board, items: [] });
    const rows = await store.approvedSubmissions();
    const result = [];
    for (const { user_id, ...row } of rows) if (await completed(user_id) === 15) result.push({ ...row, ...await store.kudos(row.id, req.account.id), own: user_id === req.account.id });
    res.json({ ...board, items: result });
  });
  app.post("/api/wall/:id/kudos", requireUser, async (req, res) => {
    if (!(await store.boardState()).released)
      return res.status(409).json({ error: 'Kudos open after the facilitator releases the board.' });
    const row = await store.submissionById(req.params.id);
    if (!row || row.status !== 'approved' || !row.consent || await completed(row.user_id) !== 15)
      return res
        .status(400)
        .json({ error: "Kudos are unavailable for this submission." });
    await store.toggleKudos(row.id, req.account.id);
    res.json({ ok: true });
  });
  app.put('/api/admin/wall', requireAdmin, async (req, res) => {
    const { released } = z.object({ released: z.boolean() }).strict().parse(req.body);
    const board = await store.setBoardReleased(released, req.account.id);
    await writeAudit(released ? 'kudos-board-released' : 'kudos-board-closed', req.account.id);
    res.json(board);
  });
  app.get('/api/admin/invite', requireAdmin, (_req, res) =>
    res.json({ inviteCode: inviteCode || null }),
  );
  app.get("/api/admin/participants", requireAdmin, async (_req, res) => {
    const rows = await store.participants();
    res.json({
      revision: content.revision,
      participants: await Promise.all(rows.map(async (user) => ({
        ...user,
        progress: await progressFor(user.id),
        submission: await submissionFor(user.id),
      }))),
    });
  });
  app.put("/api/admin/submissions/:id", requireAdmin, async (req, res) => {
    const { status, feedback } = z
      .object({
        status: z.enum(["approved", "changes-requested"]),
        feedback: z.string().trim().max(1000).default(""),
      })
      .strict()
      .parse(req.body);
    const row = await store.submissionById(req.params.id);
    if (!row) return res.status(404).json({ error: "Submission not found." });
    await store.review(row.id, status, feedback);
    await writeAudit("submission-" + status, req.account.id);
    res.json({ ok: true });
  });
  app.post(
    "/api/admin/participants/:id/reset-password",
    requireAdmin,
    async (req, res) => {
      const { password } = z
        .object({ password: z.string().min(12).max(128) })
        .strict()
        .parse(req.body);
      const user = await store.participant(req.params.id);
      if (!user)
        return res.status(404).json({ error: "Participant not found." });
      const salt = randomBytes(16).toString("hex");
      const derived = (await scrypt(password, salt, 64)).toString("hex");
      await store.resetPassword(user.id, derived, salt);
      await writeAudit("participant-password-reset", req.account.id);
      res.json({ ok: true });
    },
  );
  app.get("/api/guide/download", (_req, res) =>
    res.download(
      path.join(workshopRoot, "README.md"),
      "Azure-Cost-Optimizer-Workshop.md",
    ),
  );
  app.use(
    "/workshop-assets",
    express.static(path.join(workshopRoot, "docs/assets"), {
      dotfiles: "deny",
      fallthrough: false,
      maxAge: 0,
    }),
  );
  app.get("/api/reference", (req, res) => {
    const relative = String(req.query.path ?? "");
    const links = new Set(
      [
        ...content.sections
          .map((section) => section.markdown)
          .join("\n")
          .matchAll(/\]\(([^)]+)\)/g),
      ].map((match) => match[1]),
    );
    if (
      !links.has(relative) ||
      !/^(scripts|spec|ops|config|infra|\.github)\/[a-zA-Z0-9/_.-]+$/.test(
        relative,
      ) ||
      relative.includes("..")
    )
      return res.status(404).end();
    const file = path.resolve(workshopRoot, relative);
    if (
      !file.startsWith(workshopRoot + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    )
      return res.status(404).end();
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Route not found." }),
  );
  app.use(express.static(path.join(appRoot, "dist"), { index: false }));
  app.get("/{*splat}", (_req, res) =>
    res.sendFile(path.join(appRoot, "dist/index.html")),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error:
            "Check the submitted fields. Names need 2-60 characters and passphrases need 12-128 characters.",
        });
    if (error instanceof multer.MulterError)
      return res.status(400).json({ error: "Choose one image under 5 MB." });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request too large." });
    if (error.status && error.status < 500)
      return res
        .status(error.status)
        .json({
          error:
            error.status === 409
              ? error.message
              : "Request could not be accepted.",
        });
    res
      .status(500)
      .json({
        error: "The server could not complete this request. Please retry.",
      });
  });
  return { app, db, close: () => store.close(), hasAdmin: adminExists };
}
