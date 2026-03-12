const promptInput = document.getElementById("promptInput")
const responseOutput = document.getElementById("responseOutput")

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