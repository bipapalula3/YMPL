let INDEX = [];
let RESULTS = [];
let PAGE = 0;

// =========================
// 광고 전역 스위치 ⭐️
// =========================
const ADS_ENABLED = false;   // ❌ 지금은 OFF
// const ADS_ENABLED = true; // ✅ 승인 후 ON

// 🔁 검색 히스토리 (최대 15개)
const SEARCH_HISTORY_KEY = "ympl_search_history";
const SEARCH_INDEX_KEY = "ympl_search_index";
const SEARCH_DATE_KEY = "ympl_search_date";
const MAX_HISTORY = 15;
const PAGE_SIZE = 30;
let LOADING = false;
let EXTERNAL_QUERY = '';

// 기본 커버 이미지 (fallback)
const DEFAULT_COVER = 'icon80.png';

// -----------------------------
// AdSense 설정
// -----------------------------
const AD_CLIENT = "ca-pub-1954623157146783";
const AD_SLOT_MID = "9828698918";   // 7번째
const AD_SLOT_END = "3263290563";   // 마지막

// -----------------------------
// 개발자 모드 (?dev=1009)
// -----------------------------
const DEV_MODE = (() => {
  const params = new URLSearchParams(location.search);
  return params.get('dev') === '1009';
})();

// 🔍 디버그용 검색 통계 (DEV 전용)
const SEARCH_STATS = new Map();

// -----------------------------
// 인덱스 로딩
// -----------------------------
fetch('artist_song_index.json')
  .then(res => {
    if (!res.ok) throw new Error("index load failed");
    return res.json();
  })
  .then(data => INDEX = data)
  .catch(err => {
    console.error("❌ INDEX 로딩 실패", err);
    const countEl = document.getElementById("resultCount");
    if (countEl) countEl.textContent = "검색 인덱스를 불러오지 못했습니다";
  });

function goBackSmart() {
  if (window.__FROM_APP__ && window.AndroidApp) {
    AndroidApp.goBackToApp();   // ⭐ 핵심
  } else {
    location.href = "/index.html";
  }
}

// -----------------------------
// 토큰 분리
// -----------------------------
function splitMixedTokens(input) {
  return input
    .toLowerCase()
    .replace(/[_\-\/]+/g, ' ')
    .replace(/([가-힣])([a-z0-9])/gi, '$1 $2')
    .replace(/([a-z0-9])([가-힣])/gi, '$1 $2')
    .replace(/([0-9])([a-z가-힣])/gi, '$1 $2')
    .replace(/([a-z가-힣])([0-9])/gi, '$1 $2')
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function toggleSearchSheet() {
  const sheet = document.getElementById("searchSheet");
  const backdrop = document.getElementById("sheetBackdrop");
  if (!sheet || !backdrop) return;

  const isOpen = sheet.classList.contains("open");
  if (isOpen) {
    closeSearchSheet();
  } else {
    openSearchSheet();
  }
}

// -----------------------------
// debounce
// -----------------------------
function debounce(fn, delay = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 🔐 암호 키 검사 함수 (정규식 완료)
function isEncryptedKey(str) {
  if (!str) return false;
  const clean = str.trim().toUpperCase(); 
  return /^(?=(?:.*\d){8})(?=(?:.*[DNTO]){1})[0-9DNTO]{9}$/.test(clean);
}

// 🔐 커스텀 키 생성
function generateCustomKey(dateStr, typeChar) {
  if (dateStr.length !== 8) return dateStr; 

  const digits = dateStr.split('');
  let builder = "";

  for (let i = 0; i < digits.length; i += 2) {
    builder += digits[i];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    if (i % 2 === 1) {
      builder += digits[i];
    }
  }

  const reordered = builder;
  const dayOfMonth = parseInt(dateStr.substring(6, 8), 10);
  const dayFirstDigit = dayOfMonth.toString().padStart(2, '0')[0];
  const insertIndex = { '0': 0, '1': 1, '2': 2, '3': 3 }[dayFirstDigit] ?? 0;

  return (
    reordered.slice(0, insertIndex) +
    typeChar +
    reordered.slice(insertIndex)
  );
}

function renderSearchHistory() {
  const list = document.getElementById("searchHistoryList");
  if (!list) return;
  list.innerHTML = "";

  let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");

  history.slice(0, MAX_HISTORY).forEach((item, i) => {
    const displayTitle = typeof item === 'object' ? item.label : item;
    const searchKey = typeof item === 'object' ? item.key : item;

    const li = document.createElement("li");
    li.textContent = displayTitle || '';

    // 🛠️ 안전하게 문자열 체크하도록 변경
    const titleStr = displayTitle ? String(displayTitle) : "";

    if (
        [
            "Weekly New Kpop Releases",
            "Ktop Chart - Newest First",
            "Latest Kpop Debut Albums",
            "YMPL Kdrama OST"
        ].includes(titleStr) ||
        titleStr.startsWith("Kdrama OST ")
    )   {
        li.classList.add("reward-highlight");
    }

    li.onclick = () => {
      EXTERNAL_QUERY = searchKey;
      const url = new URL(location.href);
      url.searchParams.set('label', titleStr);
      window.history.replaceState({}, '', url);

      localStorage.setItem(SEARCH_INDEX_KEY, i.toString());
      PAGE = 0;
      RESULTS = [];
      const resEl = document.getElementById("result");
      if (resEl) resEl.innerHTML = "";
      closeSearchSheet();
      search({ updateHistory: false });
    };
    list.appendChild(li);
  });
}

function openSearchSheet() {
  document.getElementById("searchSheet")?.classList.add("open");
  document.getElementById("sheetBackdrop")?.style.setProperty("display", "block");
  renderSearchHistory();
}

function closeSearchSheet() {
  document.getElementById("searchSheet")?.classList.remove("open");
  document.getElementById("sheetBackdrop")?.style.setProperty("display", "none");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sheetBackdrop")?.addEventListener("click", closeSearchSheet);
  document.querySelector(".sheet-handle")?.addEventListener("click", closeSearchSheet);
});

function checkAndResetHistoryIfNeeded() {
  const today = new Date().toISOString().slice(0, 10); 
  const savedDate = localStorage.getItem(SEARCH_DATE_KEY);

  if (savedDate !== today) {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    localStorage.removeItem(SEARCH_INDEX_KEY);
    localStorage.setItem(SEARCH_DATE_KEY, today);
  }
}

function saveSearchKeyword(keyword, label = null) {
  let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  const newData = label ? { key: keyword, label: label } : keyword;
  
  history = history.filter(item => {
    const itemKey = typeof item === 'object' ? item.key : item;
    return itemKey !== keyword;
  });

  history.unshift(newData);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(SEARCH_INDEX_KEY, "0");
  localStorage.setItem(SEARCH_DATE_KEY, new Date().toISOString().slice(0, 10));
  renderSearchHistory();
}

function loadSearchByOffset(offset) {
  const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  let index = parseInt(localStorage.getItem(SEARCH_INDEX_KEY) || "0", 10);

  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= history.length) return;

  const item = history[nextIndex];
  const searchKey = typeof item === 'object' ? item.key : item;
  const displayTitle = typeof item === 'object' ? item.label : item;

  localStorage.setItem(SEARCH_INDEX_KEY, nextIndex.toString());
  EXTERNAL_QUERY = searchKey;

  const url = new URL(location.href);
  if (displayTitle) {
    url.searchParams.set('label', displayTitle);
  } else {
    url.searchParams.delete('label');
  }
  window.history.replaceState({}, '', url);

  PAGE = 0;
  RESULTS = [];
  const resEl = document.getElementById("result");
  if (resEl) resEl.innerHTML = "";

  search({ updateHistory: false });
}

function matchScore(token, keyword, weight) {
  if (token === keyword) return weight.exact;
  if (keyword.startsWith(token)) return weight.prefix;
  if (keyword.includes(token)) return weight.partial;
  return 0;
}

// 🔐 유효 암호키 생성
function buildValidEncryptedKeys(inputKey) {
  if (!isEncryptedKey(inputKey)) return null;

  const type = inputKey.toUpperCase().match(/[DNTO]/)?.[0]; 
  const today = new Date();
  let days = 90;
  
  if (type === 'D') days = 360;
  if (type === 'O') days = 360; 

  const keys = new Set();

  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const y = d.getFullYear().toString(); 
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const dateStr = `${y}${m}${day}`; 

    const encoded = generateCustomKey(dateStr, type);
    keys.add(encoded.toLowerCase()); 
    keys.add(encoded.toUpperCase()); 
  }
  return keys;
}

function runSearch(terms, mode) {
  const WEIGHTS = {
    recall: {
      title: { exact: 10, prefix: 6, partial: 3 },
      track: { exact: 4, prefix: 2, partial: 1 }
    },
    precision: {
      title: { exact: 20, prefix: 12, partial: 6 },
      track: { exact: 8, prefix: 4, partial: 2 }
    },
    relaxed: {
      title: { exact: 14, prefix: 8, partial: 4 },
      track: { exact: 6, prefix: 3, partial: 1 }
    }
  };

  const W = WEIGHTS[mode];

  return INDEX
    .map(item => {
      let score = 0;
      let matched = 0;

      for (const term of terms) {
        let best = 0;

        for (const k of item.keywords.title || []) {
          best = Math.max(best, matchScore(term, k, W.title));
        }
        for (const k of item.keywords.track || []) {
          best = Math.max(best, matchScore(term, k, W.track));
        }

        if (best > 0) {
          matched++;
          score += best;
        } else if (mode !== 'recall') {
          return null;
        }
      }

      if (mode === 'recall' && matched === 0) return null;

      if (item.title) {
        const normTitle = splitMixedTokens(item.title).join(' ');
        if (normTitle.includes(terms.join(' '))) {
          score += 15;
        }
      }

      return { ...item, _score: score };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);
}

function search({ updateHistory = true } = {}) {
  const raw = EXTERNAL_QUERY.trim();
  if (!raw) return;

  const urlParams = new URLSearchParams(location.search);
  const label = urlParams.get('label');
  const resultCountEl = document.getElementById('resultCount');

  if (updateHistory) {
    saveSearchKeyword(raw, label); 
  }

  if (isEncryptedKey(raw)) {
    const validKeys = buildValidEncryptedKeys(raw);
    if (!validKeys) return;

    RESULTS = INDEX
      .filter(item => {
        const titleKeys = item.keywords?.title || [];
        const trackKeys = item.keywords?.track || [];
        for (const k of titleKeys) { if (validKeys.has(k.toLowerCase())) return true; }
        for (const k of trackKeys) { if (validKeys.has(k.toLowerCase())) return true; }
        return false;
      })
      .sort((a, b) => {
        const getDate = (title) => {
          if (!title) return 0;
          const match = title.substring(0, 8);
          if (/^\d{8}$/.test(match)) {
            return parseInt(match, 10);
          }
          return 0;
        };
        const dateA = getDate(a.title);
        const dateB = getDate(b.title);
        return dateB - dateA;
      });

    if (resultCountEl) {
      resultCountEl.textContent = `${label || raw} 🔍 검색 결과 ${RESULTS.length}건`;
    }

    renderNextPage();
    return;
  } 

  const terms = splitMixedTokens(raw);
  if (!terms.length) return;

  const queryKey = terms.join(' ');
  const debugMode = DEV_MODE && document.getElementById('debugToggle')?.checked;

  const recall = runSearch(terms, 'recall');
  const precision = recall.length >= 10 ? runSearch(terms, 'precision') : [];
  const relaxed = recall.length >= 10 && precision.length < 3 ? runSearch(terms, 'relaxed') : [];

  let finalResults = recall;
  let path = `recall(${recall.length})`;

  if (recall.length >= 10 && precision.length >= 3) {
    finalResults = precision;
    path += ` → precision(${precision.length})`;
  } else if (recall.length >= 10) {
    finalResults = relaxed;
    path += ` → precision(${precision.length}) → relaxed(${relaxed.length})`;
  }

  RESULTS = finalResults;

  if (debugMode) {
    const stat = SEARCH_STATS.get(queryKey) || { count: 0, total: 0 };
    stat.count++; stat.total += RESULTS.length;
    SEARCH_STATS.set(queryKey, stat);
    const avg = (stat.total / stat.count).toFixed(1);

    const debugDiv = document.createElement('div');
    debugDiv.id = 'debugLog';
    debugDiv.className = 'search-debug';
    debugDiv.innerHTML = `🔍 검색 전략: ${path}<br/>📊 평균 결과 수: ${avg}`;
    resultCountEl?.after(debugDiv);
  }

  if (resultCountEl) {
    resultCountEl.textContent = `${label || EXTERNAL_QUERY} 🔍 검색 결과 ${RESULTS.length}건`;
  }
  
  renderNextPage();
}

function createAdItem(slotId) {
  if (!ADS_ENABLED) return null; 
  
  const li = document.createElement("li");
  li.className = "ad-card";

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.dataset.adClient = AD_CLIENT;
  ins.dataset.adSlot = slotId;
  ins.dataset.adFormat = "fluid";
  ins.dataset.adLayoutKey = "-gw-3+1f-3d+2z";

  li.appendChild(ins);

  setTimeout(() => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
      setTimeout(() => {
        if (!ins.querySelector("iframe")) {
          li.remove();
        }
      }, 1500);
    } catch (e) {
      li.remove();
    }
  }, 0);

  return li;
}

function getAdPositions(total) {
  if (total <= 6) return ["end"];
  if (total <= 13) return [6];       
  return [6, "end"];                 
}

function renderNextPage() {
  if (LOADING) return;
  LOADING = true;

  const urlParams = new URLSearchParams(location.search);
  const hideChart = urlParams.get("hideChart") === "true";
  const dateRegex = /^\d{8}/;

  const slice = RESULTS.slice(PAGE * PAGE_SIZE, (PAGE + 1) * PAGE_SIZE);

  if (!slice.length) {
    LOADING = false;
    return;
  }

  const ul = document.getElementById('result');
  if (!ul) {
    LOADING = false;
    return;
  }

  const total = RESULTS.length;
  const adPositions = getAdPositions(total);
  let renderedCount = PAGE * PAGE_SIZE;

  slice.forEach((item, i) => {
    const title = item.title || "";
    if (hideChart && dateRegex.test(title)) {
      return;
    }

    const globalIndex = renderedCount + i;

    if (!window.__FROM_APP__ && adPositions.includes(globalIndex)) {
      const ad = createAdItem(AD_SLOT_MID);
      if (ad) ul.appendChild(ad);
    }

    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.link;
    link.className = 'search-link';

    link.addEventListener("click", (e) => {
      if (window.__FROM_APP__) {
        e.preventDefault();
        const url = new URL(item.link, location.href);
        url.searchParams.set("from", "app");
        location.href = url.toString();
      }
    });

    const card = document.createElement('div');
    card.className = 'search-item';

    const content = document.createElement('div');
    content.className = 'search-content';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'search-title';
    titleDiv.textContent = item.title;

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    preview.textContent = item.preview || '';

    content.append(titleDiv, preview);

    let img;
    if (item.cover) {
      img = document.createElement('img');
      img.className = 'search-cover';
      img.loading = 'lazy';
      img.src = item.cover;
      img.onerror = () => img.remove();
    } else {
      img = document.createElement('img');
      img.className = 'search-cover';
      img.loading = 'lazy';
      img.src = DEFAULT_COVER;
    }

    card.append(content);
    if (img) card.appendChild(img);

    link.appendChild(card);
    li.appendChild(link);
    ul.appendChild(li);
  });

  if (!window.__FROM_APP__ && adPositions.includes("end")) {
    const ad = createAdItem(AD_SLOT_END);
    if (ad) ul.appendChild(ad);
  }

  PAGE++;
  LOADING = false;
}

window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 120) {
    renderNextPage();
  }
});

// 🛠️ DOMContentLoaded 내부 요소 예외처리 강화 (? 안전장치 추가)
document.addEventListener('DOMContentLoaded', function () {
  checkAndResetHistoryIfNeeded();
  const params = new URLSearchParams(location.search);

  const FROM_APP = params.get('from') === 'app';
  window.__FROM_APP__ = FROM_APP;

  const bottomNav = document.getElementById("bottomNav");
  if (bottomNav) bottomNav.style.display = "flex";

  const navHome = document.getElementById("navHome");
  if (navHome) {
    navHome.onclick = () => {
      if (window.__FROM_APP__ && window.AndroidApp) {
        AndroidApp.goBackToApp();
      } else {
        location.href = "/index.html";
      }
    };
  }

  const navSearch = document.getElementById("navSearch");
  if (navSearch) navSearch.onclick = toggleSearchSheet;

  const navPrev = document.getElementById("navPrev");
  if (navPrev) navPrev.onclick = () => loadSearchByOffset(+1);

  const navNext = document.getElementById("navNext");
  if (navNext) navNext.onclick = () => loadSearchByOffset(-1);

  const encryptedKey = params.get('q');
  const displayLabel = params.get('label');

  if (encryptedKey) {
    EXTERNAL_QUERY = encryptedKey;
    saveSearchKeyword(encryptedKey, displayLabel);
  } else {
    const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    const index = parseInt(localStorage.getItem(SEARCH_INDEX_KEY) || "0", 10);
    if (history[index]) {
      const item = history[index];
      EXTERNAL_QUERY = typeof item === 'object' ? item.key : item;
    }
  }

  const waitForIndex = setInterval(() => {
    if (INDEX && INDEX.length > 0) {
      clearInterval(waitForIndex);
      search();
    }
  }, 50);
});

let _handlingBack = false;
window.addEventListener("popstate", function () {
  if (_handlingBack) return;
  _handlingBack = true;
  goBackSmart();
});

