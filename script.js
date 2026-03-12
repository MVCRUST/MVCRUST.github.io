// ---------- configuration ----------
// base URL for the DeepRoot API; updated to new hosted endpoint
const API_BASE = "https://ollama-f182.onrender.com/swagger/index.html";

// helper to show errors in an element
function showError(el, message) {
  if (!el) return;
  el.innerHTML = `<p class="text-danger">${message}</p>`;
}

// helper to create a progress bar for a named file upload
function makeFileProgress(name) {
  if (!progressContainer) return null;
  const wrapper = document.createElement("div");
  wrapper.className = "mb-2";
  wrapper.innerHTML = `
    <div>${name}</div>
    <div class="progress">
      <div class="progress-bar" style="width:0%"></div>
    </div>`;
  progressContainer.appendChild(wrapper);
  const bar = wrapper.querySelector(".progress-bar");
  return {
    update: (pct) => {
      if (bar) bar.style.width = pct + "%";
    },
    remove: () => wrapper.remove(),
  };
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

const referenceBox = document.getElementById("referencesBox");

const responseTitleEl = document.getElementById("responseTitle");

if (promptInput && responseOutput) {
  promptInput.addEventListener("keypress", async (e) => {
    if (e.key !== "Enter") return;
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    responseOutput.innerHTML = `<p>Loading...</p>`;
    if (responseTitleEl) responseTitleEl.style.display = "block";
    if (referenceBox) referenceBox.innerHTML = "";
    // lock input until response arrives
    promptInput.disabled = true;

    try {
      const data = await queryPrompt(prompt);
      // hide title once we have an answer
      if (responseTitleEl) responseTitleEl.style.display = "none";
      // display answer
      responseOutput.innerHTML = `<p><strong>Answer:</strong> ${data.answer || "(no answer)"}</p>`;

      // display sources in reference box, separate from response
      if (referenceBox) {
        if (data.sources && data.sources.length) {
          referenceBox.innerHTML =
            '<div><strong>Sources:</strong><ul>' +
            data.sources.map((s) => `<li>${s}</li>`).join("") +
            "</ul></div>";
        } else {
          referenceBox.innerHTML = "";
        }
      }
    } catch (err) {
      showError(responseOutput, err.message);
    } finally {
      // always re-enable input after response or error
      promptInput.disabled = false;
    }

    promptInput.value = "";
  });
}

// ---------- DOCUMENTS (library) ----------
const uploadArea = document.getElementById("uploadArea");
const fileUpload = document.getElementById("fileUpload");
const progressContainer = document.getElementById("progressContainer");
const documentList = document.getElementById("documentList");

console.log("library script initialized", { uploadArea, fileUpload, progressContainer });

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
  console.log("starting upload", file.name);
  const progress = makeFileProgress(file.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/v1/Documents/upload`);
    xhr.onload = async () => {
      progress && progress.update(100);
      console.log("upload onload", xhr.status);
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
    xhr.onerror = () => {
      console.error("xhr network error");
      reject(new Error("network error"));
    };
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && progress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        progress.update(percent);
      }
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  }).finally(() => {
    // remove progress bar after a short delay so user can see 100%
    if (progress) setTimeout(() => progress.remove(), 500);
  });
}

async function handleFiles(files) {
  console.log("handling files", files);
  for (let file of files) {
    try {
      await uploadDocument(file);
    } catch (e) {
      console.error("upload error", e);
      // show message in container
      if (progressContainer) {
        const msg = document.createElement("div");
        msg.className = "text-danger";
        msg.textContent = `Failed to upload ${file.name}: ${e.message}`;
        progressContainer.appendChild(msg);
        setTimeout(() => msg.remove(), 5000);
      }
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
        if (!confirm(`Delete document '${doc.fileName}'?`)) {
          return;
        }
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
