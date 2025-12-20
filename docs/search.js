let INDEX = [];

fetch('artist_song_index.json')
  .then(res => res.json())
  .then(data => INDEX = data);

function search() {
  const q = document.getElementById('q').value.toLowerCase();
  const ul = document.getElementById('result');
  ul.innerHTML = '';

  if (!q) return;

  INDEX.forEach(item => {
    if (item.keywords.some(k => k.toLowerCase().includes(q))) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.link;
      a.target = '_blank';
      a.textContent = item.title;
      li.appendChild(a);
      ul.appendChild(li);
    }
  });
}
