/* =====================================================
   MY MUSIC PLAYER  (player.js)
   Songs = Spotify track IDs (open.spotify.com/track/<ID>)
   ===================================================== */

// ---------- 1. Songs ----------
// id = Spotify track ID. Pudhu song add panna: link paste panna podhum
const baseSongs = [
  // ---- Love ----
  { id: "5DDLAB4LebIL5capAAHBFa", title: "Chella Magale",        movie: "Jana Nayagan",       category: "love" },
  { id: "0sMveuaRdkEHZpCHpCAhvt", title: "Magale",               movie: "Baththa",            category: "love" },
  { id: "6w7bnFiz3Av9eVj16VMPxg", title: "Chellamma",            movie: "Doctor",             category: "love" },
  { id: "7m0dc2Kq9rQl1KMF14Sp2J", title: "Nee Paartha Vizhigal", movie: "3",                  category: "love" },
  { id: "3BIaZOfWGHGR5fuzqEsVlw", title: "Idhazhin Oram",        movie: "3",                  category: "love" },
  { id: "6sPW145Y3LSXd4p1LjBOcS", title: "Kanave Kanave",        movie: "David",              category: "love" },
  { id: "4E5EbxlJXs1I7HKCV7BM2A", title: "Thangamey",            movie: "Naanum Rowdy Dhaan", category: "love" },
  { id: "7qZ4F8G3V72xOpMvXvFzet", title: "Neeyum Naanum",        movie: "Naanum Rowdy Dhaan", category: "love" },
  // ---- Breakup ----
  { id: "3TXaAiPTBLvim6XVpMbFtK", title: "Po Nee Po",            movie: "3",                  category: "breakup" },
  { id: "3iWNa1ldhthqC57og7mubL", title: "Why This Kolaveri Di", movie: "3",                  category: "breakup" },
  { id: "3PfMPWmWolv0DQJooK1f8A", title: "Sirikkadhey",          movie: "Remo",               category: "breakup" },
];

// ---------- 2. Small helpers ----------
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
const $ = (id) => document.getElementById(id);

// Safe element create (textContent => XSS illa)
function el(tag, className = "", text = "") {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

// Spotify link -> track ID
function parseTrackId(text) {
  const m = text.trim().match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})/)
         || text.trim().match(/^spotify:track:([A-Za-z0-9]{22})$/);
  return m ? m[1] : null;
}

// ---------- 3. Elements ----------
const cover = $("cover"), coverImg = $("coverImg"), coverEmoji = $("coverEmoji");
const titleEl = $("title"), metaEl = $("meta"), chipEl = $("chip");
const playBtn = $("playBtn"), prevBtn = $("prevBtn"), nextBtn = $("nextBtn");
const shuffleBtn = $("shuffleBtn"), autoBtn = $("autoBtn"), autoLabel = $("autoLabel");
const listEl = $("list"), searchEl = $("search"), countEl = $("count");
const tabsEl = $("tabs"), themeBtn = $("themeBtn");

// ---------- 4. State ----------
const custom = load("mp-custom", []);                   // neenga link la add pannina songs
const songs = [...baseSongs, ...custom];
let tab = "all";
let currentId = load("mp-current", songs[0].id);
if (!songs.some((s) => s.id === currentId)) currentId = songs[0].id;
let shuffle = load("mp-shuffle", false);
let autoplay = load("mp-autoplay", true);
let view = [];                                          // ippo list la irukkura songs
let isPlaying = false;

const songById = (id) => songs.find((s) => s.id === id);

// ---------- 5. Theme (Light / Dark) ----------
function applyTheme(light) {
  document.body.classList.toggle("light", light);
  themeBtn.textContent = light ? "☀️" : "🌙";
  save("mp-theme", light ? "light" : "dark");
}
themeBtn.addEventListener("click", () => applyTheme(!document.body.classList.contains("light")));

// ---------- 6. Song picture (Spotify oEmbed) ----------
const meta = load("mp-meta", {});          // { id: thumbnailUrl }

async function getThumb(id) {
  if (meta[id]) return meta[id];
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent("https://open.spotify.com/track/" + id)}`);
    if (!res.ok) throw new Error("oembed failed");
    const data = await res.json();
    meta[id] = data.thumbnail_url || "";
    save("mp-meta", meta);
    return meta[id];
  } catch {
    return "";                             // picture kidaikkala na emoji kaattum
  }
}

// ---------- 7. Spotify player (iFrame API) ----------
let controller = null;
let wantPlay = false;                      // song load aana udane play pannanuma
let fallbackFrame = null;
let lastPos = 0, lastDur = 0, advanced = false;

const uriFor = (id) => `spotify:track:${id}`;

// Spotify API ready aana udane Spotify itself indha function ah call pannum
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  IFrameAPI.createController(
    $("spPlayer"),
    { width: "100%", height: 152, uri: uriFor(currentId) },
    (c) => {
      controller = c;
      c.addListener("ready", () => { if (wantPlay) { wantPlay = false; c.play(); } });
      c.addListener("playback_update", onPlayback);
    }
  );
};

// API 6 second la varalana (offline / blocked): simple embed use pannrom
setTimeout(() => {
  if (controller) return;
  fallbackFrame = document.createElement("iframe");
  fallbackFrame.height = 152;
  fallbackFrame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  fallbackFrame.src = `https://open.spotify.com/embed/track/${currentId}?utm_source=generator`;
  $("spPlayer").replaceWith(fallbackFrame);
}, 6000);

// Play / pause state + autoplay next
function onPlayback(e) {
  const d = e.data;
  if (!d) return;

  isPlaying = !d.isPaused && !d.isBuffering;
  playBtn.textContent = isPlaying ? "⏸" : "▶";
  cover.classList.toggle("playing", isPlaying);

  // Song mudinjucha? (position end ku vandhuchu, illa 0 ku reset aagi pause aachu)
  const nearEnd = d.duration > 0 && d.position >= d.duration - 400;
  const resetAfterEnd = d.isPaused && d.position === 0 && lastDur > 0 && lastPos >= lastDur - 2000;

  if ((nearEnd || resetAfterEnd) && !advanced) {
    advanced = true;
    if (autoplay) setTimeout(nextSong, 700);
  }
  lastPos = d.position;
  lastDur = d.duration;
}

// ---------- 8. Load a song ----------
function loadSong(id, play = false) {
  const song = songById(id);
  if (!song) return;
  currentId = id;
  save("mp-current", id);
  lastPos = 0; lastDur = 0; advanced = false;

  titleEl.textContent = song.title;
  metaEl.textContent = `🎬 ${song.movie}`;
  chipEl.textContent = song.category === "love" ? "💙 love" : "💔 breakup";
  document.title = `${song.title} · My Music Player`;

  // picture
  coverImg.classList.remove("show");
  coverEmoji.textContent = song.category === "love" ? "💙" : "💔";
  getThumb(id).then((url) => {
    if (currentId !== id || !url) return;      // vera song ku maariduchu na vitru
    coverImg.onload = () => coverImg.classList.add("show");
    coverImg.src = url;
  });

  // Spotify player
  wantPlay = play;
  if (controller) {
    controller.loadUri(uriFor(id));
    if (play) setTimeout(() => { if (wantPlay) { wantPlay = false; controller.play(); } }, 800);
  } else if (fallbackFrame) {
    fallbackFrame.src = `https://open.spotify.com/embed/track/${id}?utm_source=generator${play ? "&autoplay=1" : ""}`;
  }

  render();
}

// ---------- 9. Next / Previous / Shuffle / Autoplay ----------
function nextSong() {
  const list = view.length ? view : songs;
  let i = list.findIndex((s) => s.id === currentId);
  if (shuffle && list.length > 1) {
    let j;
    do { j = Math.floor(Math.random() * list.length); } while (j === i);
    i = j;
  } else {
    i = (i + 1) % list.length;
  }
  loadSong(list[i].id, true);
}

function prevSong() {
  const list = view.length ? view : songs;
  const i = list.findIndex((s) => s.id === currentId);
  loadSong(list[(i - 1 + list.length) % list.length].id, true);
}

function updateToggles() {
  shuffleBtn.classList.toggle("on", shuffle);
  autoBtn.classList.toggle("on", autoplay);
  autoLabel.textContent = `Autoplay: ${autoplay ? "ON" : "OFF"}`;
}

nextBtn.addEventListener("click", nextSong);
prevBtn.addEventListener("click", prevSong);
playBtn.addEventListener("click", () => {
  if (controller) controller.togglePlay();
  else loadSong(currentId, true);
});
shuffleBtn.addEventListener("click", () => { shuffle = !shuffle; save("mp-shuffle", shuffle); updateToggles(); });
autoBtn.addEventListener("click", () => { autoplay = !autoplay; save("mp-autoplay", autoplay); updateToggles(); });

// ---------- 10. Song list (tabs + search) ----------
function getView() {
  const q = searchEl.value.toLowerCase().trim();
  const list = tab === "all" ? songs : songs.filter((s) => s.category === tab);
  return list.filter((s) => s.title.toLowerCase().includes(q) || s.movie.toLowerCase().includes(q));
}

function render() {
  view = getView();
  listEl.innerHTML = "";
  countEl.textContent = `${view.length} song${view.length === 1 ? "" : "s"}`;

  if (view.length === 0) {
    listEl.appendChild(el("p", "empty-msg", "No songs found 😕"));
    return;
  }

  view.forEach((song) => {
    const li = el("li");
    if (song.id === currentId) li.classList.add("active");

    const thumb = el("div", "thumb", song.category === "love" ? "💙" : "💔");
    getThumb(song.id).then((url) => {
      if (!url) return;
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      thumb.appendChild(img);
    });

    const info = el("div", "info");
    info.append(el("div", "name", song.title), el("div", "by", `${song.movie} · ${song.category}`));

    li.append(thumb, info);
    li.addEventListener("click", () => loadSong(song.id, true));
    listEl.appendChild(li);
  });
}

searchEl.addEventListener("input", render);

tabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  tab = btn.dataset.tab;
  tabsEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

// ---------- 11. Add any Spotify song by link ----------
$("linkBtn").addEventListener("click", async () => {
  const msg = $("linkMsg");
  const id = parseTrackId($("linkInput").value);
  if (!id) { msg.textContent = "Sariyaana Spotify song link paste pannunga 😕"; msg.className = "muted small error"; return; }
  if (songById(id)) { msg.textContent = "Intha song already irukku 🙂"; msg.className = "muted small"; return; }

  msg.textContent = "Adding…"; msg.className = "muted small";

  // oEmbed la irundhu title edukkrom
  let title = "Custom song";
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent("https://open.spotify.com/track/" + id)}`);
    const data = await res.json();
    if (data.title) title = data.title;
    if (data.thumbnail_url) { meta[id] = data.thumbnail_url; save("mp-meta", meta); }
  } catch {}

  const song = { id, title, movie: "Custom", category: $("linkCat").value };
  custom.push(song);
  songs.push(song);
  save("mp-custom", custom);

  $("linkInput").value = "";
  msg.textContent = `"${title}" added ✅`;
  render();
});

// ---------- 12. Keyboard ----------
document.addEventListener("keydown", (e) => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "n") nextSong();
  if (k === "p") prevSong();
  if (k === "s") { shuffle = !shuffle; save("mp-shuffle", shuffle); updateToggles(); }
});

// ---------- 13. Start ----------
applyTheme(load("mp-theme", "dark") === "light");
updateToggles();
loadSong(currentId, false);        // load pannum, aana auto play aagathu (browser rule)