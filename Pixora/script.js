import { InferenceClient } from "https://cdn.jsdelivr.net/npm/@huggingface/inference/+esm";

// Models ranked by quality — will try in order if one fails
const MODELS = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-xl-base-1.0",
    "ZB-Tech/Text-to-Image",
];

// DOM Elements
const promptInput = document.getElementById("prompt");
const tokenInput = document.getElementById("hf-token");
const generateBtn = document.getElementById("btn-image");
const imageElement = document.getElementById("image");
const placeholderText = document.getElementById("placeholder-text");
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");
const downloadBtn = document.getElementById("download-btn");
const toastEl = document.getElementById("toast");

// Show a toast notification instead of ugly alerts
function showToast(message, type = "error") {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show`;
    setTimeout(() => toastEl.classList.remove("show"), 4000);
}

// Try generating with fallback models
async function generateWithFallback(prompt, token) {
    const client = new InferenceClient(token);

    for (let i = 0; i < MODELS.length; i++) {
        const model = MODELS[i];
        loaderText.textContent = `Trying ${model.split("/")[1]}...`;
        try {
            const blob = await client.textToImage({
                model: model,
                inputs: prompt,
            });
            return { blob, model };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`Model ${model} failed: ${message}`);
            if (err.status === 401 || err.status === 403 || /unauthorized|invalid token|permission|forbidden|gated/i.test(message)) {
                throw new Error("Hugging Face rejected this token. Use a valid token with Inference Providers access.");
            }
            if (i === MODELS.length - 1) throw new Error(`No image model succeeded. ${message}`);
        }
    }
}

// Generate Image
generateBtn.addEventListener("click", async () => {
    const prompt = promptInput.value.trim();
    const token = tokenInput.value.trim();
    if (!prompt) {
        showToast("Please enter a prompt first!", "warning");
        return;
    }
    if (!token) {
        showToast("Enter a Hugging Face token with Inference Providers access.", "warning");
        tokenInput.focus();
        return;
    }

    // Set UI to loading state
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="btn-spinner"></span> Generating...';
    imageElement.classList.remove("active");
    downloadBtn.classList.remove("active");
    placeholderText.style.display = "none";
    loader.classList.add("active");
    loaderText.classList.add("active");
    loaderText.textContent = "Warming up the AI...";

    try {
        const { blob, model } = await generateWithFallback(prompt, token);

        // Convert blob to local object URL
        const imageUrl = URL.createObjectURL(blob);

        // Display generated image
        // Setup download link
        downloadBtn.href = imageUrl;
        downloadBtn.download = `pixora_${Date.now()}.png`;

        // Wait for image to load before showing it
        imageElement.onload = () => {
            loader.classList.remove("active");
            loaderText.classList.remove("active");
            imageElement.classList.add("active");
            downloadBtn.classList.add("active");
            showToast(`Generated with ${model.split("/")[1]}`, "success");
        };
        imageElement.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            loader.classList.remove("active");
            loaderText.classList.remove("active");
            placeholderText.style.display = "block";
            placeholderText.textContent = "Image response could not be displayed — try again";
            showToast("The image response could not be displayed. Try generating again.");
        };
        imageElement.src = imageUrl;

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Error generating image:", message);
        showToast(message);
        loader.classList.remove("active");
        loaderText.classList.remove("active");
        placeholderText.style.display = "block";
        placeholderText.textContent = "⚠️ Generation failed — try again";
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '✨ Generate Masterpiece';
    }
});

// Trigger generation on 'Enter' key press
promptInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        generateBtn.click();
    }
});

// ─── Zoom Modal ───
const zoomOverlay = document.getElementById("zoom-overlay");
const zoomImage = document.getElementById("zoom-image");
const zoomContainer = document.getElementById("zoom-container");
const zoomCloseBtn = document.getElementById("zoom-close");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const zoomResetBtn = document.getElementById("zoom-reset-btn");
const zoomLevelDisplay = document.getElementById("zoom-level");

let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let hasPanned = false;
let startX = 0;
let startY = 0;

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.25;

function updateZoomTransform() {
    zoomImage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    zoomLevelDisplay.textContent = `${Math.round(scale * 100)}%`;
}

function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    updateZoomTransform();
}

function openZoom() {
    if (!imageElement.src || !imageElement.classList.contains("active")) return;
    zoomImage.src = imageElement.src;
    // Clear any previous animation so JS transforms work
    zoomImage.style.animation = 'none';
    resetZoom();
    zoomOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
    // Trigger entrance animation then clear it so JS transforms take over
    requestAnimationFrame(() => {
        zoomImage.style.animation = 'zoomImageIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        zoomImage.addEventListener('animationend', () => {
            zoomImage.style.animation = 'none';
            updateZoomTransform();
        }, { once: true });
    });
}

function closeZoom() {
    zoomOverlay.classList.remove("active");
    document.body.style.overflow = "";
}

// Click image to open zoom
imageElement.addEventListener("click", openZoom);

// Close controls
zoomCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeZoom();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && zoomOverlay.classList.contains("active")) {
        closeZoom();
    }
});

// Click on backdrop (not on image/controls) to close — skip if we just panned
zoomOverlay.addEventListener("click", (e) => {
    if (hasPanned) {
        hasPanned = false;
        return;
    }
    if (e.target === zoomOverlay || e.target === zoomContainer) {
        closeZoom();
    }
});

// Scroll wheel zoom — centers on cursor position
zoomContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = zoomContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Point in image space before zoom
    const imgX = (mouseX - panX) / scale;
    const imgY = (mouseY - panY) / scale;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * scale * 0.3));

    // Adjust pan so the point under the cursor stays fixed
    panX = mouseX - imgX * newScale;
    panY = mouseY - imgY * newScale;
    scale = newScale;

    updateZoomTransform();
}, { passive: false });

// Mouse drag panning
zoomContainer.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    hasPanned = false;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    zoomOverlay.classList.add("panning");
    e.preventDefault();
});

window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    hasPanned = true;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateZoomTransform();
});

window.addEventListener("mouseup", () => {
    if (isPanning) {
        isPanning = false;
        zoomOverlay.classList.remove("panning");
    }
});

// Touch support for mobile panning
let lastTouchDist = 0;
let lastTouchCenter = { x: 0, y: 0 };

zoomContainer.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
        isPanning = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
        zoomOverlay.classList.add("panning");
    } else if (e.touches.length === 2) {
        isPanning = false;
        lastTouchDist = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY
        );
        lastTouchCenter = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
    }
    e.preventDefault();
}, { passive: false });

zoomContainer.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && isPanning) {
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        updateZoomTransform();
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[1].clientX - e.touches[0].clientX,
            e.touches[1].clientY - e.touches[0].clientY
        );
        const center = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };

        const rect = zoomContainer.getBoundingClientRect();
        const imgX = (center.x - rect.left - panX) / scale;
        const imgY = (center.y - rect.top - panY) / scale;

        const zoomFactor = dist / lastTouchDist;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));

        panX = center.x - rect.left - imgX * newScale;
        panY = center.y - rect.top - imgY * newScale;
        scale = newScale;

        lastTouchDist = dist;
        lastTouchCenter = center;
        updateZoomTransform();
    }
    e.preventDefault();
}, { passive: false });

zoomContainer.addEventListener("touchend", () => {
    isPanning = false;
    zoomOverlay.classList.remove("panning");
});

// Zoom control buttons
zoomInBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = zoomContainer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const imgX = (cx - panX) / scale;
    const imgY = (cy - panY) / scale;
    scale = Math.min(MAX_SCALE, scale * 1.3);
    panX = cx - imgX * scale;
    panY = cy - imgY * scale;
    updateZoomTransform();
});

zoomOutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = zoomContainer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const imgX = (cx - panX) / scale;
    const imgY = (cy - panY) / scale;
    scale = Math.max(MIN_SCALE, scale / 1.3);
    panX = cx - imgX * scale;
    panY = cy - imgY * scale;
    updateZoomTransform();
});

zoomResetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetZoom();
});
