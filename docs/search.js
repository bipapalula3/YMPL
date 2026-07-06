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
    document.getElementById("resultCount").textContent =
      "검색 인덱스를 불러오지 못했습니다";
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

// 🔐 암호 키 검사 함수
function isEncryptedKey(str) {
  if (!str) return false;
  const clean = str.trim().toUpperCase(); 
  // 🛠️ DNTO 로 변경하여 'O' 식별자를 허용합니다.
  return /^(?=(?:.*\d){8})(?=(?:.*[DNTO]){1})[0-9DNTO]{9}$/.test(clean);
}

// 🔐 커스텀 키 생성
function generateCustomKey(dateStr, typeChar) {
  if (dateStr.length !== 8) return dateStr; // 8자리(yyyyMMdd) 확인

  const digits = dateStr.split('');
  let builder = "";

  // 1️⃣ 짝수 인덱스 정방향 (0,2,4,6) -> 20260220 기준 '2', '2', '0', '2'
  for (let i = 0; i < digits.length; i += 2) {
    builder += digits[i];
  }

  // 2️⃣ 홀수 인덱스 역방향 (7,5,3,1)
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
    // item이 객체면 label을, 문자열이면 item 자체를 제목으로 사용
    const displayTitle = typeof item === 'object' ? item.label : item;
    const searchKey = typeof item === 'object' ? item.key : item;

    const li = document.createElement("li");
    li.textContent = displayTitle;

    if (
        [
            "Weekly New Kpop Releases",
            "Ktop Chart - Newest First",
            "Latest Kpop Debut Albums"
        ].includes(displayTitle) ||
        (
            displayTitle.startsWith("Kdrama OST ")
        )
    )   {
        li.classList.add("reward-highlight");
    }

    li.onclick = () => {
      // 클릭 시 실제 검색은 key(암호키)로 수행
      EXTERNAL_QUERY = searchKey;
      // 화면 표시를 위해 URL의 label 파라미터 강제 업데이트 (선택 사항)
      const url = new URL(location.href);
      url.searchParams.set('label', displayTitle);
      window.history.replaceState({}, '', url);

      localStorage.setItem(SEARCH_INDEX_KEY, i.toString());
      PAGE = 0;
      RESULTS = [];
      document.getElementById("result").innerHTML = "";
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
  // 1. 기존 배경 클릭 시 닫기
  document.getElementById("sheetBackdrop")
    ?.addEventListener("click", closeSearchSheet);

  // 2. ⭐ 핸들바(끝부분/내리기 표시) 클릭 시 닫기 (이 코드를 추가하세요!)
  document.querySelector(".sheet-handle")
    ?.addEventListener("click", closeSearchSheet);
});

// -----------------------------
// 히스토리 초기화 함수
// -----------------------------
function checkAndResetHistoryIfNeeded() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const savedDate = localStorage.getItem(SEARCH_DATE_KEY);

  if (savedDate !== today) {
    // 🔥 날짜가 바뀌었으면 초기화
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    localStorage.removeItem(SEARCH_INDEX_KEY);
    localStorage.setItem(SEARCH_DATE_KEY, today);
  }
}

// -----------------------------
// 히스토리 저장 이동 함수
// -----------------------------
function saveSearchKeyword(keyword, label = null) {
  let history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  
  // 저장할 데이터 형태 정의
  const newData = label ? { key: keyword, label: label } : keyword;
  
  // 중복 제거 로직 (key 기준)
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
  const history = JSON.parse(
    localStorage.getItem(SEARCH_HISTORY_KEY) || "[]"
  );

  let index = parseInt(
    localStorage.getItem(SEARCH_INDEX_KEY) || "0",
    10
  );

  const nextIndex = index + offset;
  if (nextIndex < 0 || nextIndex >= history.length) return;

  const item = history[nextIndex];
  const searchKey = typeof item === 'object' ? item.key : item;
  const displayTitle = typeof item === 'object' ? item.label : item;

  localStorage.setItem(SEARCH_INDEX_KEY, nextIndex.toString());
  EXTERNAL_QUERY = searchKey;

  // ✅ URL의 label 파라미터 업데이트 (상단 제목 표시용)
  const url = new URL(location.href);
  if (displayTitle) {
    url.searchParams.set('label', displayTitle);
  } else {
    url.searchParams.delete('label');
  }
  window.history.replaceState({}, '', url);

  PAGE = 0;
  RESULTS = [];
  document.getElementById("result").innerHTML = "";

  search({ updateHistory: false });
}


// -----------------------------
// 점수 계산
// -----------------------------
function matchScore(token, keyword, weight) {
  if (token === keyword) return weight.exact;
  if (keyword.startsWith(token)) return weight.prefix;
  if (keyword.includes(token)) return weight.partial;
  return 0;
}

// -----------------------------
// 🔐 유효 암호키 생성
// -----------------------------
function buildValidEncryptedKeys(inputKey) {
  if (!isEncryptedKey(inputKey)) return null;

  const type = inputKey.toUpperCase().match(/[DNTO]/)?.[0];
  const today = new Date();
  let days = 90;
  if (type === 'D') days = 360;

  const keys = new Set();

  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const y = d.getFullYear().toString(); // 2026 (4자리 전체)
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const dateStr = `${y}${m}${day}`; // 20260220 (8자리)

    const encoded = generateCustomKey(dateStr, type);
    keys.add(encoded.toLowerCase()); // 비교를 위해 소문자로 저장
    keys.add(encoded.toUpperCase()); // 대문자도 혹시 몰라 추가
  }
  return keys;
}

// -----------------------------
// 단계별 검색
// -----------------------------
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

// -----------------------------
// 검색 메인
// -----------------------------
function search({ updateHistory = true } = {}) {
  const raw = EXTERNAL_QUERY.trim();
  if (!raw) return;

  const urlParams = new URLSearchParams(location.search);
  const label = urlParams.get('label');
  const resultCountEl = document.getElementById('resultCount');

  if (updateHistory) {
    saveSearchKeyword(raw, label); 
  }

  // 🔥 🔐 암호키 검색
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
  } // ✅🔥 이거 꼭 있어야 함

  // -----------------------------
  // 일반 검색 모드
  // -----------------------------
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
  if (!ADS_ENABLED) return null; // ⭐ 핵심
  
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

      // ⏱ 1.5초 후 광고 iframe 없으면 제거
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
  if (total <= 13) return [6];       // 0-based → 7번째
  return [6, "end"];                 // 7번째 + 마지막
}

// -----------------------------
// 렌더링 (카드 전체 클릭 + 커버 이미지 + lazy-load)
// -----------------------------
function renderNextPage() {

  if (LOADING) return;
  LOADING = true;

  // =========================
  // URL 파라미터 1회만 읽기
  // =========================
  const urlParams =
    new URLSearchParams(location.search);

  const hideChart =
    urlParams.get("hideChart") === "true";

  // =========================
  // 정규식 1회 생성
  // =========================
  const dateRegex = /^\d{8}/;

  const slice = RESULTS.slice(
    PAGE * PAGE_SIZE,
    (PAGE + 1) * PAGE_SIZE
  );

  if (!slice.length) {
    LOADING = false;
    return;
  }

  const ul = document.getElementById('result');

  const total = RESULTS.length;
  const adPositions = getAdPositions(total);

  // 현재까지 렌더링된 전체 개수
  let renderedCount = PAGE * PAGE_SIZE;

  slice.forEach((item, i) => {

    const title = item.title || "";

    // =========================
    // 안드로이드 검색창 전용 숨김
    // =========================
    if (hideChart && dateRegex.test(title)) {
      return;
    }

    const globalIndex = renderedCount + i;

    // 🔶 미들 광고 (웹에서만)
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

  // 🔶 마지막 광고
  if (!window.__FROM_APP__ && adPositions.includes("end")) {
    const ad = createAdItem(AD_SLOT_END);
    if (ad) ul.appendChild(ad);
  }

  PAGE++;
  LOADING = false;
}

// -----------------------------
// 무한 스크롤
// -----------------------------
window.addEventListener('scroll', () => {
  if (
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 120
  ) {
    renderNextPage();
  }
});

// -----------------------------
// URL 파라미터 자동 검색 (?q=)
// -----------------------------
document.addEventListener('DOMContentLoaded', function () {
  checkAndResetHistoryIfNeeded();
  const params = new URLSearchParams(location.search);

  // ✅ 앱에서 열렸는지 판단
  const FROM_APP = params.get('from') === 'app';
  window.__FROM_APP__ = FROM_APP;


  //if (FROM_APP) {
  const bottomNav = document.getElementById("bottomNav");
  bottomNav.style.display = "flex";

  // 🏠 홈 
  document.getElementById("navHome").onclick = () => {
    if (window.__FROM_APP__ && window.AndroidApp) {
      AndroidApp.goBackToApp();
    } else {
      location.href = "/index.html";
    }
  };

  // 검색
  document.getElementById("navSearch").onclick = toggleSearchSheet;

  // ❮ 이전 검색어
  document.getElementById("navPrev").onclick = () => {
    loadSearchByOffset(+1);
  };

  // ❯ 다음 검색어
  document.getElementById("navNext").onclick = () => {
    loadSearchByOffset(-1);
  };
  //}


  // 🔍 검색 키워드 처리
  const encryptedKey = params.get('q');
  const displayLabel = params.get('label');

  if (encryptedKey) {
    EXTERNAL_QUERY = encryptedKey;
    // 암호키와 라벨을 함께 저장!
    saveSearchKeyword(encryptedKey, displayLabel);
  } else {
    const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
    const index = parseInt(localStorage.getItem(SEARCH_INDEX_KEY) || "0", 10);
    if (history[index]) {
      // 히스토리에서 복구할 때 객체인지 확인
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

