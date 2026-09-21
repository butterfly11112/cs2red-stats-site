// CS2RED Stats — frontend
// Talks only to our own backend (/api/profile, /api/compare), which does
// the actual work of reaching cs2red.ru. Same origin, no CORS involved.

const ROLES = {
  1: { name: "Игрок", hex: "#c7c9d1" },
  2: { name: "Мл. Модератор", hex: "#82ac96" },
  3: { name: "Модератор", hex: "#00d084" },
  4: { name: "Куратор", hex: "#f000bc" },
  5: { name: "Руководство", hex: "#a366ff" },
  6: { name: "Разработчик", hex: "#ffd166" },
  7: { name: "Спонсор", hex: "#66997c" },
  8: { name: "Админ", hex: "#82ac96" },
  9: { name: "Ст. Админ", hex: "#91ac96" },
  10: { name: "Управляющий", hex: "#e5e5e5" },
  11: { name: "YouTube", hex: "#ff5c5c" },
  13: { name: "Гл. Модератор", hex: "#df6365" },
  14: { name: "Руководство MG", hex: "#e5e5e5" },
};

const AWARDS = {
  2: { name: "Bp1", img: "https://files.cs2red.ru/public/icons/star-dynamic-color.png" },
  3: { name: "Bp2", img: "https://files.cs2red.ru/public/icons/medal-dynamic-color.png" },
  4: { name: "Bp3", img: "https://files.cs2red.ru/public/icons/crow-dynamic-color.png" },
  5: { name: "2024", img: "https://files.cs2red.ru/public/icons/8599063.webp" },
  6: { name: "Plus", img: "https://files.cs2red.ru/public/icons/plus_v2.png" },
  7: { name: "Spring", img: "https://files.cs2red.ru/public/icons/spring_season1.png" },
  8: { name: "Sun25", img: "https://files.cs2red.ru/public/icons/sunv3.png" },
  9: { name: "Fal25", img: "https://files.cs2red.ru/public/icons/fall.png" },
  10: { name: "Win25", img: "https://files.cs2red.ru/public/icons/25winter.png" },
  11: { name: "Spr26", img: "https://files.cs2red.ru/public/icons/1_medal.png" },
  12: { name: "Only UP", img: "https://files.cs2red.ru/public/icons/aw14.png" },
  13: { name: "Yo26", img: "https://files.cs2red.ru/public/newbp/medal_premium.png" },
  14: { name: "Surf", img: "https://files.cs2red.ru/public/icons/surf.png" },
  15: { name: "Fal26", img: "https://files.cs2red.ru/public/emberfall/medal_fall.png" },
};

function getAllVips(user) {
  const vips = Array.isArray(user.vips) ? user.vips : [];
  const now = Date.now();
  return vips
    .map((v) => ({ ...v, active: v.expires === 0 || v.expires * 1000 > now }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1; // active ones first
      if (a.active) return (b.priority ?? 0) - (a.priority ?? 0); // higher priority first
      return (b.expires ?? 0) - (a.expires ?? 0); // most recently expired first
    });
}

// --- Mode tabs -------------------------------------------------------

const modeSingleBtn = document.getElementById("modeSingleBtn");
const modeCompareBtn = document.getElementById("modeCompareBtn");
const singleMode = document.getElementById("singleMode");
const compareMode = document.getElementById("compareMode");

modeSingleBtn.addEventListener("click", () => setMode("single"));
modeCompareBtn.addEventListener("click", () => setMode("compare"));

function setMode(mode) {
  const isSingle = mode === "single";
  modeSingleBtn.classList.toggle("active", isSingle);
  modeCompareBtn.classList.toggle("active", !isSingle);
  singleMode.classList.toggle("hidden", !isSingle);
  compareMode.classList.toggle("hidden", isSingle);
}

// --- Single-player mode -------------------------------------------------

const form = document.getElementById("searchForm");
const input = document.getElementById("steamInput");
const btn = document.getElementById("searchBtn");
const statusEl = document.getElementById("status");
const card = document.getElementById("card");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSearch();
});

try {
  const last = localStorage.getItem("cs2redLastQuery");
  if (last) input.value = last;
} catch {}

async function handleSearch() {
  const raw = input.value.trim();
  if (!raw) return;

  try {
    localStorage.setItem("cs2redLastQuery", raw);
  } catch {}

  setStatus("Ищу игрока…");
  card.classList.add("hidden");
  setLoading(true);

  try {
    const resp = await fetch(`/api/profile?q=${encodeURIComponent(raw)}`);
    const data = await resp.json();

    if (!data.success) {
      setStatus(errorMessage(data.error), true);
      return;
    }

    renderProfile(data.user, data.steamid64);
    setStatus("", false, true);
  } catch (err) {
    console.error(err);
    setStatus("Ошибка запроса. Попробуйте ещё раз чуть позже.", true);
  } finally {
    setLoading(false);
  }
}

function errorMessage(code) {
  switch (code) {
    case "bad_input":
      return "Не удалось распознать Steam-профиль. Вставьте ссылку вида steamcommunity.com/id/имя или steamcommunity.com/profiles/765611..., либо сам SteamID64.";
    case "steam_not_found":
      return "Не удалось найти такой Steam-профиль.";
    case "cs2red_not_found":
      return "Игрок не найден на CS2RED (не заходил на сервер).";
    default:
      return "Не получилось получить данные. Попробуйте ещё раз.";
  }
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "…" : "Найти";
}

function setStatus(text, isError = false, hide = false) {
  if (hide || !text) {
    statusEl.classList.add("hidden");
    return;
  }
  statusEl.textContent = text;
  statusEl.classList.remove("hidden");
  statusEl.classList.toggle("error", isError);
}

function renderProfile(user, steamid64) {
  const rank = user.rank || {};
  const kills = rank.kills ?? 0;
  const deaths = rank.deaths ?? 0;
  const assists = rank.assists ?? 0;
  const hits = rank.hits ?? 0;
  const shots = rank.shots ?? 0;
  const points = rank.points ?? 0;

  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
  const acc = shots > 0 ? Math.floor((hits / shots) * 100) : 0;

  document.getElementById("avatar").src = user.avatarHash
    ? `https://avatars.steamstatic.com/${user.avatarHash}_full.jpg`
    : "";
  document.getElementById("nick").textContent = user.nick || "—";

  const role = ROLES[user.roleId] || { name: "Игрок", hex: "#c7c9d1" };
  const roleBadge = document.getElementById("roleBadge");
  roleBadge.textContent = role.name;
  roleBadge.style.color = role.hex;

  const vips = getAllVips(user);
  const vipBadges = document.getElementById("vipBadges");
  vipBadges.innerHTML = "";
  if (vips.length) {
    for (const v of vips) {
      const el = document.createElement("div");
      el.className = "vip-badge" + (v.active ? "" : " expired");
      el.textContent =
        "VIP " +
        v.group +
        (v.active
          ? v.expires === 0
            ? " · бессрочно"
            : " · до " + formatDate(v.expires)
          : " · истёк " + formatDate(v.expires));
      vipBadges.appendChild(el);
    }
    vipBadges.classList.remove("hidden");
  } else {
    vipBadges.classList.add("hidden");
  }

  const awardsRow = document.getElementById("awardsRow");
  awardsRow.innerHTML = "";
  const awardIds = Array.isArray(user.awards) ? user.awards.map((a) => a.awardId) : [];
  const knownAwards = awardIds.map((id) => AWARDS[id]).filter(Boolean);
  if (knownAwards.length) {
    for (const a of knownAwards) {
      const img = document.createElement("img");
      img.className = "award-icon";
      img.src = a.img;
      img.title = a.name;
      img.alt = a.name;
      awardsRow.appendChild(img);
    }
    awardsRow.classList.remove("hidden");
  } else {
    awardsRow.classList.add("hidden");
  }

  const clanTagEl = document.getElementById("clanTag");
  const clan = Array.isArray(user.clan) && user.clan.length ? user.clan[0].clan : null;
  if (clan) {
    clanTagEl.textContent = `[${stripInvisible(clan.tag || "")}]`;
    clanTagEl.classList.remove("hidden");
  } else {
    clanTagEl.classList.add("hidden");
  }

  document.getElementById("statPoints").textContent = formatNum(points);
  document.getElementById("statCoins").textContent = formatNum(user.coins ?? 0);
  document.getElementById("statKills").textContent = formatNum(kills);
  document.getElementById("statDeaths").textContent = formatNum(deaths);
  document.getElementById("statAssists").textContent = formatNum(assists);
  document.getElementById("statKD").textContent = kd;
  document.getElementById("statAcc").textContent = acc + "%";
  document.getElementById("statTier").textContent = rank.rankId ?? "—";

  document.getElementById("metaReg").textContent = user.regDate ? formatDate(user.regDate) : "—";
  document.getElementById("metaLast").textContent = user.lastDate ? formatDate(user.lastDate) : "—";
  document.getElementById("metaClan").textContent = clan ? stripInvisible(clan.name || "—") : "—";

  const plusActive = user.plusEndingDate && user.plusEndingDate * 1000 > Date.now();
  document.getElementById("metaPlus").textContent = plusActive
    ? "Активна до " + formatDate(user.plusEndingDate)
    : "Нет";

  const link = document.getElementById("cs2redLink");
  link.href = `https://cs2red.ru/profile/${steamid64}`;
  link.classList.remove("hidden");

  card.classList.remove("hidden");
}

// --- Compare mode ---------------------------------------------------------

const compareForm = document.getElementById("compareForm");
const compareInput1 = document.getElementById("compareInput1");
const compareInput2 = document.getElementById("compareInput2");
const compareBtn = document.getElementById("compareBtn");
const compareStatusEl = document.getElementById("compareStatus");
const compareCard = document.getElementById("compareCard");

compareForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleCompare();
});

async function handleCompare() {
  const raw1 = compareInput1.value.trim();
  const raw2 = compareInput2.value.trim();
  if (!raw1 || !raw2) {
    setCompareStatus("Вставьте ссылки на обоих игроков.", true);
    return;
  }

  setCompareStatus("Ищу игроков…");
  compareCard.classList.add("hidden");
  setCompareLoading(true);

  try {
    const resp = await fetch(
      `/api/compare?a=${encodeURIComponent(raw1)}&b=${encodeURIComponent(raw2)}`
    );
    const data = await resp.json();

    if (!data.success) {
      setCompareStatus("Один из игроков не найден.", true);
      return;
    }

    renderCompare(data.a.user, data.b.user);
    setCompareStatus("", false, true);
  } catch (err) {
    console.error(err);
    setCompareStatus("Ошибка запроса. Попробуйте ещё раз чуть позже.", true);
  } finally {
    setCompareLoading(false);
  }
}

function setCompareLoading(isLoading) {
  compareBtn.disabled = isLoading;
  compareBtn.textContent = isLoading ? "…" : "Сравнить";
}

function setCompareStatus(text, isError = false, hide = false) {
  if (hide || !text) {
    compareStatusEl.classList.add("hidden");
    return;
  }
  compareStatusEl.textContent = text;
  compareStatusEl.classList.remove("hidden");
  compareStatusEl.classList.toggle("error", isError);
}

function renderCompare(u1, u2) {
  document.getElementById("compareAvatar1").src = u1.avatarHash
    ? `https://avatars.steamstatic.com/${u1.avatarHash}_full.jpg`
    : "";
  document.getElementById("compareAvatar2").src = u2.avatarHash
    ? `https://avatars.steamstatic.com/${u2.avatarHash}_full.jpg`
    : "";
  document.getElementById("compareNick1").textContent = u1.nick || "—";
  document.getElementById("compareNick2").textContent = u2.nick || "—";

  const r1 = u1.rank || {};
  const r2 = u2.rank || {};
  const kd1 = r1.deaths > 0 ? r1.kills / r1.deaths : r1.kills || 0;
  const kd2 = r2.deaths > 0 ? r2.kills / r2.deaths : r2.kills || 0;
  const acc1 = r1.shots > 0 ? Math.floor((r1.hits / r1.shots) * 100) : 0;
  const acc2 = r2.shots > 0 ? Math.floor((r2.hits / r2.shots) * 100) : 0;

  const rows = [
    ["Рейтинг", r1.points ?? 0, r2.points ?? 0, formatNum],
    ["Коины", u1.coins ?? 0, u2.coins ?? 0, formatNum],
    ["Убийства", r1.kills ?? 0, r2.kills ?? 0, formatNum],
    ["Смерти", r1.deaths ?? 0, r2.deaths ?? 0, formatNum, true],
    ["Помощь", r1.assists ?? 0, r2.assists ?? 0, formatNum],
    ["K/D", kd1, kd2, (n) => n.toFixed(2)],
    ["Точность", acc1, acc2, (n) => n + "%"],
    ["Тир ранга", r1.rankId ?? 0, r2.rankId ?? 0, (n) => String(n)],
  ];

  const table = document.getElementById("compareTable");
  table.innerHTML = "";
  for (const [label, v1, v2, fmt, lowerIsBetter] of rows) {
    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.className = "val-cell";
    td1.textContent = fmt(v1);

    const labelTd = document.createElement("td");
    labelTd.className = "stat-label-cell";
    labelTd.textContent = label;

    const td2 = document.createElement("td");
    td2.className = "val-cell";
    td2.textContent = fmt(v2);

    if (v1 !== v2) {
      const firstWins = lowerIsBetter ? v1 < v2 : v1 > v2;
      (firstWins ? td1 : td2).classList.add("winner");
    }

    tr.appendChild(td1);
    tr.appendChild(labelTd);
    tr.appendChild(td2);
    table.appendChild(tr);
  }

  compareCard.classList.remove("hidden");
}

// --- Shared helpers ---------------------------------------------------

function formatNum(n) {
  return Number(n || 0).toLocaleString("ru-RU");
}

function formatDate(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function stripInvisible(str) {
  return str.replace(/[\u0000-\u001f​-‏]/g, "").trim();
}
