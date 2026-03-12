// ---------- configuration ----------
const API_BASE = "http://16.16.70.222";

// helper to show errors in an element
function showError(el, message) {
  if (!el) return;
  el.innerHTML = `<p class="text-danger">${message}</p>`;
}

// ---------- PROMPT / QUERY ----------
const promptInput = document.getElementById("promptInput");
const responseOutput = document.getElementById("responseOutput");

async function queryPrompt(question) {
  const url = `${API_BASE}/api/v1/Query`;
  const body = { question };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`query failed: ${res.status} ${text}`);
  }

  return res.json();
}

if (promptInput && responseOutput) {
  promptInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    responseOutput.innerHTML = `<p>Loading...</p>`;
    try {
      const data = await queryPrompt(prompt);
      let html = `<p><strong>Answer:</strong> ${data.answer || "(no answer)"}</p>`;
      if (data.sources && data.sources.length) {
        html +=
          '<div><strong>Sources:</strong><ul>' +
          data.sources.map((s) => `<li>${s}</li>`).join("") +
          "</ul></div>";
      }
      responseOutput.innerHTML = html;
    } catch (err) {
      showError(responseOutput, err.message);
    }

    promptInput.value = "";
  });
}

// ---------- DOCUMENTS (library) ----------
const uploadArea = document.getElementById("uploadArea");
const fileUpload = document.getElementById("fileUpload");
const progressBar = document.getElementById("uploadProgress");
const documentList = document.getElementById("documentList");

async function getDocuments() {
  const res = await fetch(`${API_BASE}/api/v1/Documents`);
  if (!res.ok) throw new Error(`list documents failed (${res.status})`);
  const data = await res.json();
  return data.documents || [];
}

async function removeDocument(fileName) {
  const res = await fetch(
    `${API_BASE}/api/v1/Documents/${encodeURIComponent(fileName)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`delete failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function uploadDocument(file) {
  if (!progressBar) return;
  progressBar.style.width = "0%";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/v1/Documents/upload`);
    xhr.onload = async () => {
      if (xhr.status === 201) {
        try {
          await renderDocuments();
          // index may have been rebuilt on server side after upload
          await updateIndexStatus();
        } catch (e) {
          console.error(e);
        }
        resolve(JSON.parse(xhr.response || "{}"));
      } else {
        reject(new Error(`upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("network error"));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        progressBar.style.width = percent + "%";
      }
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

async function handleFiles(files) {
  for (let file of files) {
    try {
      await uploadDocument(file);
    } catch (e) {
      console.error(e);
    }
  }
}

function wireUploadArea() {
  if (!uploadArea || !fileUpload) return;

  uploadArea.addEventListener("click", () => fileUpload.click());

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  fileUpload.addEventListener("change", () => {
    handleFiles(fileUpload.files);
  });
}

async function renderDocuments() {
  if (!documentList) return;
  documentList.innerHTML = "";
  try {
    const docs = await getDocuments();
    docs.forEach((doc) => {
      const item = document.createElement("div");
      item.className = "doc-item";
      item.innerHTML = `
        <span class="doc-name">${doc.fileName}</span>
        <span class="delete-icon">🗑</span>
      `;
      item.querySelector(".delete-icon").onclick = async () => {
        try {
          await removeDocument(doc.fileName);
          renderDocuments();
          await updateIndexStatus();
        } catch (e) {
          console.error(e);
        }
      };
      documentList.appendChild(item);
    });
  } catch (err) {
    showError(documentList, "Failed to load documents");
  }
}

if (documentList) {
  wireUploadArea();
  renderDocuments();
}

// ---------- SERVICE / INDEX STATUS ----------
const serviceStatusEl = document.getElementById("serviceStatus");
const indexStatusEl = document.getElementById("indexStatus");
const rebuildIndexBtn = document.getElementById("rebuildIndexBtn");

async function updateServiceStatus() {
  if (!serviceStatusEl) return;
  try {
    const res = await fetch(`${API_BASE}/api/v1/Health`);
    if (res.ok) {
      serviceStatusEl.textContent = "Service healthy";
      serviceStatusEl.className = "alert alert-success";
    } else {
      serviceStatusEl.textContent = `Service unavailable (${res.status})`;
      serviceStatusEl.className = "alert alert-danger";
    }
  } catch (e) {
    serviceStatusEl.textContent = "Health check error";
    serviceStatusEl.className = "alert alert-danger";
  }
}

async function updateIndexStatus() {
  if (!indexStatusEl) return;
  try {
    const res = await fetch(`${API_BASE}/api/v1/index/status`);
    if (res.ok) {
      const data = await res.json();
      indexStatusEl.textContent =
        `Index state: ${data.state} — documents: ${data.documentCount} — chunks: ${data.chunksIndexed}`;
      indexStatusEl.className = "alert alert-secondary";
    } else {
      indexStatusEl.textContent = `Index status error (${res.status})`;
      indexStatusEl.className = "alert alert-warning";
    }
  } catch (e) {
    indexStatusEl.textContent = `Index status failed: ${e.message}`;
    indexStatusEl.className = "alert alert-warning";
  }
}

if (rebuildIndexBtn) {
  rebuildIndexBtn.addEventListener("click", async () => {
    rebuildIndexBtn.disabled = true;
    rebuildIndexBtn.textContent = "Rebuilding...";
    try {
      await fetch(`${API_BASE}/api/v1/index/rebuild`, { method: "POST" });
      await updateIndexStatus();
    } catch (e) {
      console.error(e);
    } finally {
      rebuildIndexBtn.disabled = false;
      rebuildIndexBtn.textContent = "Rebuild Index";
    }
  });
}

// initialize status when page loads
updateServiceStatus();
updateIndexStatus();
