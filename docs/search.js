let INDEX = [];
let RESULTS = [];
let PAGE = 0;
const PAGE_SIZE = 20;
let LOADING = false;
let EXTERNAL_QUERY = '';

// 기본 커버 이미지 (fallback)
const DEFAULT_COVER = 'icon80.png';

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
  .then(res => res.json())
  .then(data => INDEX = data);

function goBackSmart() {
  if (window.__FROM_APP__ && window.AndroidApp) {
    AndroidApp.goBackToApp();   // ⭐ 핵심
  } else {
    location.href = "index.html";
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
function search() {
  const raw = EXTERNAL_QUERY.trim();
  if (!raw) return;

  const terms = splitMixedTokens(raw);
  if (!terms.length) return;

  const queryKey = terms.join(' ');

  const debugMode =
    DEV_MODE && document.getElementById('debugToggle')?.checked;

  const recall = runSearch(terms, 'recall');
  const precision = recall.length >= 10 ? runSearch(terms, 'precision') : [];
  const relaxed =
    recall.length >= 10 && precision.length < 3
      ? runSearch(terms, 'relaxed')
      : [];

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
    stat.count++;
    stat.total += RESULTS.length;
    SEARCH_STATS.set(queryKey, stat);

    const avg = (stat.total / stat.count).toFixed(1);

    const debugDiv = document.createElement('div');
    debugDiv.id = 'debugLog';
    debugDiv.className = 'search-debug';
    debugDiv.innerHTML = `
      🔍 검색 전략: ${path}<br/>
      📊 평균 결과 수: ${avg}
    `;
    document.getElementById('resultCount').after(debugDiv);
  }

  document.getElementById(
    'resultCount'
  ).textContent = `검색 결과 ${RESULTS.length}건`;

  renderNextPage();
}

// -----------------------------
// 렌더링 (카드 전체 클릭 + 커버 이미지 + lazy-load)
// -----------------------------
function renderNextPage() {
  if (LOADING) return;
  LOADING = true;

  const slice = RESULTS.slice(
    PAGE * PAGE_SIZE,
    (PAGE + 1) * PAGE_SIZE
  );

  if (!slice.length) {
    LOADING = false;
    return;
  }

  const ul = document.getElementById('result');

  slice.forEach(item => {
    const li = document.createElement('li');

    // ✅ 카드 전체를 감싸는 링크
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

    // 카드 본체
    const card = document.createElement('div');
    card.className = 'search-item';

    // 왼쪽 텍스트 영역
    const content = document.createElement('div');
    content.className = 'search-content';

    // ❗ 제목은 이제 <a>가 아닌 <div>
    const title = document.createElement('div');
    title.className = 'search-title';
    title.textContent = item.title;

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    preview.textContent = item.preview || '';

    content.append(title, preview);

    // 오른쪽 커버 이미지 (조건부 렌더링)
    let img = null;

    if (item.cover) {
      img = document.createElement('img');
      img.className = 'search-cover';
      img.loading = 'lazy';
      img.src = item.cover;
      img.alt = '';

      // ❗ 로드 실패 시 이미지 자체 제거
      img.onerror = () => {
        img.remove();
      };
    } else {
      // cover 자체가 없을 때만 fallback 사용
      img = document.createElement('img');
      img.className = 'search-cover';
      img.loading = 'lazy';
      img.src = DEFAULT_COVER;
      img.alt = '';
    }

    // 조립
    card.append(content);
    if (img) card.appendChild(img);

    link.appendChild(card);
    li.appendChild(link);
    ul.appendChild(li);
  });

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
  const params = new URLSearchParams(location.search);

  // ✅ 앱에서 열렸는지 판단
  const FROM_APP = params.get('from') === 'app';
  window.__FROM_APP__ = FROM_APP;

  // ⬅️ 앱에서 열린 경우에만 상단 바 + 뒤로가기 버튼 생성
  if (FROM_APP) {
    // 🔲 상단 검은 바
    const topBar = document.createElement("div");
    topBar.className = "app-top-bar";

    // ◀️ 뒤로가기 버튼
    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.textContent = "◀️ Back Button ( ◁ 뒤로가기 )";

    backBtn.addEventListener("click", () => {
      if (window.AndroidApp) {
        AndroidApp.goBackToApp();
      } else {
        location.href = "index.html";
      }
    });

    topBar.appendChild(backBtn);
    document.body.prepend(topBar);   // ⭐ 맨 위에 삽입
  }

  // 🔍 검색 키워드 처리
  const keyword = params.get('q');
  if (!keyword) return;

  EXTERNAL_QUERY = keyword;

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

