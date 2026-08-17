(() => {
  const menu = document.getElementById("globalSiteMenu");
  const openButton = document.querySelector(".global-menu-button");
  if (!menu || !openButton) return;

  const closeButtons = menu.querySelectorAll("[data-close-menu]");
  const firstLink = menu.querySelector("a");

  function setOpen(open) {
    menu.hidden = !open;
    document.body.classList.toggle("menu-open", open);
    openButton.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      window.setTimeout(() => firstLink?.focus(), 0);
    } else {
      openButton.focus();
    }
  }

  openButton.addEventListener("click", () => setOpen(true));
  closeButtons.forEach((button) => button.addEventListener("click", () => setOpen(false)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) setOpen(false);
  });
})();


(() => {
  const shareButtons = document.querySelectorAll("[data-share-action]");
  if (!shareButtons.length) return;

  function currentShareData() {
    return {
      url: window.location.href,
      title: document.title || "Greetings from Niagara",
    };
  }

  function openShareWindow(url) {
    window.open(
      url,
      "greetingsFromNiagaraShare",
      "noopener,noreferrer,width=760,height=640"
    );
  }

  shareButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.shareAction;
      const { url, title } = currentShareData();

      if (action === "facebook") {
        openShareWindow(
          "https://www.facebook.com/sharer/sharer.php?u=" +
          encodeURIComponent(url)
        );
        return;
      }

      if (action === "x") {
        openShareWindow(
          "https://twitter.com/intent/tweet?text=" +
          encodeURIComponent(title) +
          "&url=" +
          encodeURIComponent(url)
        );
        return;
      }

      if (action === "email") {
        window.location.href =
          "mailto:?subject=" +
          encodeURIComponent(title) +
          "&body=" +
          encodeURIComponent("I wanted to share this page from Greetings from Niagara:\n\n" + url);
        return;
      }

      if (action === "copy") {
        const originalText = button.textContent;
        try {
          await navigator.clipboard.writeText(url);
          button.textContent = "Copied";
        } catch (error) {
          const temporary = document.createElement("textarea");
          temporary.value = url;
          temporary.setAttribute("readonly", "");
          temporary.style.position = "fixed";
          temporary.style.opacity = "0";
          document.body.appendChild(temporary);
          temporary.select();
          document.execCommand("copy");
          temporary.remove();
          button.textContent = "Copied";
        }
        window.setTimeout(() => {
          button.textContent = originalText;
        }, 1600);
      }
    });
  });
})();


// Keep the two Airco locations separate from the Union Carbide group in the
// map's left-side legend. This shared script runs after the map initializes.
(() => {
  if (!document.getElementById("map") || typeof L === "undefined") return;

  const groupName = "Airco";
  const groupColor = "#C9A7E6";
  const aircoTitles = new Set([
    "Union Carbide Airco Witmer Rd",
    "Union Carbide - Airco - Vanadium",
  ]);

  colors[groupName] = groupColor;
  groupLayers[groupName] = L.layerGroup().addTo(map);
  counts[groupName] = 0;

  siteMarkers.forEach((marker) => {
    const properties = marker.featureData?.properties;
    if (!properties || !aircoTitles.has(properties.title)) return;

    const previousGroup = properties.company_group;
    groupLayers[previousGroup]?.removeLayer(marker);
    counts[previousGroup] = Math.max(0, (counts[previousGroup] || 0) - 1);

    properties.company_group = groupName;
    marker.setStyle?.({ fillColor: groupColor });
    marker.setPopupContent(sitePopup(properties));
    groupLayers[groupName].addLayer(marker);
    counts[groupName] += 1;
  });

  const filterBox = document.getElementById("siteFilters");
  if (!filterBox || !counts[groupName]) return;

  filterBox.querySelectorAll("[data-group]").forEach((input) => {
    const count = input.closest(".filter")?.querySelector(".count");
    if (count) count.textContent = counts[input.dataset.group] || 0;
  });

  const label = document.createElement("label");
  label.className = "filter";
  label.innerHTML = `<input type="checkbox" checked data-group="${groupName}"><span><span class="swatch" style="background:${groupColor}"></span>${groupName}</span><span class="count">${counts[groupName]}</span>`;
  filterBox.prepend(label);
})();
