const API_KEY = "AIzaSyCyV0rnbLzd7In_E0IaP7nG3qUezrtNMNI";
const ROOT_FOLDER_ID = "1DC6GI1urKuTQkaStvF9jkGHgl1EcFxsd";
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";

const systemsGrid = document.getElementById("systemsGrid");
const noticeArea = document.getElementById("noticeArea");
const refreshBtn = document.getElementById("refreshBtn");
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const topicsContainer = document.getElementById("topicsContainer");
const searchInput = document.getElementById("searchInput");
const modalNotice = document.getElementById("modalNotice");
const globalSearch = document.getElementById("globalSearch");
const clearSearch = document.getElementById("clearSearch");


let systemsList = [];
let uncategorized = { id: "UNCAT", name: "Uncategorized", topics: [] };
let activeSystem = null;
let activeModalFilter = "All_modal";


function showNotice(msg, timeout = 4000) {
  noticeArea.innerHTML = `<div class="notice">${msg}</div>`;
  if (timeout) setTimeout(() => (noticeArea.innerHTML = ""), timeout);
}

function detectType(name) {
  const s = name.toLowerCase();
  if (s.includes("talk")) return "PG Talk";
  if (s.includes("practical") || s.includes("lab")) return "PG Practical";
  return "Unknown";
}

async function listFiles(folderId) {
  let pageToken = null;
  let all = [];
  do {
    const params = new URLSearchParams({
      key: API_KEY,
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id,name,mimeType,webViewLink,modifiedTime,size)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${DRIVE_URL}?${params.toString()}`);
    const data = await res.json();
    all = all.concat(data.files || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

async function buildStructure() {
  showNotice("Fetching from Google Drive...");
  systemsList = [];
  uncategorized.topics = [];

  const rootItems = await listFiles(ROOT_FOLDER_ID);
  const categoryFolders = rootItems.filter(
    (f) =>
      f.mimeType === "application/vnd.google-apps.folder" &&
      /pg\s*talk|pg\s*practical/i.test(f.name)
  );

  const systemsMap = {};

  for (const category of categoryFolders) {
    const categoryType = /talk/i.test(category.name)
      ? "PG Talk"
      : "PG Practical";

    const systemFolders = await listFiles(category.id);
    for (const systemFolder of systemFolders) {
      if (systemFolder.mimeType !== "application/vnd.google-apps.folder")
        continue;

      const topicFiles = await listFiles(systemFolder.id);
      const topics = topicFiles
        .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
        .map((f) => ({
          id: f.id,
          name: f.name,
          link: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          type: categoryType,
        }));

      if (!systemsMap[systemFolder.name]) {
        systemsMap[systemFolder.name] = [];
      }
      systemsMap[systemFolder.name].push(...topics);
    }
  }

  // Convert systemsMap into systemsList array
  for (const [name, topics] of Object.entries(systemsMap)) {
    systemsList.push({ name, topics });
  }

  renderSystems();
  showNotice("Loaded successfully!");
  syncModalFilter(); // keep modal synced  
}

// Global filter for systems view
let activeGlobalFilter = "All";

// Handle top global filters
document.querySelectorAll("#globalFilters .btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Toggle active button style
    document.querySelectorAll("#globalFilters .btn").forEach((b) => b.classList.remove("primary"));
    btn.classList.add("primary");

    activeGlobalFilter = btn.dataset.filter;
    renderSystems();
  });
});


function renderSystems() {
  systemsGrid.innerHTML = "";

  const searchQuery = globalSearch.value.trim().toLowerCase();

  const filteredSystems = systemsList
    .map((system) => {
      let topics = system.topics;

      // Apply top (global) filter
      if (activeGlobalFilter === "PG Talk") {
        topics = topics.filter((t) => t.type === "PG Talk");
      } else if (activeGlobalFilter === "PG Practical") {
        topics = topics.filter((t) => t.type === "PG Practical");
      }

      // Apply search filter (system name OR topic name)
      if (searchQuery) {
        const matchesSystem = system.name.toLowerCase().includes(searchQuery);
        const matchingTopics = topics.filter((t) =>
          t.name.toLowerCase().includes(searchQuery)
        );

        if (!matchesSystem && matchingTopics.length === 0) {
          return null; // hide system if nothing matches
        }

        topics = matchesSystem ? topics : matchingTopics;
      }

      return { ...system, topics };
    })
    .filter((s) => s && s.topics.length > 0);

  if (filteredSystems.length === 1 && searchQuery) {
  const sys = filteredSystems[0];
  openModal(sys);
  window.scrollTo({ top: 0, behavior: "smooth" });
  return;
}


  // If there's only one system in search results → auto open modal
  if (filteredSystems.length === 1 && searchQuery) {
    const sys = filteredSystems[0];
    openModal(sys); // auto-expand
    return;
  }

  // Helper for highlighting
  function highlight(text) {
    if (!searchQuery) return text;
    const re = new RegExp(`(${searchQuery})`, "gi");
    return text.replace(re, "<mark>$1</mark>");
  }

  filteredSystems.forEach((sys) => {
    const card = document.createElement("div");
    card.className = "card";

    // highlight system name
    const nameHTML = highlight(sys.name);

    card.innerHTML = `
      <h3>${nameHTML}</h3>
      <div class="meta">${sys.topics.length} topics</div>
    `;

    // attach click listener
    card.addEventListener("click", () => openModal(sys));

    systemsGrid.append(card);
  });
}

function createCard(system) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h3>${system.name}</h3><div class="meta">${system.topics.length} topics</div>`;
  card.onclick = () => openModal(system);
  return card;
}

function openModal(system) {
  activeSystem = system;
  modal.style.display = "flex";
  modalTitle.textContent = `${system.name} — ${system.topics.length} topics`;

  // 🌟 inherit top filter state
  if (activeGlobalFilter === "PG Talk") {
    activeModalFilter = "PG Talk_modal";
  } else if (activeGlobalFilter === "PG Practical") {
    activeModalFilter = "PG Practical_modal";
  } else {
    activeModalFilter = "All_modal";
  }

  // 🌟 visually highlight the correct modal button
  document.querySelectorAll(".modal-filters .btn").forEach((b) => {
    b.classList.toggle("primary", b.dataset.filter === activeModalFilter);
  });

  renderTopics();
}

// keep modal filter synced if modal is open
function syncModalFilter() {
  if (modal.style.display === "flex") {
    openModal(activeSystem); // reopen with new filter
  }
}


closeModal.onclick = () => (modal.style.display = "none");

function renderTopics() {
  topicsContainer.innerHTML = "";
    // ✅ Safe check for searchInput (since it's not always in DOM now)
  const q = (typeof searchInput !== "undefined" && searchInput && searchInput.value)
    ? searchInput.value.toLowerCase()
    : "";
  const filter = activeModalFilter.replace("_modal", "");
  let list = activeSystem.topics.filter(
    (t) =>
      (filter === "All" || t.type === filter) &&
      (!q || t.name.toLowerCase().includes(q))
  );
  if (!list.length) {
    topicsContainer.innerHTML =
      '<div class="small" style="text-align:center">No topics found.</div>';
    return;
  }
  for (const t of list) {
    const row = document.createElement("div");
    row.className = "topic-row";
    row.innerHTML = `<div class="topic-name">${t.name}</div>
                     <div class="topic-actions"><a href="${t.link}" target="_blank">Open</a></div>`;
    topicsContainer.append(row);
  }
}

document
  .querySelectorAll(".modal-filters .btn")
  .forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".modal-filters .btn")
        .forEach((x) => x.classList.remove("primary"));
      b.classList.add("primary");
      activeModalFilter = b.dataset.filter;
      renderTopics();
    })
  );

  const instructionsModal = document.getElementById("instructionsModal");
const closeInstructions = document.getElementById("closeInstructions");
const instructionsBtn = document.getElementById("instructionsBtn");

if (instructionsBtn) {
  instructionsBtn.addEventListener("click", () => {
    instructionsModal.style.display = "flex";
  });
}

if (closeInstructions) {
  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });
}

window.addEventListener("click", (e) => {
  if (e.target === instructionsModal) {
    instructionsModal.style.display = "none";
  }
});

const searchResults = document.getElementById("searchResults");

globalSearch.addEventListener("input", () => {
  const query = globalSearch.value.trim().toLowerCase();
  clearSearch.style.display = query ? "block" : "none";

  if (!query) {
    // restore default view
    systemsGrid.style.display = "grid";
    searchResults.style.display = "none";
    renderSystems();
    return;
  }

  // hide systems grid during search
  systemsGrid.style.display = "none";
  searchResults.style.display = "block";

  const matches = [];

  systemsList.forEach((system) => {
    system.topics.forEach((topic) => {
      if (topic.name.toLowerCase().includes(query)) {
        matches.push({
          topicName: topic.name,
          systemName: system.name,
          type: topic.type,
          link: topic.link,
        });
      }
    });
  });

  // render results
  renderSearchResults(matches, query);
});

clearSearch.addEventListener("click", () => {
  globalSearch.value = "";
  clearSearch.style.display = "none";
  searchResults.style.display = "none";
  systemsGrid.style.display = "grid";
  renderSystems();
});

function renderSearchResults(results, query) {
  if (!results.length) {
    searchResults.innerHTML = `<div class="notice">No topics found matching "${query}".</div>`;
    return;
  }

  const re = new RegExp(`(${query})`, "gi");
  const html = results
    .map((r) => {
      const highlighted = r.topicName.replace(re, "<mark>$1</mark>");
      return `
        <div class="result-item" onclick="window.open('${r.link}', '_blank')">
          <div class="result-title">${highlighted}</div>
          <div class="result-type">
            ${r.type}
            <span class="result-meta">${r.systemName}</span>
          </div>
        </div>
      `;
    })
    .join("");

  searchResults.innerHTML = html;
}


clearSearch.addEventListener("click", () => {
  globalSearch.value = "";
  clearSearch.style.display = "none";
  renderSystems();
});
refreshBtn.onclick = buildStructure;

buildStructure();

// --- Suggestion Modal Logic ---
const suggestBtn = document.getElementById("suggestBtn");
const suggestModal = document.getElementById("suggestModal");
const closeSuggest = document.getElementById("closeSuggest");
const submitSuggest = document.getElementById("submitSuggest");
const suggestText = document.getElementById("suggestText");

suggestBtn.onclick = () => {
  suggestModal.style.display = "flex";
};
closeSuggest.onclick = () => {
  suggestModal.style.display = "none";
};
submitSuggest.onclick = () => {
  const suggestion = suggestText.value.trim();
  if (!suggestion) return alert("Please enter a suggestion first!");
  alert("Thank you for your suggestion!");
  suggestText.value = "";
  suggestModal.style.display = "none";
};

// --- Upload Modal Logic ---
const uploadBtn = document.getElementById("uploadBtn");
const uploadModal = document.getElementById("uploadModal");
const closeUpload = document.getElementById("closeUpload");
const submitUpload = document.getElementById("submitUpload");
const fileInput = document.getElementById("fileInput");

uploadBtn.onclick = () => {
  uploadModal.style.display = "flex";
};
closeUpload.onclick = () => (uploadModal.style.display = "none");

submitUpload.onclick = () => {
  const file = fileInput.files[0];
  if (!file) return alert("Please select a file first!");
  alert(`Uploading ${file.name} (mocked for now)...`);
  uploadModal.style.display = "none";
};
