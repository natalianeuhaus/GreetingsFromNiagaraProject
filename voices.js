(() => {
  "use strict";

  const STORIES_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbyaSU7JnkJR0WZNgVdOMvqCTMQ-GUP9HFRKbPaQoV9P8nmCQtJQmLz9mg4MiYT0ktk/exec";

  const archive = document.getElementById("voicesArchive");
  const status = document.getElementById("voicesStatus");
  const explorer = document.getElementById("voicesExplorer");
  const searchInput = document.getElementById("voicesSearch");
  const connectionFilters = document.getElementById("connectionFilters");
  const mediaFilters = document.getElementById("mediaFilters");
  const clearButton = document.getElementById("voicesClearFilters");
  const resultCount = document.getElementById("voicesResultCount");

  if (
    !archive ||
    !status ||
    !explorer ||
    !searchInput ||
    !connectionFilters ||
    !mediaFilters ||
    !clearButton ||
    !resultCount
  ) {
    return;
  }

  const state = {
    stories: [],
    query: "",
    connection: "all",
    media: "all",
  };

  const CONNECTION_ORDER = [
    "resident",
    "former resident",
    "worker or former worker",
    "student or school community",
    "family member",
    "witness or researcher",
    "other",
    "not specified",
  ];

  const MEDIA_LABELS = Object.freeze({
    written: "Written",
    audio: "Audio",
    video: "Video",
    image: "Photograph",
    document: "Document",
  });

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function connectionLabel(value) {
    const cleaned = String(value || "").trim();
    return cleaned || "Not specified";
  }

  function storyTypes(story) {
    const types = new Set();
    if (String(story.story || "").trim()) types.add("written");

    (Array.isArray(story.media) ? story.media : []).forEach((media) => {
      const kind = String(media?.kind || "document").toLowerCase();
      types.add(["image", "audio", "video", "document"].includes(kind) ? kind : "document");
    });

    return types;
  }

  function primaryMedia(story) {
    const media = Array.isArray(story.media) ? story.media : [];
    return (
      media.find((item) => item.kind === "image") ||
      media.find((item) => item.kind === "video") ||
      media.find((item) => item.kind === "audio") ||
      media.find((item) => item.kind === "document") ||
      null
    );
  }

  function storySearchText(story) {
    const mediaNames = (Array.isArray(story.media) ? story.media : [])
      .map((media) => media?.name || "")
      .join(" ");

    return normalizeText(
      [
        story.title,
        story.story,
        story.publicName,
        story.publicLocation,
        story.publicDetails,
        story.connection,
        mediaNames,
      ].join(" ")
    );
  }

  function appendStoryText(container, storyText) {
    const paragraphs = String(storyText || "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    paragraphs.forEach((paragraph) => {
      container.appendChild(createElement("p", "", paragraph));
    });
  }

  function storyExcerpt(storyText, maxLength = 230) {
    const text = String(storyText || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).replace(/\s+\S*$/, "").trim()}…`;
  }

  function mediaPrompt(kind) {
    const prompts = {
      audio: { icon: "▶", eyebrow: "Audio testimony", action: "Listen to this story" },
      video: { icon: "▶", eyebrow: "Video testimony", action: "Watch this story" },
      document: { icon: "↗", eyebrow: "Approved document", action: "View this record" },
    };
    return prompts[kind] || prompts.document;
  }

  function renderCardCover(story, primary) {
    const cover = createElement("div", "voice-card-cover");

    if (primary?.kind === "image" && primary.imageUrl) {
      const image = createElement("img", "voice-card-cover-image");
      image.src = primary.imageUrl;
      image.alt = primary.name || `Photograph accompanying ${story.title || "this story"}`;
      image.loading = "lazy";
      image.decoding = "async";
      cover.appendChild(image);

      if ((story.media || []).length > 1) {
        cover.appendChild(
          createElement("span", "voice-card-media-count", `+${story.media.length - 1} more`)
        );
      }
      return cover;
    }

    if (primary) {
      const prompt = mediaPrompt(primary.kind);
      cover.classList.add(`voice-card-cover--${primary.kind || "document"}`);
      cover.appendChild(createElement("span", "voice-card-play", prompt.icon));

      const copy = createElement("div", "voice-card-cover-copy");
      copy.appendChild(createElement("span", "voice-card-cover-eyebrow", prompt.eyebrow));
      copy.appendChild(createElement("strong", "", prompt.action));
      cover.appendChild(copy);
      return cover;
    }

    cover.classList.add("voice-card-cover--written");
    cover.appendChild(createElement("span", "voice-card-quote-mark", "“"));
    cover.appendChild(createElement("span", "voice-card-cover-eyebrow", "Written testimony"));
    return cover;
  }

  function renderMedia(mediaItems, storyTitle) {
    const mediaGrid = createElement("div", "voice-detail-media-grid");

    mediaItems.forEach((media) => {
      const kind = ["image", "audio", "video", "document"].includes(media.kind)
        ? media.kind
        : "document";
      const item = createElement("figure", `voice-detail-media voice-detail-media--${kind}`);

      if (kind === "image" && media.imageUrl) {
        const link = createElement("a", "voice-detail-image-link");
        link.href = media.viewUrl || media.imageUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const image = createElement("img", "voice-detail-image");
        image.src = media.imageUrl;
        image.alt = media.name || `Photograph accompanying ${storyTitle}`;
        image.loading = "lazy";
        image.decoding = "async";
        link.appendChild(image);
        item.appendChild(link);
      } else if (["audio", "video"].includes(kind) && media.previewUrl) {
        const frame = createElement("iframe", `voice-detail-frame voice-detail-frame--${kind}`);
        frame.dataset.src = media.previewUrl;
        frame.title = `${kind === "audio" ? "Audio" : "Video"}: ${media.name || storyTitle}`;
        frame.loading = "lazy";
        frame.allow = "autoplay; encrypted-media; picture-in-picture";
        frame.setAttribute("allowfullscreen", "");
        item.appendChild(frame);
      } else {
        const link = createElement("a", "voice-document-link");
        link.href = media.viewUrl || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.appendChild(createElement("span", "voice-document-icon", "↗"));
        link.appendChild(createElement("span", "", "Open approved document"));
        item.appendChild(link);
      }

      if (media.name) {
        item.appendChild(createElement("figcaption", "voice-detail-caption", media.name));
      }

      mediaGrid.appendChild(item);
    });

    return mediaGrid;
  }

  function loadDetailFrames(details) {
    if (!details) return;
    details.querySelectorAll("iframe[data-src]").forEach((frame) => {
      if (!frame.hasAttribute("src")) {
        frame.setAttribute("src", frame.dataset.src);
      }
    });
  }

  function renderStoryCard(story, index) {
    const types = storyTypes(story);
    const primary = primaryMedia(story);
    const primaryKind = primary?.kind || "written";
    const article = createElement("article", `voice-card voice-card--${primaryKind}`);
    article.id = `story-${story.id}`;
    article.dataset.connection = normalizeText(connectionLabel(story.connection));
    article.dataset.types = [...types].join(" ");

    if (["image", "video"].includes(primaryKind) || (story.story || "").length > 900) {
      article.classList.add("voice-card--wide");
    } else if (index % 7 === 4) {
      article.classList.add("voice-card--medium");
    }

    const cover = renderCardCover(story, primary);
    cover.classList.add("voice-card-cover--action");
    cover.tabIndex = 0;
    cover.setAttribute("role", "button");
    cover.setAttribute("aria-label", `Open ${story.title || "this story"}`);
    article.appendChild(cover);

    const body = createElement("div", "voice-card-body");
    const tagRow = createElement("div", "voice-card-tags");
    tagRow.appendChild(createElement("span", "voice-card-tag", connectionLabel(story.connection)));
    [...types].slice(0, 3).forEach((type) => {
      tagRow.appendChild(createElement("span", "voice-card-tag", MEDIA_LABELS[type] || type));
    });
    body.appendChild(tagRow);

    body.appendChild(createElement("h2", "voice-card-title", story.title || "Untitled story"));

    const bylineParts = [story.publicName, story.publicLocation, story.date].filter(Boolean);
    if (bylineParts.length) {
      body.appendChild(createElement("p", "voice-card-meta", bylineParts.join(" · ")));
    }

    const excerpt = storyExcerpt(story.story);
    if (excerpt) body.appendChild(createElement("p", "voice-card-excerpt", excerpt));

    const details = createElement("details", "voice-card-details");
    const action = primaryKind === "audio"
      ? "Listen and read"
      : primaryKind === "video"
        ? "Watch and read"
        : primaryKind === "image"
          ? "View story"
          : primaryKind === "document"
            ? "Open story and records"
            : "Read full story";

    const summary = createElement("summary", "voice-card-summary");
    summary.appendChild(createElement("span", "", action));
    summary.appendChild(createElement("span", "voice-card-summary-mark", "+"));
    details.appendChild(summary);

    const detailBody = createElement("div", "voice-card-detail-body");
    if (story.publicDetails) {
      detailBody.appendChild(createElement("p", "voice-card-public-details", story.publicDetails));
    }

    if (story.story) {
      const storyBody = createElement("div", "voice-card-full-story");
      appendStoryText(storyBody, story.story);
      detailBody.appendChild(storyBody);
    }

    if (Array.isArray(story.media) && story.media.length) {
      detailBody.appendChild(renderMedia(story.media, story.title || "this story"));
    }

    details.appendChild(detailBody);
    details.addEventListener("toggle", () => {
      if (details.open) loadDetailFrames(details);
      summary.querySelector(".voice-card-summary-mark").textContent = details.open ? "−" : "+";
    });

    function openFromCover() {
      details.open = true;
      loadDetailFrames(details);
      details.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    cover.addEventListener("click", openFromCover);
    cover.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFromCover();
      }
    });

    body.appendChild(details);
    article.appendChild(body);
    return article;
  }

  function renderConnectionFilters(stories) {
    const counts = new Map();

    stories.forEach((story) => {
      const label = connectionLabel(story.connection);
      const key = normalizeText(label);
      const current = counts.get(key) || { label, count: 0 };
      current.count += 1;
      counts.set(key, current);
    });

    const sorted = [...counts.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
      const indexA = CONNECTION_ORDER.indexOf(keyA);
      const indexB = CONNECTION_ORDER.indexOf(keyB);
      if (indexA !== -1 || indexB !== -1) {
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      }
      return valueA.label.localeCompare(valueB.label);
    });

    connectionFilters.replaceChildren();

    const allButton = createElement("button", "voices-filter-button is-active", `All connections (${stories.length})`);
    allButton.type = "button";
    allButton.dataset.connectionFilter = "all";
    allButton.setAttribute("aria-pressed", "true");
    connectionFilters.appendChild(allButton);

    sorted.forEach(([key, value]) => {
      const button = createElement("button", "voices-filter-button", `${value.label} (${value.count})`);
      button.type = "button";
      button.dataset.connectionFilter = key;
      button.setAttribute("aria-pressed", "false");
      connectionFilters.appendChild(button);
    });
  }

  function matchesFilters(story) {
    const queryMatches = !state.query || storySearchText(story).includes(state.query);
    const storyConnection = normalizeText(connectionLabel(story.connection));
    const connectionMatches = state.connection === "all" || storyConnection === state.connection;
    const types = storyTypes(story);
    const mediaMatches = state.media === "all" || types.has(state.media);
    return queryMatches && connectionMatches && mediaMatches;
  }

  function updateActiveButtons(container, dataName, activeValue) {
    const attributeName = dataName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    container.querySelectorAll(`[data-${attributeName}]`).forEach((button) => {
      const active = button.dataset[dataName] === activeValue;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderFilteredStories() {
    const filtered = state.stories.filter(matchesFilters);
    archive.replaceChildren();

    if (!filtered.length) {
      const empty = createElement("div", "voices-no-results");
      empty.appendChild(createElement("h2", "", "No stories match those filters."));
      empty.appendChild(
        createElement("p", "", "Try another search term, connection, or type of story.")
      );
      const reset = createElement("button", "button-link", "Show all stories");
      reset.type = "button";
      reset.addEventListener("click", clearFilters);
      empty.appendChild(reset);
      archive.appendChild(empty);
    } else {
      filtered.forEach((story, index) => archive.appendChild(renderStoryCard(story, index)));
    }

    resultCount.textContent = `${filtered.length} of ${state.stories.length} ${state.stories.length === 1 ? "story" : "stories"}`;
    archive.hidden = false;
  }

  function clearFilters() {
    state.query = "";
    state.connection = "all";
    state.media = "all";
    searchInput.value = "";
    updateActiveButtons(connectionFilters, "connectionFilter", "all");
    updateActiveButtons(mediaFilters, "mediaFilter", "all");
    renderFilteredStories();
  }

  function renderStories(stories) {
    state.stories = stories;

    if (!stories.length) {
      explorer.hidden = true;
      archive.replaceChildren();
      const empty = createElement("div", "empty-state");
      empty.appendChild(createElement("h2", "", "The public story archive is being built."));
      empty.appendChild(
        createElement(
          "p",
          "",
          "Each submission is reviewed by Natalia. Nothing appears here automatically, and private contact information is never published."
        )
      );
      const shareLink = createElement("a", "button-link", "Share your story");
      shareLink.href = "share.html";
      empty.appendChild(shareLink);
      archive.appendChild(empty);
      archive.hidden = false;
      return;
    }

    renderConnectionFilters(stories);
    explorer.hidden = false;
    renderFilteredStories();
  }

  function showError() {
    status.textContent =
      "The approved stories could not be loaded right now. Please refresh the page in a moment.";
    status.classList.add("is-error");
    status.hidden = false;
    explorer.hidden = true;
    archive.hidden = true;
  }

  searchInput.addEventListener("input", () => {
    state.query = normalizeText(searchInput.value);
    renderFilteredStories();
  });

  connectionFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-connection-filter]");
    if (!button) return;
    state.connection = button.dataset.connectionFilter;
    updateActiveButtons(connectionFilters, "connectionFilter", state.connection);
    renderFilteredStories();
  });

  mediaFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-media-filter]");
    if (!button) return;
    state.media = button.dataset.mediaFilter;
    updateActiveButtons(mediaFilters, "mediaFilter", state.media);
    renderFilteredStories();
  });

  clearButton.addEventListener("click", clearFilters);

  function loadStories() {
    status.textContent = "Loading approved stories…";
    status.hidden = false;
    status.classList.remove("is-error");

    const callbackName = `gfnVoicesCallback_${Date.now()}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      showError();
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      script.remove();
      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }
    }

    window[callbackName] = (payload) => {
      cleanup();

      if (!payload || payload.ok !== true || !Array.isArray(payload.stories)) {
        showError();
        return;
      }

      renderStories(payload.stories);
      status.hidden = true;

      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          const details = target.querySelector("details");
          if (details) {
            details.open = true;
            loadDetailFrames(details);
          }
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    script.onerror = () => {
      cleanup();
      showError();
    };

    const query = new URLSearchParams({
      action: "approvedStories",
      callback: callbackName,
      _: String(Date.now()),
    });

    script.src = `${STORIES_ENDPOINT}?${query.toString()}`;
    document.head.appendChild(script);
  }

  loadStories();
})();
