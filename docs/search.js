let DB = [];

fetch("artist_index.json")
  .then(r => r.json())
  .then(j => {
    DB = j;
    console.log("Search DB loaded:", DB.length);
  });

const input = document.getElementById("q");
const results = document.getElementById("results");

function runSearch() {
  const q = input.value.trim().toLowerCase();
  results.innerHTML = "";
  if (!q) return;

  let count = 0;

  DB.forEach(item => {
    if (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q)
    ) {
      const line =
        item.content.split("\n").find(l => l.toLowerCase().includes(q)) || "";

      results.innerHTML += `
        <div class="result">
          <a href="${item.url}" target="_blank">${item.title}</a>
          <div class="snippet">${line}</div>
        </div>
      `;
      count++;
    }
  });

  if (count === 0) {
    results.innerHTML = "<div class='empty'>검색 결과가 없습니다.</div>";
  }
}

// 실시간 검색
input.addEventListener("input", runSearch);

// 엔터 키 검색
input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    runSearch();
  }
});
