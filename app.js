/* ── Console de test — client du proxy Lambda vers l'API Anthropic ──────
 *
 * Contrat avec la Lambda :
 *   POST <ENDPOINT>  body: {"question": "..."}
 *   → 200 {"answer": "..."}
 *   → 400 {"error": "..."}   (question manquante, vide ou trop longue)
 *   → 502 {"error": "..."}   (API Anthropic indisponible)
 */

const DEFAULT_ENDPOINT =
  "https://jrtwbowpv6qgaxgw6d5fn6przq0cpkiz.lambda-url.eu-west-1.on.aws/";

// Surcharge possible pour les tests : ?endpoint=https://autre-url/
const ENDPOINT =
  new URLSearchParams(location.search).get("endpoint") || DEFAULT_ENDPOINT;

const MAX_CHARS = 3000;      // = MAX_QUESTION_CHARS côté Lambda
const TIMEOUT_MS = 60_000;

const messagesEl = document.getElementById("messages");
const composerEl = document.getElementById("composer");
const inputEl = document.getElementById("input");
const sendEl = document.getElementById("send");
const counterEl = document.getElementById("counter");
const logEl = document.getElementById("log");
const statusDotEl = document.getElementById("status-dot");
const statusTextEl = document.getElementById("status-text");
const endpointLabelEl = document.getElementById("endpoint-label");

endpointLabelEl.textContent = "POST " + new URL(ENDPOINT).host;
endpointLabelEl.title = ENDPOINT;

let pending = false;

/* ── Utilitaires ─────────────────────────────────────────────────────── */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function timeNow() {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

function setStatus(state, text) {
  statusDotEl.className = "dot" + (state ? " " + state : "");
  statusTextEl.textContent = text;
}

/* ── Rendu markdown minimal (le texte est échappé AVANT tout parsing) ─── */

function renderInline(text) {
  return text
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );
}

function renderBlocks(text) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^[-*•] /.test(l.trim()))) {
        const items = lines
          .map((l) => `<li>${renderInline(l.trim().slice(2))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      if (lines.every((l) => /^\d+[.)] /.test(l.trim()))) {
        const items = lines
          .map((l) => `<li>${renderInline(l.trim().replace(/^\d+[.)] /, ""))}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      if (lines.length === 1 && /^#{1,4} /.test(lines[0])) {
        return `<p class="md-h">${renderInline(lines[0].replace(/^#{1,4} /, ""))}</p>`;
      }
      return `<p>${lines.map(renderInline).join("<br>")}</p>`;
    })
    .join("");
}

function renderMarkdown(src) {
  const escaped = escapeHtml(src);
  // segments pairs = prose, segments impairs = blocs de code ```
  return escaped
    .split("```")
    .map((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[a-z0-9]*\n/i, "").trimEnd();
        return `<pre><code>${code}</code></pre>`;
      }
      return renderBlocks(part);
    })
    .join("");
}

/* ── Messages du chat ────────────────────────────────────────────────── */

function addMessage(role, html, meta) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + role;
  wrap.innerHTML = `<span class="msg-meta">${meta}</span><div class="bubble">${html}</div>`;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function addTypingIndicator() {
  return addMessage(
    "assistant",
    '<span class="typing"><span></span><span></span><span></span></span>',
    "assistant · …"
  );
}

/* ── Journal des requêtes ────────────────────────────────────────────── */

function logExchange({ status, ms, requestBody, responseText }) {
  const empty = logEl.querySelector(".log-empty");
  if (empty) empty.remove();

  let prettyResponse = responseText;
  try {
    prettyResponse = JSON.stringify(JSON.parse(responseText), null, 2);
  } catch {
    /* réponse non-JSON : affichée brute */
  }

  const statusClass = "s" + String(status)[0];
  const entry = document.createElement("details");
  entry.className = "log-entry";
  entry.innerHTML = `
    <summary>
      <span class="log-status ${statusClass}">${status || "ERR"}</span>
      ${timeNow()} · ${ms} ms
    </summary>
    <div class="log-block"><span>requête</span>
      <pre>${escapeHtml(JSON.stringify(requestBody, null, 2))}</pre></div>
    <div class="log-block"><span>réponse</span>
      <pre>${escapeHtml(prettyResponse)}</pre></div>`;
  logEl.prepend(entry);
}

/* ── Envoi d'une question ────────────────────────────────────────────── */

async function ask(question) {
  pending = true;
  sendEl.disabled = true;
  setStatus("busy", "requête en cours…");

  addMessage("user", escapeHtml(question), `vous · ${timeNow()}`);
  const typingEl = addTypingIndicator();

  const requestBody = { question };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = performance.now();

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const ms = Math.round(performance.now() - t0);
    const responseText = await res.text();

    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      /* corps non-JSON */
    }

    logExchange({ status: res.status, ms, requestBody, responseText });

    if (res.ok && data && typeof data.answer === "string") {
      typingEl.remove();
      addMessage(
        "assistant",
        renderMarkdown(data.answer),
        `assistant · ${(ms / 1000).toFixed(1)} s`
      );
      setStatus("ok", `200 · ${ms} ms`);
    } else {
      const message =
        (data && data.error) || `réponse inattendue (HTTP ${res.status})`;
      typingEl.remove();
      addMessage("error", escapeHtml(message), `erreur · HTTP ${res.status}`);
      setStatus("err", `HTTP ${res.status}`);
    }
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    const aborted = err.name === "AbortError";
    const message = aborted
      ? `Délai dépassé (${TIMEOUT_MS / 1000} s sans réponse).`
      : "Impossible de joindre le service (réseau ou CORS).";

    logExchange({ status: 0, ms, requestBody, responseText: String(err) });
    typingEl.remove();
    addMessage("error", escapeHtml(message), "erreur · réseau");
    setStatus("err", aborted ? "délai dépassé" : "injoignable");
  } finally {
    clearTimeout(timeout);
    pending = false;
    sendEl.disabled = false;
    inputEl.focus();
  }
}

/* ── Interactions ────────────────────────────────────────────────────── */

function updateCounter() {
  const len = inputEl.value.length;
  counterEl.textContent = `${len} / ${MAX_CHARS}`;
  counterEl.classList.toggle("over", len > MAX_CHARS);
}

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = inputEl.scrollHeight + "px";
}

function submit() {
  const question = inputEl.value.trim();
  if (!question || pending || question.length > MAX_CHARS) return;
  inputEl.value = "";
  updateCounter();
  autoResize();
  ask(question);
}

composerEl.addEventListener("submit", (e) => {
  e.preventDefault();
  submit();
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
});

inputEl.addEventListener("input", () => {
  updateCounter();
  autoResize();
});

document.getElementById("clear-chat").addEventListener("click", () => {
  messagesEl.innerHTML =
    '<p class="session-note mono">— session ouverte · les échanges ne sont pas conservés —</p>';
});

document.getElementById("clear-log").addEventListener("click", () => {
  logEl.innerHTML = '<p class="log-empty mono">aucune requête envoyée</p>';
});

updateCounter();
inputEl.focus();
