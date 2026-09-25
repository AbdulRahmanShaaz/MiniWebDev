const selectTags = document.querySelectorAll("select");
const translateBtn = document.getElementById("transfer");
const fromText = document.getElementById("FromText");
const ToText = document.getElementById("ToText");
const icons = document.querySelectorAll("img")
selectTags.forEach((tag, id) => {
    tag.innerHTML = "";
    
    for (let country_code in countries) {
        let selected = id == 0 ? (country_code == "en-GB" ? "selected" : "") : (country_code == "hi-IN" ? "selected" : "");
        let option = `<option value="${country_code}" ${selected}>${countries[country_code]}</option>`;
        tag.insertAdjacentHTML("beforeend", option);
    }
});
translateBtn.addEventListener("click", () => {
    if(fromText.value !== ""){
        ToText.value = "Translating...";
        let apiURL = `https://api.mymemory.translated.net/get?q=${fromText.value}&langpair=${selectTags[0].value}|${selectTags[1].value}`;
        fetch(apiURL).then(res => res.json()).then(data => {
            ToText.value = data.responseData.translatedText;
        }).catch(() => {
            ToText.value = "Translation failed. Please try again.";
        });
    }
});
icons.forEach((icon) => {
    icon.addEventListener("click", ({target}) => {
        let isFromPanel = target.parentElement.classList.contains("select1");
        let textToUse = isFromPanel ? fromText.value : ToText.value;
        
        if(!textToUse) return;

        if(target.classList.contains("copy")) {
            navigator.clipboard.writeText(textToUse);
        } else if(target.classList.contains("speaker")) {
            const utterance = new SpeechSynthesisUtterance(textToUse);
            utterance.lang = isFromPanel ? selectTags[0].value : selectTags[1].value;
            speechSynthesis.speak(utterance);
        }
    });
});