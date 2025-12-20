let INDEX = [];

fetch('artist_song_index.json')
  .then(res => res.json())
  .then(data => INDEX = data);

function search() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const ul = document.getElementById('result');
  ul.innerHTML = '';

  if (!q) return;

  INDEX.forEach(item => {
    // 키워드 기반 검색 (title + track 키워드 포함)
    if (!item.keywords.some(k => k.toLowerCase().includes(q))) {
      return;
    }

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
}
