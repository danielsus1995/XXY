/* ── MEMBER MANAGEMENT ──────────────────────────────────────── */
const membersContainer = document.getElementById("membersContainer");
const addMemberBtn     = document.getElementById("addMemberBtn");
const membersError     = document.getElementById("membersError");

let memberCount = 0;

const MEMBER_COLORS = ["#4f46e5","#0284c7","#059669","#d97706","#db2777"];
const GOAL_OPTIONS = [
  { value: "zhubnout a spalovat tuk",   label: "Zhubnout",  cls: "hubnutí" },
  { value: "nabrat svalovou hmotu",      label: "Nabrat svaly", cls: "svaly"   },
];

function createMemberCard(idx) {
  const card = document.createElement("div");
  card.className = "member-card";
  card.dataset.idx = idx;

  const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];

  card.innerHTML = `
    <div class="member-card-header">
      <div class="member-avatar av-${idx % 5}">${idx + 1}</div>
      <span class="member-title">Člen ${idx + 1}</span>
      ${idx > 0 ? `<button type="button" class="remove-member-btn" data-idx="${idx}">✕</button>` : ""}
    </div>

    <div class="input-row">
      <div class="form-group">
        <label>Jméno</label>
        <input type="text" class="m-jmeno" placeholder="např. Jan" required />
      </div>
      <div class="form-group">
        <label>Pohlaví</label>
        <div class="select-wrap">
          <select class="m-pohlavi">
            <option value="muz">Muž</option>
            <option value="zena">Žena</option>
          </select>
        </div>
      </div>
    </div>

    <div class="input-row">
      <div class="form-group">
        <label>Váha (kg)</label>
        <input type="number" class="m-vaha" placeholder="75" min="30" max="300" required />
      </div>
      <div class="form-group">
        <label>Výška (cm)</label>
        <input type="number" class="m-vyska" placeholder="175" min="100" max="250" required />
      </div>
      <div class="form-group">
        <label>Věk</label>
        <input type="number" class="m-vek" placeholder="30" min="10" max="100" required />
      </div>
    </div>

    <div class="form-group">
      <label>Cíl</label>
      <div class="goal-mini-row">
        <button type="button" class="goal-mini" data-goal="zhubnout a spalovat tuk">Zhubnout</button>
        <button type="button" class="goal-mini" data-goal="nabrat svalovou hmotu">Nabrat svaly</button>
      </div>
      <input type="hidden" class="m-goal" value="" />
    </div>
  `;

  // goal mini buttons
  card.querySelectorAll(".goal-mini").forEach(btn => {
    btn.addEventListener("click", () => {
      card.querySelectorAll(".goal-mini").forEach(b => b.classList.remove("active-svaly","active-hubnutí"));
      const isSvaly = btn.dataset.goal.includes("svalovou");
      btn.classList.add(isSvaly ? "active-svaly" : "active-hubnutí");
      card.querySelector(".m-goal").value = btn.dataset.goal;
      card.classList.remove("goal-svaly","goal-hubnutí");
      card.classList.add(isSvaly ? "goal-svaly" : "goal-hubnutí");
    });
  });

  // remove button
  const removeBtn = card.querySelector(".remove-member-btn");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      card.remove();
      reindexCards();
    });
  }

  return card;
}

function reindexCards() {
  document.querySelectorAll(".member-card").forEach((card, i) => {
    card.dataset.idx = i;
    card.querySelector(".member-avatar").textContent = i + 1;
    card.querySelector(".member-avatar").className = `member-avatar av-${i % 5}`;
    card.querySelector(".member-title").textContent = `Člen ${i + 1}`;
  });
  memberCount = document.querySelectorAll(".member-card").length;
}

function addMember() {
  if (document.querySelectorAll(".member-card").length >= 5) return;
  const card = createMemberCard(memberCount);
  membersContainer.appendChild(card);
  memberCount++;
}

addMemberBtn.addEventListener("click", addMember);

// start with one member
addMember();

/* ── COLLECT FORM DATA ──────────────────────────────────────── */
function collectMembers() {
  const cards = document.querySelectorAll(".member-card");
  const members = [];
  let valid = true;

  cards.forEach((card, i) => {
    const jmeno   = card.querySelector(".m-jmeno").value.trim() || `Člen ${i + 1}`;
    const vaha    = parseFloat(card.querySelector(".m-vaha").value);
    const vyska   = parseFloat(card.querySelector(".m-vyska").value);
    const vek     = parseInt(card.querySelector(".m-vek").value);
    const pohlavi = card.querySelector(".m-pohlavi").value;
    const goal    = card.querySelector(".m-goal").value;

    if (!vaha || !vyska || !vek || !goal) {
      valid = false;
      return;
    }
    members.push({ jmeno, vaha, vyska, vek, pohlavi, goal });
  });

  return valid ? members : null;
}

/* ── FORM SUBMIT ───────────────────────────────────────────── */
const formPage   = document.getElementById("formPage");
const resultPage = document.getElementById("resultPage");
const form       = document.getElementById("planForm");
const submitBtn  = document.getElementById("submitBtn");
const btnText    = document.getElementById("btnText");
const btnLoader  = document.getElementById("btnLoader");

let planData     = null;
let formSnapshot = {};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clenove = collectMembers();
  if (!clenove) {
    membersError.classList.remove("hidden");
    membersContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  membersError.classList.add("hidden");

  const budget = parseInt(document.getElementById("budget").value);
  const diet   = document.getElementById("diet").value;

  if (!budget || budget < 300) {
    document.getElementById("budget").focus();
    return;
  }

  formSnapshot = { clenove, budget, diet };
  setLoading(true);

  try {
    const res = await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formSnapshot),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Chyba serveru (${res.status})`);
    }

    planData = await res.json();
    renderResult(planData);
    formPage.classList.add("hidden");
    resultPage.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    alert("❌ " + err.message);
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  submitBtn.disabled = on;
  btnText.classList.toggle("hidden", on);
  btnLoader.classList.toggle("hidden", !on);
}

/* ── RENDER RESULT ─────────────────────────────────────────── */
function renderResult(data) {
  document.getElementById("resultTitle").textContent = data.nazevPlanu || "Rodinný jídelníček";
  document.getElementById("resultSub").textContent   = data.popisPlanu || "";

  const clenove = data.clenove || [];
  const people  = clenove.length || formSnapshot.clenove.length;

  // member profiles
  const profilesEl = document.getElementById("memberProfiles");
  profilesEl.innerHTML = "";
  clenove.forEach((cl, i) => {
    const isSvaly = cl.goal ? cl.goal.includes("svalovou") : false;
    const color   = MEMBER_COLORS[i % MEMBER_COLORS.length];
    profilesEl.innerHTML += `
      <div class="member-profile-card" style="border-left-color:${color}">
        <div class="mp-header">
          <div class="member-avatar av-${i % 5}" style="width:36px;height:36px;font-size:.85rem">${cl.jmeno ? cl.jmeno[0].toUpperCase() : i+1}</div>
          <div>
            <div class="mp-name">${cl.jmeno || `Člen ${i+1}`}</div>
            <div class="mp-goal ${isSvaly ? "goal-svaly-text" : "goal-hubnu-text"}">${isSvaly ? "Nabírání svalů" : "Hubnutí"}</div>
          </div>
          <div class="mp-macros">
            <span>${cl.ciloveKalorii || cl.makra?.kalorii || "—"} kcal</span>
            <span>${cl.makra?.bilkoviny || "—"}g bílkovin</span>
          </div>
        </div>
        ${cl.doporuceni ? `<p class="mp-tip">${cl.doporuceni}</p>` : ""}
      </div>`;
  });

  // summary
  const celkem = data.celkovaCena || sumNakup(data.nakupniSeznam);
  const dnuCount = (data.jidelnicek || []).length || 7;
  const perDen = people > 0 ? Math.round(celkem / dnuCount / people) : "—";

  document.getElementById("sumCena").textContent   = celkem + " Kč";
  document.getElementById("sumDen").textContent    = perDen + " Kč";
  document.getElementById("sumClenove").textContent = people + (people === 1 ? " člen" : people < 5 ? " členové" : " členů");

  // legend
  const legendEl = document.getElementById("legendRow");
  legendEl.innerHTML = "";
  clenove.forEach((cl, i) => {
    const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
    legendEl.innerHTML += `<span class="legend-dot" style="background:${color}"></span><span class="legend-name">${cl.jmeno || `Člen ${i+1}`}</span>`;
  });

  // meal plan days
  const dnyEl = document.getElementById("dnyContainer");
  dnyEl.innerHTML = "";
  for (const den of (data.jidelnicek || [])) {
    dnyEl.innerHTML += renderDen(den, clenove);
  }

  // shopping list
  const tbody = document.getElementById("nakupBody");
  tbody.innerHTML = "";
  let total = 0;
  for (const item of (data.nakupniSeznam || [])) {
    total += item.odhadovanaCena || 0;
    tbody.innerHTML += `<tr>
      <td>${item.polozka}</td>
      <td>${item.mnozstvi}</td>
      <td>${item.odhadovanaCena} Kč</td>
    </tr>`;
  }
  document.getElementById("nakupTotal").textContent = total + " Kč";

  // tips
  renderList("tipyUsporu", data.tipyNaUsporu);
  renderList("tipyVyziva", data.vyzivoveTipy);
}

function renderDen(den, clenove) {
  const meals = [
    { key: "snidane", icon: "🌅", label: "Snídaně" },
    { key: "obed",    icon: "☀️", label: "Oběd" },
    { key: "vecere",  icon: "🌙", label: "Večeře" },
  ];

  let rows = "";
  for (const m of meals) {
    const jidlo = den[m.key];
    if (!jidlo) continue;

    const ing = (jidlo.ingredience || []).slice(0, 4).join(", ");

    let adjustments = "";
    if (jidlo.upravy && typeof jidlo.upravy === "object") {
      adjustments = Object.entries(jidlo.upravy).map(([jmeno, uprava], i) => {
        const idx = clenove.findIndex(c => c.jmeno === jmeno);
        const colorIdx = idx >= 0 ? idx % 5 : i % 5;
        return `<span class="adj-chip adj-${colorIdx}">${jmeno}: ${uprava}</span>`;
      }).join("");
    }

    rows += `<div class="meal-block">
      <div class="meal-top">
        <span class="meal-icon">${m.icon}</span>
        <div class="meal-info">
          <div class="meal-name">${m.label}: ${jidlo.nazev}</div>
          <div class="meal-meta">${ing}${jidlo.cena ? ` · ${jidlo.cena} Kč` : ""}</div>
        </div>
        ${jidlo.kalorii && typeof jidlo.kalorii === "number" ? `<span class="meal-badge kcal-badge">${jidlo.kalorii} kcal</span>` : ""}
      </div>
      ${adjustments ? `<div class="meal-adjustments">${adjustments}</div>` : ""}
    </div>`;
  }

  return `<div class="den-card">
    <div class="den-header">${den.den}</div>
    <div class="den-body">${rows}</div>
  </div>`;
}

function renderList(id, items = []) {
  document.getElementById(id).innerHTML = (items || []).map(t => `<li>${t}</li>`).join("");
}

function sumNakup(seznam = []) {
  return (seznam || []).reduce((s, i) => s + (i.odhadovanaCena || 0), 0);
}

/* ── TABS ──────────────────────────────────────────────────── */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active");
      c.classList.add("hidden");
    });
    btn.classList.add("active");
    const el = document.getElementById("tab" + target);
    el.classList.remove("hidden");
    el.classList.add("active");
  });
});

/* ── COPY SHOPPING LIST ────────────────────────────────────── */
document.getElementById("copyBtn").addEventListener("click", () => {
  if (!planData) return;
  const lines = (planData.nakupniSeznam || [])
    .map(i => `${i.polozka} — ${i.mnozstvi} (~${i.odhadovanaCena} Kč)`)
    .join("\n");
  navigator.clipboard.writeText(lines).then(() => {
    const btn = document.getElementById("copyBtn");
    const orig = btn.textContent;
    btn.textContent = "✅ Zkopírováno!";
    setTimeout(() => (btn.textContent = orig), 2200);
  });
});

/* ── RESET ──────────────────────────────────────────────────── */
document.getElementById("resetBtn").addEventListener("click", () => {
  resultPage.classList.add("hidden");
  formPage.classList.remove("hidden");
  form.reset();
  planData = null;
  membersContainer.innerHTML = "";
  memberCount = 0;
  addMember();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
