(() => {
  "use strict";

  const FORM_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyaSU7JnkJR0WZNgVdOMvqCTMQ-GUP9HFRKbPaQoV9P8nmCQtJQmLz9mg4MiYT0ktk/exec";

  const LIMITS = Object.freeze({
    maxUploadFiles: 10,
    maxFileBytes: 10 * 1024 * 1024,
    maxTotalBytes: 12 * 1024 * 1024,
    maxAudioSeconds: 10 * 60,
    maxVideoSeconds: 3 * 60,
  });

  const form = document.getElementById("storyForm");
  if (!form) return;

  const methodButtons = [...document.querySelectorAll(".share-method-button")];
  const panels = [...document.querySelectorAll(".share-panel")];
  const status = document.getElementById("formStatus");
  const submitButton = form.querySelector('button[type="submit"]');
  const fileInput = document.getElementById("files");
  const fileSummary = document.getElementById("fileSelectionSummary");
  const availabilityMessage = document.getElementById("recordingAvailabilityMessage");
  const progressWrap = document.getElementById("submissionProgress");
  const progressBar = document.getElementById("submissionProgressBar");

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatClock(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function chooseMimeType(candidates) {
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") {
      return "";
    }
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function extensionForMimeType(mimeType, fallback) {
    const type = String(mimeType || "").toLowerCase();
    if (type.includes("mp4")) return "mp4";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    if (type.includes("mpeg")) return "mp3";
    if (type.includes("quicktime")) return "mov";
    if (type.includes("webm")) return "webm";
    return fallback;
  }

  function timestampForFilename() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      "-",
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("");
  }

  function setAvailabilityMessage(message = "") {
    if (!availabilityMessage) return;
    availabilityMessage.textContent = message;
    availabilityMessage.hidden = !message;
  }

  function setMethodUnavailable(method, message) {
    const button = methodButtons.find((item) => item.dataset.method === method);
    if (!button) return;
    button.dataset.unavailable = "true";
    button.classList.add("is-unavailable");
    button.setAttribute("aria-disabled", "true");
    button.title = message;
  }

  function clearMethodUnavailable(method) {
    const button = methodButtons.find((item) => item.dataset.method === method);
    if (!button) return;
    delete button.dataset.unavailable;
    button.classList.remove("is-unavailable");
    button.removeAttribute("aria-disabled");
    button.removeAttribute("title");
  }

  function showProgress(percent, indeterminate = false) {
    if (!progressWrap || !progressBar) return;
    progressWrap.hidden = false;
    progressWrap.classList.toggle("is-indeterminate", indeterminate);
    progressBar.style.width = indeterminate
      ? "35%"
      : `${Math.max(0, Math.min(100, percent))}%`;
  }

  function hideProgress() {
    if (!progressWrap || !progressBar) return;
    progressWrap.hidden = true;
    progressWrap.classList.remove("is-indeterminate");
    progressBar.style.width = "0%";
  }

  function makeRecorder(config) {
    const start = document.getElementById(config.startId);
    const stop = document.getElementById(config.stopId);
    const clear = document.getElementById(config.clearId);
    const preview = document.getElementById(config.previewId);
    const message = document.getElementById(config.messageId);
    const indicator = document.getElementById(config.indicatorId);
    const indicatorTime = indicator?.querySelector("[data-recording-time]");

    const state = {
      blob: null,
      filename: "",
      mimeType: "",
      isRecording: false,
      clear: null,
      release: null,
      stop: null,
    };

    let stream = null;
    let recorder = null;
    let chunks = [];
    let objectUrl = null;
    let timerId = null;
    let autoStopId = null;
    let startedAt = 0;
    let discardOnStop = false;
    let stoppedAtLimit = false;

    if (!start || !stop || !clear || !preview || !message) return state;

    function releaseStream() {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stream = null;
      if (config.kind === "video" && "srcObject" in preview) {
        preview.srcObject = null;
      }
    }

    function clearTimers() {
      if (timerId) window.clearInterval(timerId);
      if (autoStopId) window.clearTimeout(autoStopId);
      timerId = null;
      autoStopId = null;
    }

    function showIndicator(elapsedSeconds) {
      if (!indicator) return;
      indicator.hidden = false;
      if (indicatorTime) {
        indicatorTime.textContent = `${formatClock(elapsedSeconds)} / ${formatClock(
          config.maxSeconds
        )}`;
      }
    }

    function hideIndicator() {
      if (indicator) indicator.hidden = true;
    }

    function resetButtons() {
      start.disabled = false;
      stop.disabled = true;
      clear.disabled = !state.blob;
      start.textContent = state.blob ? "Record again" : "Start recording";
    }

    function resetPreview() {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      preview.pause?.();
      if ("srcObject" in preview) preview.srcObject = null;
      preview.removeAttribute("src");
      preview.removeAttribute("muted");
      preview.controls = true;
      preview.load?.();
      preview.hidden = true;
    }

    function clearRecording() {
      clearTimers();
      hideIndicator();
      stoppedAtLimit = false;

      if (recorder && recorder.state === "recording") {
        discardOnStop = true;
        try {
          recorder.stop();
        } catch (error) {
          console.warn(error);
        }
      }

      releaseStream();
      state.isRecording = false;
      state.blob = null;
      state.filename = "";
      state.mimeType = "";
      chunks = [];
      resetPreview();
      message.textContent = "No recording saved.";
      resetButtons();
    }

    function stopRecording(atLimit = false) {
      if (recorder?.state !== "recording") return;
      stoppedAtLimit = atLimit;
      recorder.stop();
      stop.disabled = true;
    }

    async function beginRecording() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        message.textContent =
          `This browser does not support ${config.kind} recording. Upload an existing file instead.`;
        setMethodUnavailable(
          config.kind,
          `${config.label} recording is not supported in this browser. Upload a file instead.`
        );
        return;
      }

      try {
        clearRecording();
        discardOnStop = false;
        stream = await navigator.mediaDevices.getUserMedia(config.constraints);
        chunks = [];

        if (config.kind === "video") {
          clearMethodUnavailable("video");
          preview.hidden = false;
          preview.controls = false;
          preview.muted = true;
          preview.setAttribute("muted", "");
          if ("srcObject" in preview) preview.srcObject = stream;
          try {
            await preview.play();
          } catch (playError) {
            console.warn("Live preview could not autoplay:", playError);
          }
        }

        const preferredMimeType = chooseMimeType(config.mimeTypes);
        const options = {
          ...config.recorderOptions,
          ...(preferredMimeType ? { mimeType: preferredMimeType } : {}),
        };

        recorder = new MediaRecorder(stream, options);

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data?.size) chunks.push(event.data);
        });

        recorder.addEventListener("stop", () => {
          clearTimers();
          hideIndicator();
          state.isRecording = false;

          if (discardOnStop) {
            discardOnStop = false;
            releaseStream();
            chunks = [];
            resetButtons();
            return;
          }

          const mimeType = recorder.mimeType || preferredMimeType || config.fallbackType;
          const blob = new Blob(chunks, { type: mimeType });
          releaseStream();

          if (!blob.size) {
            message.textContent = "No recording was captured. Please try again.";
            resetPreview();
            resetButtons();
            return;
          }

          if (blob.size > LIMITS.maxFileBytes) {
            message.textContent =
              `The recording is ${formatBytes(blob.size)}, over the 10 MB limit. Please make a shorter recording.`;
            state.blob = null;
            resetPreview();
            resetButtons();
            return;
          }

          state.blob = blob;
          state.mimeType = mimeType;
          state.filename = `${config.filenamePrefix}-${timestampForFilename()}.${extensionForMimeType(
            mimeType,
            config.fallbackExtension
          )}`;

          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          preview.src = objectUrl;
          preview.controls = true;
          preview.muted = false;
          preview.removeAttribute("muted");
          preview.hidden = false;

          message.textContent = stoppedAtLimit
            ? `Maximum recording time reached. Recording saved (${formatBytes(blob.size)}). Review it below or delete and record again.`
            : `Recording saved (${formatBytes(blob.size)}). Review it below or delete and record again.`;

          stoppedAtLimit = false;
          resetButtons();
        });

        recorder.addEventListener("error", () => {
          clearTimers();
          hideIndicator();
          releaseStream();
          state.isRecording = false;
          message.textContent = "The recording could not be completed. Please try again.";
          resetPreview();
          resetButtons();
        });

        recorder.start(1000);
        state.isRecording = true;
        startedAt = Date.now();
        start.disabled = true;
        stop.disabled = false;
        clear.disabled = true;
        message.textContent = `${config.label} recording is in progress. Press Stop when finished.`;

        const updateTimer = () => {
          const elapsed = Math.min(
            config.maxSeconds,
            Math.floor((Date.now() - startedAt) / 1000)
          );
          showIndicator(elapsed);
        };

        updateTimer();
        timerId = window.setInterval(updateTimer, 250);
        autoStopId = window.setTimeout(() => {
          stopRecording(true);
        }, config.maxSeconds * 1000);
      } catch (error) {
        clearTimers();
        hideIndicator();
        releaseStream();
        state.isRecording = false;
        resetPreview();

        const errorName = String(error?.name || "");
        if (
          config.kind === "video" &&
          ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(errorName)
        ) {
          const noCameraMessage = "No camera detected — upload a video instead.";
          setMethodUnavailable("video", noCameraMessage);
          message.textContent = noCameraMessage;
          setAvailabilityMessage(noCameraMessage);
        } else if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(errorName)) {
          message.textContent =
            `Camera or microphone permission was denied. Allow access in your browser settings, then try again.`;
        } else if (["NotReadableError", "TrackStartError"].includes(errorName)) {
          message.textContent =
            `The ${config.kind === "video" ? "camera or microphone" : "microphone"} is being used by another app. Close the other app and try again.`;
        } else {
          message.textContent =
            `The browser could not access the ${config.kind === "video" ? "camera and microphone" : "microphone"}. Check permission settings and try again.`;
        }

        resetButtons();
      }
    }

    start.addEventListener("click", beginRecording);
    stop.addEventListener("click", () => stopRecording(false));
    clear.addEventListener("click", clearRecording);

    state.clear = clearRecording;
    state.release = releaseStream;
    state.stop = stopRecording;
    return state;
  }

  const audioRecorder = makeRecorder({
    kind: "audio",
    label: "Audio",
    startId: "startAudio",
    stopId: "stopAudio",
    clearId: "clearAudio",
    previewId: "audioPreview",
    messageId: "audioMessage",
    indicatorId: "audioRecordingStatus",
    filenamePrefix: "recorded-audio",
    maxSeconds: LIMITS.maxAudioSeconds,
    constraints: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    },
    mimeTypes: ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"],
    recorderOptions: { audioBitsPerSecond: 64000 },
    fallbackType: "audio/webm",
    fallbackExtension: "webm",
  });

  const videoRecorder = makeRecorder({
    kind: "video",
    label: "Video",
    startId: "startVideo",
    stopId: "stopVideo",
    clearId: "clearVideo",
    previewId: "videoPreview",
    messageId: "videoMessage",
    indicatorId: "videoRecordingStatus",
    filenamePrefix: "recorded-video",
    maxSeconds: LIMITS.maxVideoSeconds,
    constraints: {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 15, max: 20 },
        facingMode: "user",
      },
    },
    mimeTypes: [
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
      "video/quicktime",
    ],
    recorderOptions: {
      audioBitsPerSecond: 48000,
      videoBitsPerSecond: 320000,
    },
    fallbackType: "video/webm",
    fallbackExtension: "webm",
  });

  function anyRecorderActive() {
    return audioRecorder.isRecording || videoRecorder.isRecording;
  }

  function selectMethod(button) {
    const method = button.dataset.method;

    if (button.dataset.unavailable === "true") {
      setAvailabilityMessage(button.title || "This recording option is unavailable. Upload a file instead.");
      return;
    }

    if (anyRecorderActive()) {
      setAvailabilityMessage("Stop the current recording before changing how you are sharing.");
      return;
    }

    setAvailabilityMessage("");
    methodButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== method;
    });
  }

  methodButtons.forEach((button) => {
    button.addEventListener("click", () => selectMethod(button));
  });

  async function updateDeviceAvailability() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMethodUnavailable(
        "audio",
        "Audio recording is not supported in this browser. Upload an audio file instead."
      );
      setMethodUnavailable(
        "video",
        "Video recording is not supported in this browser. Upload a video file instead."
      );
      return;
    }

    if (!navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!devices.length) return;

      const hasCamera = devices.some((device) => device.kind === "videoinput");
      const hasMicrophone = devices.some((device) => device.kind === "audioinput");

      if (hasMicrophone) {
        clearMethodUnavailable("audio");
      } else {
        setMethodUnavailable("audio", "No microphone detected — upload an audio file instead.");
      }

      if (hasCamera) {
        clearMethodUnavailable("video");
      } else {
        setMethodUnavailable("video", "No camera detected — upload a video instead.");
      }
    } catch (error) {
      console.warn("Could not check recording devices:", error);
    }
  }

  updateDeviceAvailability();
  navigator.mediaDevices?.addEventListener?.("devicechange", updateDeviceAvailability);

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return window.btoa(binary);
  }

  async function blobToPayload(blob, filename, mimeType) {
    const buffer = await blob.arrayBuffer();
    return {
      name: filename,
      mimeType: mimeType || blob.type || "application/octet-stream",
      size: blob.size,
      base64: arrayBufferToBase64(buffer),
    };
  }

  function validateSelectedMedia(uploadFiles) {
    if (uploadFiles.length > LIMITS.maxUploadFiles) {
      throw new Error(`Choose no more than ${LIMITS.maxUploadFiles} uploaded files.`);
    }

    const allItems = [
      ...uploadFiles,
      ...(audioRecorder.blob ? [audioRecorder.blob] : []),
      ...(videoRecorder.blob ? [videoRecorder.blob] : []),
    ];

    for (const item of allItems) {
      if (item.size > LIMITS.maxFileBytes) {
        throw new Error(
          `“${item.name || "A recording"}” is ${formatBytes(item.size)}. Each file must be 10 MB or smaller.`
        );
      }
    }

    const totalBytes = allItems.reduce((sum, item) => sum + item.size, 0);
    if (totalBytes > LIMITS.maxTotalBytes) {
      throw new Error(
        `The selected media totals ${formatBytes(totalBytes)}. The combined limit is 12 MB per submission.`
      );
    }

    return totalBytes;
  }

  function updateFileSummary() {
    if (!fileInput || !fileSummary) return;
    const files = [...fileInput.files];

    if (!files.length) {
      fileSummary.textContent = "No files selected.";
      fileSummary.classList.remove("is-error");
      return;
    }

    try {
      const total = validateSelectedMedia(files);
      const names = files.map((file) => file.name).join(", ");
      fileSummary.textContent = `${files.length} file${files.length === 1 ? "" : "s"} selected (${formatBytes(total)}): ${names}`;
      fileSummary.classList.remove("is-error");
    } catch (error) {
      fileSummary.textContent = error.message;
      fileSummary.classList.add("is-error");
    }
  }

  fileInput?.addEventListener("change", updateFileSummary);

  function setSubmitting(isSubmitting) {
    if (submitButton) {
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? "Sending…" : "Send story";
    }

    methodButtons.forEach((button) => {
      button.disabled = isSubmitting;
    });

    if (fileInput) fileInput.disabled = isSubmitting;
    form.setAttribute("aria-busy", isSubmitting ? "true" : "false");
  }

  function resetInterface() {
    form.reset();
    audioRecorder.clear?.();
    videoRecorder.clear?.();
    hideProgress();
    updateFileSummary();
    setAvailabilityMessage("");

    methodButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.method === "write");
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== "write";
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (anyRecorderActive()) {
      status.textContent = "Stop the current recording before sending your story.";
      return;
    }

    const name = String(form.elements.name?.value || "").trim();
    const identity = form.querySelector('input[name="publication_identity"]:checked');
    const officialsPermission = form.querySelector(
      'input[name="officials_permission"]:checked'
    );

    if (!name) {
      status.textContent = "Please enter your name. It will remain private unless you choose to publish it.";
      form.elements.name?.focus();
      return;
    }

    if (!identity) {
      status.textContent = "Choose how your identity may be used.";
      return;
    }

    if (!officialsPermission) {
      status.textContent =
        "Choose whether the submission may be shared with elected officials.";
      return;
    }

    const story = String(form.elements.story?.value || "").trim();
    const uploadFiles = fileInput ? [...fileInput.files] : [];
    const hasMedia = uploadFiles.length || audioRecorder.blob || videoRecorder.blob;

    if (!story && !hasMedia) {
      status.textContent =
        "Write a story, upload at least one file, or make an audio or video recording before sending.";
      return;
    }

    try {
      const totalBytes = validateSelectedMedia(uploadFiles);
      setSubmitting(true);
      showProgress(4);

      status.textContent = totalBytes
        ? `Preparing ${formatBytes(totalBytes)} of private media for upload…`
        : "Preparing your story…";

      const mediaCount =
        uploadFiles.length + (audioRecorder.blob ? 1 : 0) + (videoRecorder.blob ? 1 : 0);
      let preparedCount = 0;
      const updatePreparationProgress = () => {
        preparedCount += 1;
        const percentage = mediaCount
          ? 5 + Math.round((preparedCount / mediaCount) * 65)
          : 70;
        showProgress(percentage);
      };

      const uploads = [];
      for (let index = 0; index < uploadFiles.length; index += 1) {
        const file = uploadFiles[index];
        status.textContent = `Preparing uploaded file ${index + 1} of ${uploadFiles.length}: ${file.name}`;
        uploads.push(await blobToPayload(file, file.name, file.type));
        updatePreparationProgress();
      }

      let recordedAudio = null;
      if (audioRecorder.blob) {
        status.textContent = "Preparing the audio recording…";
        recordedAudio = await blobToPayload(
          audioRecorder.blob,
          audioRecorder.filename,
          audioRecorder.mimeType
        );
        updatePreparationProgress();
      }

      let recordedVideo = null;
      if (videoRecorder.blob) {
        status.textContent = "Preparing the video recording…";
        recordedVideo = await blobToPayload(
          videoRecorder.blob,
          videoRecorder.filename,
          videoRecorder.mimeType
        );
        updatePreparationProgress();
      }

      const payload = {
        name,
        email: form.elements.email?.value || "",
        location: form.elements.location?.value || "",
        connection: form.elements.connection?.value || "",
        years: form.elements.years?.value || "",
        story_title: form.elements.story_title?.value || "",
        story,
        publication_identity: identity.value,
        officials_permission: officialsPermission.value,
        website: "",
        uploads,
        recorded_audio: recordedAudio,
        recorded_video: recordedVideo,
      };

      status.textContent = "Uploading your private submission. Keep this page open…";
      showProgress(75, true);

      await fetch(FORM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify(payload),
      });

      showProgress(100);
      resetInterface();
      status.textContent =
        "Thank you. Your story and selected media were submitted privately.";
    } catch (error) {
      console.error(error);
      hideProgress();
      status.textContent =
        error?.message ||
        "The submission could not be sent. Check your connection and try again.";
    } finally {
      setSubmitting(false);
    }
  });

  window.addEventListener("beforeunload", () => {
    audioRecorder.release?.();
    videoRecorder.release?.();
  });
})();
