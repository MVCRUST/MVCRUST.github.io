// ---------- PROMPT PAGE FUNCTIONALITY ----------

const promptInput = document.getElementById("promptInput")
const responseOutput = document.getElementById("responseOutput")

function getStoredDocuments() {
  return JSON.parse(localStorage.getItem("documents")) || []
}

function saveStoredDocuments(docs) {
  localStorage.setItem("documents", JSON.stringify(docs))
}

if (promptInput && responseOutput) {

promptInput.addEventListener("keypress", function(e){

if(e.key === "Enter"){

const prompt = promptInput.value

responseOutput.innerHTML = `
<p><strong>You entered:</strong> ${prompt}</p>
<p>This is where your AI response would appear.</p>
`

promptInput.value = ""

}

})

}


// ---------- LIBRARY PAGE FUNCTIONALITY ----------

const uploadArea = document.getElementById("uploadArea")
const fileUpload = document.getElementById("fileUpload")
const progressBar = document.getElementById("uploadProgress")
const documentList = document.getElementById("documentList")

if(uploadArea && fileUpload){

uploadArea.addEventListener("click", () => fileUpload.click())

uploadArea.addEventListener("dragover", (e)=>{
e.preventDefault()
uploadArea.classList.add("dragover")
})

uploadArea.addEventListener("dragleave", ()=>{
uploadArea.classList.remove("dragover")
})

uploadArea.addEventListener("drop", (e)=>{

e.preventDefault()
uploadArea.classList.remove("dragover")

handleFiles(e.dataTransfer.files)

})

fileUpload.addEventListener("change", ()=>{
handleFiles(fileUpload.files)
})

}

function handleFiles(files){

for(let file of files){
simulateUpload(file)
}

}

function simulateUpload(file){

if(!progressBar) return

progressBar.style.width = "0%"

let progress = 0

let interval = setInterval(()=>{

progress += 10
progressBar.style.width = progress + "%"

if(progress >= 100){

clearInterval(interval)
addDocument(file.name)

}

},100)

}

function addDocument(name, id = null){

if(!documentList) return

const docs = getStoredDocuments()

const docId = id || "temp_" + Date.now()

docs.push({
  name: name,
  id: docId
})

saveStoredDocuments(docs)

renderDocuments()

}
function renderDocuments(){

if(!documentList) return

documentList.innerHTML = ""

const docs = getStoredDocuments()

docs.forEach(doc => {

const item = document.createElement("div")

item.className = "doc-item"

item.innerHTML = `
<span class="doc-name">${doc.name}</span>
<span class="delete-icon">🗑</span>
`

item.querySelector(".delete-icon").onclick = () => {

let docs = getStoredDocuments()

docs = docs.filter(d => d.id !== doc.id)

saveStoredDocuments(docs)

renderDocuments()

}

documentList.appendChild(item)

})

}
if(documentList){
  renderDocuments()
}