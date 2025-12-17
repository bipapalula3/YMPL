let DB = [];

fetch("artist_index.json")
  .then(r => r.json())
  .then(j => DB = j);

const input = document.getElementById("q");
const results = document.getElementById("results");

input.addEventListener("input", () => {
  const q = input.value.trim().toLowerCase();
  results.innerHTML = "";
  if (!q) return;

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
    }
  });
});
