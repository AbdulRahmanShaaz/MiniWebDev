const fileInput = document.querySelector("#imageInput");
const dropzone = document.querySelector("#dropzone");
const previewImage = document.querySelector("#previewImage");
const emptyState = document.querySelector("#emptyState");
const previewLabel = document.querySelector("#previewLabel");
const processingOverlay = document.querySelector("#processingOverlay");
const removeButton = document.querySelector("#removeBtn");
const downloadButton = document.querySelector("#downloadBtn");
const statusMessage = document.querySelector("#statusMessage");
const progressTrack = document.querySelector("#progressTrack");
const progressBar = document.querySelector("#progressBar");
const fileDetails = document.querySelector("#fileDetails");
const resetButton = document.querySelector("#resetBtn");
const originalViewButton = document.querySelector("#originalViewBtn");
const resultViewButton = document.querySelector("#resultViewBtn");

const maxFileSize = 20 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const supportedExtensions = /\.(jpe?g|png|webp)$/i;

let selectedFile = null;
let originalUrl = "";
let resultUrl = "";
let operationId = 0;

function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("is-error", type === "error");
    statusMessage.classList.toggle("is-success", type === "success");
}

function setProcessing(isProcessing) {
    removeButton.disabled = isProcessing || !selectedFile;
    removeButton.querySelector("span").textContent = isProcessing
        ? "Removing background…"
        : "Remove background";
    processingOverlay.classList.toggle("hidden", !isProcessing);
}

function formatBytes(bytes) {
    return bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setActiveView(showResult) {
    if (showResult && !resultUrl) return;

    previewImage.src = showResult ? resultUrl : originalUrl;
    previewLabel.textContent = showResult ? "Transparent result" : "Original image";
    previewLabel.classList.remove("hidden");
    originalViewButton.classList.toggle("is-active", !showResult);
    resultViewButton.classList.toggle("is-active", showResult);
    originalViewButton.setAttribute("aria-pressed", String(!showResult));
    resultViewButton.setAttribute("aria-pressed", String(showResult));
}

function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = "";
    downloadButton.removeAttribute("href");
    downloadButton.classList.add("hidden");
    resultViewButton.disabled = true;
    resultViewButton.classList.remove("is-active");
    resultViewButton.setAttribute("aria-pressed", "false");
    originalViewButton.disabled = !selectedFile;
}

function selectFile(file) {
    if (!file) return;

    const typeIsSupported = supportedTypes.has(file.type) ||
        (!file.type && supportedExtensions.test(file.name));

    if (!typeIsSupported) {
        fileInput.value = "";
        setStatus("Choose a JPG, PNG, or WEBP image.", "error");
        return;
    }

    if (file.size > maxFileSize) {
        fileInput.value = "";
        setStatus("This image is larger than 20 MB. Choose a smaller file.", "error");
        return;
    }

    operationId += 1;
    clearResult();
    if (originalUrl) URL.revokeObjectURL(originalUrl);

    selectedFile = file;
    originalUrl = URL.createObjectURL(file);
    previewImage.src = originalUrl;
    previewImage.classList.remove("hidden");
    emptyState.classList.add("hidden");
    previewLabel.classList.add("hidden");
    fileDetails.textContent = `${file.name} · ${formatBytes(file.size)}`;
    resetButton.classList.remove("hidden");
    setProcessing(false);
    originalViewButton.disabled = false;
    resultViewButton.disabled = true;
    progressTrack.classList.add("hidden");
    progressBar.style.width = "0%";
    setStatus("Ready when you are. Your image stays on this device.");
    setActiveView(false);
}

function resetWorkspace() {
    operationId += 1;
    clearResult();
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = "";
    selectedFile = null;
    previewImage.removeAttribute("src");
    previewImage.classList.add("hidden");
    previewLabel.classList.add("hidden");
    emptyState.classList.remove("hidden");
    resetButton.classList.add("hidden");
    setProcessing(false);
    originalViewButton.disabled = true;
    resultViewButton.disabled = true;
    fileDetails.textContent = "No image selected";
    progressTrack.classList.add("hidden");
    progressBar.style.width = "0%";
    fileInput.value = "";
    setStatus("Select a photo to begin.");
}

async function removeBackground() {
    if (!selectedFile || removeButton.disabled) return;

    const activeOperation = ++operationId;
    const fileBeingProcessed = selectedFile;
    clearResult();
    setActiveView(false);
    setProcessing(true);
    downloadButton.classList.add("hidden");
    progressTrack.classList.remove("hidden");
    progressBar.style.width = "3%";
    setStatus("Starting the AI model. The first run can take a few minutes to download its resources.");

    try {
        const { removeBackground: imglyRemoveBackground } = await import(
            "https://esm.sh/@imgly/background-removal@1.7.0?bundle"
        );
        if (activeOperation !== operationId) return;

        const resultBlob = await imglyRemoveBackground(fileBeingProcessed, {
            model: "isnet_fp16",
            output: {
                format: "image/png",
                quality: 1,
                type: "foreground"
            },
            progress: (key, current, total) => {
                if (activeOperation !== operationId) return;

                if (total > 0) {
                    const percent = Math.min(95, Math.max(5, Math.round((current / total) * 100)));
                    progressBar.style.width = `${percent}%`;
                    setStatus(`Loading AI resources… ${percent}%`);
                } else {
                    setStatus(`Loading AI resources… ${key}`);
                }
            }
        });

        if (activeOperation !== operationId) return;
        if (!(resultBlob instanceof Blob) || resultBlob.size === 0) {
            throw new Error("The background-removal model returned an empty image.");
        }

        clearResult();
        resultUrl = URL.createObjectURL(resultBlob);
        const baseName = fileBeingProcessed.name
            .replace(/\.[^.]+$/, "")
            .replace(/[^\w.-]+/g, "_") || "image";
        downloadButton.href = resultUrl;
        downloadButton.download = `${baseName}-no-background.png`;
        downloadButton.classList.remove("hidden");
        resultViewButton.disabled = false;
        progressBar.style.width = "100%";
        setActiveView(true);
        setStatus("Background removed. Your transparent PNG is ready to download.", "success");
    } catch (error) {
        if (activeOperation !== operationId) return;
        console.error("Background removal failed:", error);
        progressBar.style.width = "0%";
        const reason = error instanceof Error ? error.message : String(error);
        setStatus(`Background removal failed: ${reason}. Check your connection and try again.`, "error");
    } finally {
        if (activeOperation === operationId) {
            setProcessing(false);
            if (resultUrl) progressTrack.classList.add("hidden");
        }
    }
}

fileInput.addEventListener("change", (event) => {
    const [file] = event.currentTarget.files;
    selectFile(file);
});

removeButton.addEventListener("click", removeBackground);
resetButton.addEventListener("click", resetWorkspace);
originalViewButton.addEventListener("click", () => setActiveView(false));
resultViewButton.addEventListener("click", () => setActiveView(true));

for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
    });
}

for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
    });
}

dropzone.addEventListener("drop", (event) => {
    selectFile(event.dataTransfer.files[0]);
});

dropzone.addEventListener("click", () => {
    fileInput.click();
});

dropzone.addEventListener("keydown", (event) => {
    if (event.target !== dropzone || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    fileInput.click();
});

window.addEventListener("beforeunload", () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
});
