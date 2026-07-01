const grid = document.querySelector("#songGrid");
const searchInput = document.querySelector("#searchInput");
const filterButtons = Array.from(document.querySelectorAll(".filter-button"));
const generatedLinks = document.querySelector("#generatedLinks");
let activeFilter = "all";
let songs = [];

if (grid && searchInput) {
  init();
}

async function init() {
  try {
    const response = await fetch("data/songs.json");
    songs = await response.json();
    applyInitialSearch();
    renderSongs();
    renderGeneratedLinks();
  } catch (error) {
    grid.innerHTML =
      '<div class="empty-state">The song library could not load right now. Try refreshing the page.</div>';
    console.error(error);
  }
}

function normalize(value) {
  return String(value).toLowerCase().trim();
}

function renderSongs() {
  const query = normalize(searchInput.value);
  const visibleSongs = songs.filter((song) => {
    const matchesType = activeFilter === "all" || song.type === activeFilter;
    const haystack = normalize(
      [
        song.title,
        song.artist,
        song.year,
        song.tournament,
        song.country,
        song.language,
        song.type,
        song.status,
        song.summary,
      ].join(" ")
    );
    return matchesType && haystack.includes(query);
  });

  if (!visibleSongs.length) {
    grid.innerHTML = '<div class="empty-state">No songs match that search yet.</div>';
    return;
  }

  grid.innerHTML = visibleSongs
    .map(
      (song) => `
        <article class="song-card">
          <div class="song-meta">
            <span class="pill ${escapeHtml(song.type)}">${escapeHtml(song.status)}</span>
            <span class="pill">${escapeHtml(song.year)}</span>
            <span class="pill">${escapeHtml(song.country)}</span>
            <span class="pill">${escapeHtml(song.language)}</span>
          </div>
          <h3>${escapeHtml(song.title)}</h3>
          <p class="artist">${escapeHtml(song.artist)}</p>
          <p class="note">${escapeHtml(song.summary)}</p>
          <a href="songs/${encodeURIComponent(song.slug)}/">Open detail page</a>
        </article>
      `
    )
    .join("");
}

function renderGeneratedLinks() {
  const countries = unique(songs.map((song) => [song.countrySlug, song.country]));
  const years = unique(songs.map((song) => [song.year, song.year]));
  generatedLinks.innerHTML = `
    <div>
      <h3>Browse by context</h3>
      <p>Open a timeline, glossary, country, or tournament year to keep following the story.</p>
    </div>
    <div class="link-cloud">
      <a href="timeline/">Timeline</a>
      <a href="glossary/">Glossary</a>
      ${countries
        .slice(0, 8)
        .map(([slug, label]) => `<a href="countries/${encodeURIComponent(slug)}/">${escapeHtml(label)}</a>`)
        .join("")}
      ${years
        .slice(0, 8)
        .map(([year]) => `<a href="years/${encodeURIComponent(year)}/">${escapeHtml(year)}</a>`)
        .join("")}
    </div>
  `;
}

function unique(entries) {
  return Array.from(new Map(entries).entries()).map(([key, value]) => [key, value]);
}

function applyInitialSearch() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  if (query) searchInput.value = query;
}

function updateSearchUrl() {
  const params = new URLSearchParams(window.location.search);
  const query = searchInput.value.trim();
  if (query) {
    params.set("q", query);
  } else {
    params.delete("q");
  }
  const nextQuery = params.toString();
  const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
  window.history.replaceState(null, "", nextUrl);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (grid && searchInput) {
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderSongs();
    });
  });

  searchInput.addEventListener("input", () => {
    updateSearchUrl();
    renderSongs();
  });
}

document.querySelectorAll("[data-comment-section]").forEach((section) => {
  const pageKey = section.dataset.commentKey;
  const form = section.querySelector("[data-comment-form]");
  const list = section.querySelector("[data-comment-list]");
  const status = section.querySelector("[data-comment-status]");
  const count = section.querySelector("[data-comment-count]");
  const submit = section.querySelector("[data-comment-submit]");

  if (!pageKey || !form || !list) return;

  const setStatus = (message, tone = "") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  };

  const setLoading = (isLoading) => {
    if (!submit) return;
    submit.disabled = isLoading;
    submit.textContent = isLoading ? "Posting..." : "Post";
  };

  const fetchComments = async () => {
    const response = await fetch(`/api/comments?pageKey=${encodeURIComponent(pageKey)}`, {
      headers: { Accept: "application/json" },
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload.error || "Could not load comments.");
    }
    return Array.isArray(payload.comments) ? payload.comments : [];
  };

  const postComment = async (name, comment) => {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pageKey, name, comment }),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload.error || "Could not post comment.");
    }
    return Array.isArray(payload.comments) ? payload.comments : [];
  };

  const formatDate = (value) => {
    try {
      return value ? new Date(value).toLocaleDateString() : "";
    } catch {
      return "";
    }
  };

  const render = (comments) => {
    list.replaceChildren();
    if (count) {
      count.textContent = comments.length === 1 ? "1 comment" : `${comments.length} comments`;
    }

    if (!comments.length) {
      const empty = document.createElement("p");
      empty.className = "comment-empty";
      empty.textContent = "No comments yet. Add the first note.";
      list.append(empty);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement("article");
      item.className = "comment-item";

      const meta = document.createElement("div");
      meta.className = "comment-meta";

      const name = document.createElement("strong");
      name.textContent = comment.name || "Visitor";

      const time = document.createElement("time");
      time.dateTime = comment.createdAt || "";
      time.textContent = formatDate(comment.createdAt);

      const text = document.createElement("p");
      text.textContent = comment.body || "";

      meta.append(name, time);
      item.append(meta, text);
      list.append(item);
    });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "Visitor").trim().slice(0, 40) || "Visitor";
    const text = String(data.get("comment") || "").trim().slice(0, 600);
    if (!text) {
      setStatus("Write a comment before posting.", "error");
      return;
    }

    setLoading(true);
    setStatus("Posting...");
    postComment(name, text)
      .then((comments) => {
        form.reset();
        render(comments);
        setStatus("Posted. Thanks for the note.", "success");
      })
      .catch((error) => {
        setStatus(error.message || "Could not post comment.", "error");
      })
      .finally(() => {
        setLoading(false);
      });
  });

  fetchComments()
    .then((comments) => {
      render(comments);
      setStatus("");
    })
    .catch((error) => {
      render([]);
      setStatus(error.message || "Comments are temporarily unavailable.", "error");
    });
});

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Comments API is unavailable on this local server. Start the site with Wrangler Pages dev.");
  }
  return response.json();
}
