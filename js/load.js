const percentEl = document.getElementById('percent');
let progress = 0;
let loaded = false;

// Fake progress animation
const interval = setInterval(() => {
    if (loaded) {
        // If loaded, quickly jump to 100
        progress += 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            finish();
        }
    } else {
        // Slow crawl to 90s
        if (progress < 99) {
            progress++;
        }
    }
    percentEl.innerText = progress + '%';
}, 30);

function finish() {
    // Signal to remove this iframe or hide it
    try {
        const frame = window.parent.document.getElementById('loading-frame');
        if (frame) {
            // Small delay to show 100%
            setTimeout(() => {
                frame.style.transition = 'opacity 0.8s ease';
                frame.style.opacity = '0';
                setTimeout(() => {
                    frame.remove();
                }, 800);
            }, 500);
        }
    } catch (e) {
        console.error("Cannot access parent frame", e);
    }
}

// Listen for the main window load event
// Using window.parent to listen to the container's load event
try {
    if (window.parent.document.readyState === 'complete') {
        loaded = true;
    } else {
        window.parent.addEventListener('load', () => {
            loaded = true;
        });
    }
} catch (e) {
    // Fallback for standalone testing
    window.addEventListener('load', () => {
        loaded = true;
    });
}
