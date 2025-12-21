let INDEX = [];
let RESULTS = [];
let PAGE = 0;
const PAGE_SIZE = 20;
let LOADING = false;

// -----------------------------
// 인덱스 로딩
// -----------------------------
fetch('artist_song_index.json')
  .then(res => res.json())
  .then(data => INDEX = data);

// -----------------------------
// 한글 / 영문 / 숫자 / 특수문자 자동 분리
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
// debounce (모바일 최적화)
// -----------------------------
function debounce(fn, delay = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// -----------------------------
// 검색 시작
// -----------------------------
const startSearch = debounce(() => {
  PAGE = 0;
  RESULTS = [];
  document.getElementById('result').innerHTML = '';
  document.getElementById('resultCount').textContent = '';
  search();
}, 200);

// -----------------------------
// 매칭 점수 계산
// -----------------------------
function matchScore(token, keyword, weight) {
  if (token === keyword) return weight.exact;
  if (keyword.startsWith(token)) return weight.prefix;
  if (keyword.includes(token)) return weight.partial;
  return 0;
}

// -----------------------------
// 검색 메인
// -----------------------------
function search() {
  const raw = document.getElementById('q').value.trim();
  if (!raw) return;

  const terms = splitMixedTokens(raw);
  if (!terms.length) return;

  const joinedQuery = terms.join(' ');

  const precisionMode =
    document.getElementById('modeToggle')?.checked ?? true;
  const debugMode =
    document.getElementById('debugToggle')?.checked ?? false;

  RESULTS = INDEX
    .map(item => {
      let score = 0;
      let matchedCount = 0;

      const titleKeywords = item.keywords.title || [];
      const trackKeywords = item.keywords.track || [];

      const TITLE_WEIGHT = { exact: 20, prefix: 12, partial: 6 };
      const TRACK_WEIGHT = { exact: 8, prefix: 4, partial: 2 };

      for (const term of terms) {
        let bestScore = 0;

        for (const k of titleKeywords) {
          bestScore = Math.max(
            bestScore,
            matchScore(term, k, TITLE_WEIGHT)
          );
        }

        for (const k of trackKeywords) {
          bestScore = Math.max(
            bestScore,
            matchScore(term, k, TRACK_WEIGHT)
          );
        }

        if (bestScore > 0) {
          matchedCount++;
          score += bestScore;
        } else if (precisionMode) {
          return null; // 정확도 모드 → AND 실패
        }
      }

      // 많이 나오는 검색 (Recall)
      if (!precisionMode && matchedCount === 0) {
        return null;
      }

      // title 순서 보너스
      if (item.title) {
        const normTitle = splitMixedTokens(item.title).join(' ');
        if (normTitle.includes(joinedQuery)) {
          score += 15;
        }
      }

      return { ...item, _score: score };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);

  // 결과 개수 표시
  document.getElementById(
    'resultCount'
  ).textContent = `검색 결과 ${RESULTS.length}건`;

  renderNextPage(debugMode);
}

// -----------------------------
// 페이지 렌더링
// -----------------------------
function renderNextPage(debugMode = false) {
  if (LOADING) return;
  LOADING = true;

  const start = PAGE * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = RESULTS.slice(start, end);
  if (!slice.length) {
    LOADING = false;
    return;
  }

  const ul = document.getElementById('result');

  slice.forEach(item => {
    const li = document.createElement('li');
    li.className = 'search-item';

    const titleLink = document.createElement('a');
    titleLink.href = item.link;
    titleLink.target = '_blank';
    titleLink.className = 'search-title';
    titleLink.textContent = item.title;

    li.appendChild(titleLink);

    if (debugMode) {
      const debug = document.createElement('div');
      debug.className = 'search-debug';
      debug.textContent = `score: ${item._score}`;
      li.appendChild(debug);
    }

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    preview.textContent = item.preview || '';

    li.appendChild(preview);
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
    renderNextPage(
      document.getElementById('debugToggle')?.checked
    );
  }
});
