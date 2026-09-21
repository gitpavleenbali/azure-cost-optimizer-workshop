import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { createApp } from "../server/app.mjs";
import { content, stepIds } from "../server/content.mjs";

test("roles, isolated durable progress, CSRF, uploads and moderated consent wall", async () => {
  const dataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "interactive-workshop-test-"),
  );
  const service = createApp({
    dataDir,
    origin: "http://127.0.0.1:4310",
    allowTestHost: true,
    inviteCode: "private-invite-code-fixture",
  });
  const server = service.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, method = "GET", body, account) => {
    const headers = { origin: "http://127.0.0.1:4310" };
    if (account) {
      headers.cookie = account.cookie;
      headers["x-csrf-token"] = account.csrf;
    }
    if (body && !(body instanceof FormData))
      headers["content-type"] = "application/json";
    const response = await fetch(base + route, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    const json = await response.json();
    return {
      status: response.status,
      ...json,
      cookie:
        response.headers.get("set-cookie")?.split(";")[0] ?? account?.cookie,
    };
  };
  try {
    assert.equal((await call('/api/progress')).status, 401);
    const admin = await call("/api/setup", "POST", {
      name: "Facilitator",
      password: "test-admin-passphrase-123",
    });
    assert.equal(admin.status, 201);
    assert.equal(
      (
        await call("/api/setup", "POST", {
          name: "Other admin",
          password: "another-long-passphrase",
        })
      ).status,
      403,
    );
    const alice = await call("/api/register", "POST", {
      name: "Alice",
      password: "participant-password-one",
      inviteCode: "private-invite-code-fixture",
    });
    const bob = await call("/api/register", "POST", {
      name: "Bob",
      password: "participant-password-two",
      inviteCode: "private-invite-code-fixture",
    });
    assert.equal(alice.status, 201);
    assert.equal((await call('/api/register', 'POST', { name: 'Injected role', password: 'long-fixture-passphrase', role: 'admin' })).status, 400);
    assert.equal((await call('/api/login', 'POST', { name: 'Alice', password: 'wrong-fixture-passphrase' })).status, 401);
    assert.equal(
      (await call("/api/admin/participants", "GET", undefined, alice)).status,
      403,
    );
    assert.equal((await call("/api/admin/invite")).status, 403);
    assert.equal(
      (await call("/api/admin/invite", "GET", undefined, alice)).status,
      403,
    );
    assert.equal(
      (await call("/api/admin/invite", "GET", undefined, admin)).inviteCode,
      "private-invite-code-fixture",
    );
    const body = { status: "done", note: "", revision: content.revision };
    assert.equal(
      (
        await call("/api/progress/" + stepIds[0], "PUT", body, {
          ...alice,
          csrf: "wrong",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/api/progress/" + stepIds[0],
          "PUT",
          { ...body, revision: "old" },
          alice,
        )
      ).status,
      409,
    );
    assert.equal(
      (await call("/api/progress/not-a-step", "PUT", body, alice)).status,
      400,
    );
    for (const id of stepIds)
      assert.equal(
        (await call("/api/progress/" + id, "PUT", body, alice)).status,
        200,
      );
    assert.equal(
      (await call("/api/progress", "GET", undefined, bob)).progress.length,
      0,
    );
    const image = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#087f68" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("image", new Blob([image], { type: "image/png" }), "proof.png");
    form.set("caption", "Local workshop result");
    form.set("consent", "true");
    const upload = await call("/api/submissions", "POST", form, alice);
    assert.equal(upload.status, 201);
    const privateImage = await fetch(
      base + "/api/submissions/" + upload.submission.id + "/image",
      { headers: { cookie: bob.cookie } },
    );
    assert.equal(privateImage.status, 404);
    assert.equal(
      (
        await fetch(base + "/api/wall", {
          headers: { cookie: bob.cookie },
        }).then((response) => response.json())
      ).items.length,
      0,
    );
    assert.equal(
      (
        await call(
          "/api/admin/submissions/" + upload.submission.id,
          "PUT",
          { status: "approved", feedback: "Reviewed screenshot" },
          admin,
        )
      ).status,
      200,
    );
    const closedParticipantWall = await call('/api/wall', 'GET', undefined, bob);
    assert.equal(closedParticipantWall.released, false);
    assert.equal(closedParticipantWall.items.length, 0);
    assert.equal((await call('/api/wall', 'GET', undefined, admin)).items.length, 1);
    assert.equal((await fetch(base + '/api/submissions/' + upload.submission.id + '/image', { headers: { cookie: bob.cookie } })).status, 404);
    assert.equal(
      (
        await call(
          "/api/wall/" + upload.submission.id + "/kudos",
          "POST",
          {},
          bob,
        )
      ).status,
      409,
    );
    const released = await call('/api/admin/wall', 'PUT', { released: true }, admin);
    assert.equal(released.status, 200);
    assert.equal(released.released, true);
    assert.equal((await call('/api/wall', 'GET', undefined, bob)).items.length, 1);
    assert.equal((await fetch(base + '/api/submissions/' + upload.submission.id + '/image', { headers: { cookie: bob.cookie } })).status, 200);
    assert.equal((await call('/api/wall/' + upload.submission.id + '/kudos', 'POST', {}, bob)).status, 200);
    assert.equal((await call('/api/wall/' + upload.submission.id + '/kudos', 'POST', {}, alice)).status, 200);
    assert.equal((await call('/api/wall', 'GET', undefined, alice)).items[0].applauded, true);
    const closed = await call('/api/admin/wall', 'PUT', { released: false }, admin);
    assert.equal(closed.status, 200);
    assert.equal(closed.released, false);
    assert.equal((await call('/api/wall', 'GET', undefined, bob)).items.length, 0);
    assert.equal((await fetch(base + '/api/submissions/' + upload.submission.id + '/image', { headers: { cookie: bob.cookie } })).status, 404);
    const invalid = new FormData();
    invalid.set(
      "image",
      new Blob(["<svg/>"], { type: "image/png" }),
      "bad.png",
    );
    invalid.set("caption", "Invalid image");
    invalid.set("consent", "false");
    assert.equal(
      (await call("/api/submissions", "POST", invalid, bob)).status,
      400,
    );
    const incompleteForm = new FormData();
    incompleteForm.set('image', new Blob([image], { type: 'image/png' }), 'incomplete.png');
    incompleteForm.set('caption', 'Approved evidence before completion');
    incompleteForm.set('consent', 'true');
    const incompleteUpload = await call('/api/submissions', 'POST', incompleteForm, bob);
    assert.equal(incompleteUpload.status, 201);
    assert.equal((await call('/api/admin/submissions/' + incompleteUpload.submission.id, 'PUT', { status: 'approved', feedback: '' }, admin)).status, 200);
    const wallWithIncomplete = await fetch(base + '/api/wall', { headers: { cookie: bob.cookie } }).then(response => response.json());
    assert.equal(wallWithIncomplete.items.some(item => item.name === 'Bob'), false);
    assert.equal(
      (
        await fetch(base + "/api/login", {
          method: "POST",
          headers: {
            origin: "https://foreign.invalid",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "Bob",
            password: "participant-password-two",
          }),
        })
      ).status,
      403,
    );
    const roster = await call(
      "/api/admin/participants",
      "GET",
      undefined,
      admin,
    );
    assert.equal(roster.participants.length, 2);
    assert(!JSON.stringify(roster).includes("password-one"));
    const privateForm = new FormData();
    privateForm.set('image', new Blob([image], { type: 'image/png' }), 'private.png');
    privateForm.set('caption', 'Private review only');
    privateForm.set('consent', 'false');
    const privateUpload = await call('/api/submissions', 'POST', privateForm, alice);
    assert.equal(privateUpload.status, 201);
    assert.equal((await call('/api/admin/submissions/' + privateUpload.submission.id, 'PUT', { status: 'approved', feedback: '' }, admin)).status, 200);
    assert.equal((await fetch(base + '/api/wall', { headers: { cookie: bob.cookie } }).then(response => response.json())).items.length, 0);
    assert.equal((await call("/api/me", "DELETE", {}, alice)).status, 200);
    assert.equal(
      (
        await fetch(base + "/api/wall", {
          headers: { cookie: bob.cookie },
        }).then((response) => response.json())
      ).items.length,
      0,
    );
    assert.equal((await call('/api/progress/' + stepIds[0], 'PUT', { ...body, status: 'blocked', note: 'Waiting for approval' }, bob)).status, 200);
    assert.equal((await call('/api/admin/participants/' + bob.user.id + '/reset-password', 'POST', { password: 'replacement-fixture-passphrase' }, admin)).status, 200);
    assert.equal((await call('/api/progress', 'GET', undefined, bob)).status, 401);
    const recovered = await call('/api/login', 'POST', { name: 'Bob', password: 'replacement-fixture-passphrase' });
    assert.equal(recovered.status, 200);
    assert.equal((await call('/api/progress', 'GET', undefined, recovered)).progress[0].note, 'Waiting for approval');
    service.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(bob.user.id);
    assert.equal((await call('/api/progress', 'GET', undefined, recovered)).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    service.close();
  }
  const reopened = createApp({ dataDir });
  assert.equal(
    reopened.db
      .prepare("SELECT count(*) AS count FROM users WHERE role='participant'")
      .get().count,
    1,
  );
  assert.equal(reopened.hasAdmin(), true);
  assert.equal(reopened.db.prepare('SELECT note FROM progress').get().note, 'Waiting for approval');
  reopened.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
