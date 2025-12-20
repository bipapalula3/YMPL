let INDEX = [];
let RESULTS = [];
let PAGE = 0;
const PAGE_SIZE = 20;
let LOADING = false;

fetch('artist_song_index.json')
  .then(res => res.json())
  .then(data => INDEX = data);

function startSearch() {
  PAGE = 0;
  RESULTS = [];
  document.getElementById('result').innerHTML = '';
  search();
}

function search() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  if (!q) return;

  RESULTS = INDEX
    .filter(item =>
      item.keywords.some(k => k.toLowerCase().includes(q))
    )
    .map(item => {
      // 가중치 점수 계산 (index에서 이미 계산된 값 사용)
      let score = 0;
      if (item.weight) {
        score += item.weight.both || 0;
        score += item.weight.title || 0;
        score += item.weight.track || 0;
      }
      return { ...item, _score: score };
    })
    .sort((a, b) => b._score - a._score);

  renderNextPage();
}

function renderNextPage() {
  if (LOADING) return;
  LOADING = true;

  const start = PAGE * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = RESULTS.slice(start, end);

  if (slice.length === 0) {
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

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    preview.textContent = item.preview || '';

    li.appendChild(titleLink);
    li.appendChild(preview);
    ul.appendChild(li);
  });

  PAGE++;
  LOADING = false;
}

// 무한 스크롤
window.addEventListener('scroll', () => {
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
    renderNextPage();
  }
});
