// 🔹 CONFIGURATION
const API_KEY = "AIzaSyCyV0rnbLzd7In_E0IaP7nG3qUezrtNMNI";
const BOOKS_FOLDER_ID = "1Rj9ZADatP3Lh2AMlU9e7rRR5Qch-IE9K"; // Replace with your books folder ID
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";

// DOM Elements
const booksTableBody = document.getElementById("booksTableBody");
const systemFilters = document.getElementById("systemFilters");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const refreshBtn = document.getElementById("refreshBtn");
const noticeArea = document.getElementById("noticeArea");
const totalBooksEl = document.getElementById("totalBooks");
const totalSystemsEl = document.getElementById("totalSystems");
const visibleBooksEl = document.getElementById("visibleBooks");

// State
let allBooks = [];
let activeSystem = "All";

// Show notice message
function showNotice(msg, timeout = 4000) {
  noticeArea.innerHTML = `<div class="notice">${msg}</div>`;
  if (timeout) setTimeout(() => (noticeArea.innerHTML = ""), timeout);
}

// Extract book metadata from filename
function parseBookName(filename) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(pdf|ppt|pptx|doc|docx)$/i, '');
  
  return { title: nameWithoutExt };
}

// Fetch all files from a folder
async function listFiles(folderId) {
  let pageToken = null;
  let all = [];
  do {
    const params = new URLSearchParams({
      key: API_KEY,
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id,name,mimeType,webViewLink,modifiedTime)",
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

// Build book structure
async function loadBooks() {
  showNotice("📚 Loading books from Google Drive...");
  allBooks = [];

  try {
    const rootItems = await listFiles(BOOKS_FOLDER_ID);
    
    // Get all system folders
    const systemFolders = rootItems.filter(
      f => f.mimeType === "application/vnd.google-apps.folder"
    );

    // Process each system folder
    for (const systemFolder of systemFolders) {
      const bookFiles = await listFiles(systemFolder.id);
      
      for (const file of bookFiles) {
        // Skip folders
        if (file.mimeType === "application/vnd.google-apps.folder") continue;

        const { title } = parseBookName(file.name);
        
        allBooks.push({
          id: file.id,
          title: title,
          system: systemFolder.name,
          link: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          modifiedTime: file.modifiedTime
        });
      }
    }

    // Create system filters
    createSystemFilters();
    
    // Update stats
    updateStats();
    
    // Render books
    renderBooks();
    
    showNotice("✅ Books loaded successfully!");
  } catch (error) {
    console.error("Error loading books:", error);
    showNotice("❌ Error loading books. Please check console.");
    booksTableBody.innerHTML = `
      <tr>
        <td colspan="3">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <div>Error loading books. Please refresh the page.</div>
          </div>
        </td>
      </tr>
    `;
  }
}

// Create system filter buttons
function createSystemFilters() {
  const systems = [...new Set(allBooks.map(b => b.system))].sort();
  
  systemFilters.innerHTML = `
    <button class="btn primary" data-system="All">All Systems</button>
    ${systems.map(sys => `
      <button class="btn" data-system="${sys}">${sys}</button>
    `).join('')}
  `;

  // Add click handlers
  systemFilters.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSystem = btn.dataset.system;
      
      // Update active button
      systemFilters.querySelectorAll('.btn').forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      
      renderBooks();
    });
  });
}

// Update statistics
function updateStats() {
  const systems = new Set(allBooks.map(b => b.system));
  totalBooksEl.textContent = allBooks.length;
  totalSystemsEl.textContent = systems.size;
}

// Render books table
function renderBooks() {
  const searchQuery = searchInput.value.trim().toLowerCase();
  
  // Filter books
  let filtered = allBooks.filter(book => {
    const matchesSystem = activeSystem === "All" || book.system === activeSystem;
    const matchesSearch = !searchQuery || 
      book.title.toLowerCase().includes(searchQuery);
    
    return matchesSystem && matchesSearch;
  });

  // Update visible count
  visibleBooksEl.textContent = filtered.length;

  // Render
  if (filtered.length === 0) {
    booksTableBody.innerHTML = `
      <tr>
        <td colspan="3">
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div>No books found matching your criteria.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Helper to highlight search terms
  function highlight(text) {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  booksTableBody.innerHTML = filtered.map(book => `
    <tr>
      <td><div class="book-title">${highlight(book.title)}</div></td>
      <td><span class="book-system">${book.system}</span></td>
      <td>
        <a href="${book.link}" target="_blank" class="book-link">Open Book</a>
      </td>
    </tr>
  `).join('');
}

// Search functionality
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearSearch.style.display = query ? 'block' : 'none';
  renderBooks();
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  clearSearch.style.display = 'none';
  renderBooks();
});

// Refresh button
refreshBtn.addEventListener('click', loadBooks);

// Initialize
loadBooks();