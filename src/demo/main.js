const sourcesDiv = document.getElementById("screens");
const startSharingBtn = document.getElementById("startSharingBtn");
const stopSharingBtn = document.getElementById("stopSharingBtn");

let selectedSourceId;
let selectedSourceName;

window.api.listen("SHARING_STOPPED_MAIN", () => {
  stopSharingBtn.disabled = true;
  startSharingBtn.disabled = false;
  sourcesDiv.innerHTML = "";
  getSources();
});

window.api.listen("SHARING_STARTED_MAIN", () => {
  stopSharingBtn.disabled = false;
  startSharingBtn.disabled = true;
});

// Fetch screen and windows from the OS and display them.
async function getSources() {
  const sources = await window.api.invoke("DESKTOP_CAPTURER_GET_SOURCES", {
    types: ["screen", "window"],
    thumbnailSize: { width: 300, height: 200 },
  });
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    if (source.name === "On24 Screen Share" || source.name === "Screen Share" || source.name === "Entire screen") continue;
    // Create source container immediately
    const sourceContainer = createSourceContainer(source);
    sourcesDiv.appendChild(sourceContainer);
    if (source.name === "Entire screen") selectSource(source, sourceContainer);
    // Generate real-time thumbnail
    try {
      const thumbnail = await createThumbnail(source.id);
      updateSourceThumbnail(sourceContainer, thumbnail);
    } catch (error) {
      console.warn(`Failed to get real-time thumbnail for ${source.name}:`, error);
      // Fallback to default thumbnail
      updateSourceThumbnail(sourceContainer, source.thumbnail.toDataURL());
    }
  }

  startSharingBtn.disabled = false;
  stopSharingBtn.disabled = false;

  stopSharingBtn.onclick = () => {
    window.api.send("STOP");
  };
}

// Create a container for each source.
function createSourceContainer(source) {
  const sourceContainer = document.createElement("div");
  sourceContainer.className = "screen-card";
  sourceContainer.dataset.sourceId = source.id;

  // Placeholder thumbnail
  const img = document.createElement("img");
  img.className = "source-thumbnail";
  img.src =
    "data:image/svg+xml;base64," +
    btoa(`
      <svg width="200" height="133" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="133" fill="#f0f0f0"/>
        <text x="100" y="70" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">Loading...</text>
      </svg>
    `);

  // Create label
  const label = document.createElement("div");
  label.className = "card-body text-center";
  const labelTitle = document.createElement("h5");
  labelTitle.innerText = source.name;
  labelTitle.className = "card-title";
  label.appendChild(labelTitle);

  const labelText = document.createElement("p");
  labelText.innerText = source.id.startsWith("screen") ? "Screen" : "Window";
  labelText.className = "card-text";
  label.appendChild(labelText);

  // Add click handler
  sourceContainer.onclick = () => selectSource(source, sourceContainer);

  // Append elements
  sourceContainer.appendChild(img);
  sourceContainer.appendChild(label);
  return sourceContainer;
}

function updateSourceThumbnail(container, thumbnailDataUrl) {
  const img = container.querySelector(".source-thumbnail");
  if (img) {
    img.src = thumbnailDataUrl;
  }
}

async function createThumbnail(sourceId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Use getUserMedia with the correct constraint format for Electron
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
            maxWidth: 640,
            maxHeight: 480,
          },
        },
      });

      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      video.srcObject = stream;
      video.muted = true;
      video.play();

      video.addEventListener("loadedmetadata", () => {
        // Set canvas size
        canvas.width = 320;
        canvas.height = 200;

        // Wait a bit for the video to show actual content
        setTimeout(() => {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

            // Clean up
            stream.getTracks().forEach((track) => track.stop());
            video.srcObject = null;

            resolve(thumbnail);
          } catch (drawError) {
            stream.getTracks().forEach((track) => track.stop());
            reject(drawError);
          }
        }, 500); // Increased wait time for better capture
      });

      video.addEventListener("error", (error) => {
        stream.getTracks().forEach((track) => track.stop());
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function selectSource(source, cardElement) {
  document.querySelectorAll(".screen-card").forEach((card) => {
    card.classList.remove("active");
  });
  cardElement.classList.add("active");
  selectedSourceId = source.id;
  selectedSourceName = source.name;
}

const startSharing = () => {
  window.api.send("CREATE_OVERLAY_WINDOW", {
    sourceId: selectedSourceId,
    sourceName: selectedSourceName,
  });
};

window.onload = getSources;
