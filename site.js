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
