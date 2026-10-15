(() => {
  const key = "marmullaku-profile-mockup-v1",
    $ = (id) => document.getElementById(id);
  const sections = [
    ["contact", "Contact"],
    ["skills", "Skills"],
    ["languages", "Languages"],
    ["profile", "Profile"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["certificates", "Certificates"],
    ["interests", "Interests"],
  ];
  const initial = {
    name: "Osman Marmullaku",
    role: "Your professional title",
    contact: "Email address\nPortfolio website",
    skills: "Interface design\nWeb development\nCreative technology",
    languages: "Add your languages",
    profile:
      "Introduce yourself in a few sentences. What do you enjoy building, what are you good at, and what would you like to do next?",
    experience:
      "Your latest role or project\nCompany or organisation · Dates\n\nDescribe what you built, your contribution, and the difference it made. Keep it specific and in your own words.",
    education: "Qualification or programme\nInstitution · Dates",
    certificates: "Add a relevant certification",
    interests: "What keeps you curious outside work?",
    fact: "A small detail beyond the résumé.",
    linkLabel: "Portfolio",
    linkURL: "https://example.com",
    buttonLabel: "See my work",
    buttonURL: "https://example.com",
    picture: "../main/pictures/previews/sample-one.svg",
    pictureCaption: "A project in pictures",
  };
  let data = { ...initial },
    activeEditor = null,
    previewing = false,
    extraTypes = ["picture", "fact", "link", "button"];
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && typeof stored === "object")
      for (const field of Object.keys(initial))
        if (typeof stored[field] === "string") data[field] = stored[field];
    if (Array.isArray(stored?.extraTypes))
      extraTypes = [...new Set(stored.extraTypes)].filter((type) =>
        ["picture", "fact", "link", "button"].includes(type),
      );
  } catch {}
  data.name = initial.name;
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(data.picture))
    data.picture = initial.picture;
  const pencil = '<svg aria-hidden="true"><use href="#pencil"/></svg>';
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function sync(field, except) {
    document.querySelectorAll(`[data-value="${field}"]`).forEach((el) => {
      if (el !== except) el.textContent = data[field];
    });
  }
  function save() {
    let message = "Saved in this browser";
    try {
      localStorage.setItem(key, JSON.stringify({ ...data, extraTypes }));
    } catch {
      message = "Updated for this preview · browser storage unavailable";
    }
    $("save-status").textContent = message;
    $("resume-status").textContent = message;
  }
  const sidebar = node("div", undefined, "resume-column"),
    mainColumn = node("div", undefined, "resume-column");
  $("resume-sections").append(sidebar, mainColumn);
  for (const [field, label] of sections) {
    const block = node("section", undefined, "resume-section");
    block.dataset.section = field;
    block.dataset.field = field;
    const heading = node("div", undefined, "section-heading");
    heading.append(node("h3", label));
    const edit = node("button", undefined, "edit");
    edit.dataset.edit = field;
    edit.setAttribute("aria-label", `Edit ${label.toLowerCase()}`);
    edit.innerHTML = pencil;
    heading.append(edit);
    const value = node("p", undefined, "section-copy");
    value.dataset.value = field;
    block.append(heading, value);
    (["contact", "skills", "languages", "interests"].includes(field)
      ? sidebar
      : mainColumn
    ).append(block);
  }
  Object.keys(initial).forEach(sync);
  function finish(keep) {
    if (!activeEditor) return;
    const { field, old, host, value, button, controller, timer } = activeEditor;
    activeEditor = null;
    clearTimeout(timer);
    controller.abort();
    if (!keep) {
      data[field] = old;
      sync(field);
    }
    save();
    value.contentEditable = "false";
    value.removeAttribute("role");
    value.removeAttribute("aria-label");
    value.removeAttribute("aria-multiline");
    button.removeAttribute("aria-pressed");
    host.classList.remove("editing");
    if (document.activeElement === value) button.focus({ preventScroll: true });
    if (!keep)
      $("resume-status").textContent = $("save-status").textContent =
        "Changes cancelled";
  }
  function start(button) {
    if (previewing || button.dataset.edit === "name") return;
    const field = button.dataset.edit,
      host = button.closest("[data-field]"),
      value = host.querySelector(`[data-value="${field}"]`),
      singleLine = [
        "role",
        "linkLabel",
        "buttonLabel",
        "pictureCaption",
      ].includes(field);
    if (activeEditor?.value === value) {
      finish(true);
      return;
    }
    finish(true);
    const controller = new AbortController(),
      options = { signal: controller.signal };
    activeEditor = { field, old: data[field], host, value, button, controller };
    value.contentEditable = "plaintext-only";
    value.setAttribute("role", "textbox");
    value.setAttribute("aria-label", button.getAttribute("aria-label"));
    value.setAttribute("aria-multiline", String(!singleLine));
    button.setAttribute("aria-pressed", "true");
    host.classList.add("editing");
    value.addEventListener(
      "input",
      () => {
        let text = value.innerText.replace(/\r/g, "");
        if (singleLine) text = text.replace(/\n/g, " ");
        data[field] = text.slice(0, singleLine ? 120 : 5000);
        sync(field, value);
        $("save-status").textContent = "Editing…";
        $("resume-status").textContent = "Editing…";
        clearTimeout(activeEditor.timer);
        activeEditor.timer = setTimeout(save, 600);
      },
      options,
    );
    value.addEventListener("blur", () => finish(true), options);
    value.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        } else if (
          e.key === "Enter" &&
          (singleLine || e.ctrlKey || e.metaKey)
        ) {
          e.preventDefault();
          finish(true);
        }
      },
      options,
    );
    value.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(value);
    range.collapse(false);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest("[data-edit]") && activeEditor) e.preventDefault();
  });
  document.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) start(edit);
  });
  function openResume(allowed = null, company = "") {
    finish(true);
    previewing = !!allowed;
    $("resume").classList.toggle("preview-view", previewing);
    $("resume-mode").textContent = previewing
      ? `${company || "Company"}’s view`
      : "Your résumé";
    $("resume-status").textContent = previewing
      ? "Only selected sections are shown"
      : "";
    $("exit-preview").hidden = !previewing;
    document
      .querySelectorAll("[data-section]")
      .forEach(
        (el) =>
          (el.hidden = !!allowed && !allowed.includes(el.dataset.section)),
      );
    $("extras-rail").hidden = !!allowed && !allowed.includes("extras");
    if (!$("resume").open) $("resume").showModal();
  }
  $("resume-open").addEventListener("click", () => openResume());
  $("exit-preview").addEventListener("click", () => openResume());
  $("settings-open").addEventListener("click", (event) => {
    event.preventDefault();
    finish(true);
    $("settings-panel").showModal();
  });
  document.querySelectorAll("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      finish(true);
      $(button.dataset.close).close();
    }),
  );
  for (const id of ["resume", "settings-panel"]) {
    $(id).addEventListener("click", (e) => {
      if (e.target === $(id)) {
        finish(true);
        $(id).close();
      }
    });
    $(id).addEventListener("cancel", () => finish(true));
  }
  const defaults = [
    "profile",
    "experience",
    "education",
    "skills",
    "languages",
    "certificates",
  ];
  function permissions(host, selected, prefix) {
    for (const [field, title] of [
      ...sections,
      ["extras", "Beyond the résumé"],
    ]) {
      const label = node("label", title),
        check = document.createElement("input");
      check.type = "checkbox";
      check.value = field;
      check.checked = selected.includes(field);
      check.setAttribute("aria-label", `${prefix}: ${title}`);
      label.append(check);
      host.append(label);
    }
  }
  permissions($("company-sections"), defaults, "Company access");
  $("standard").addEventListener("click", () => {
    $("company-sections")
      .querySelectorAll("input")
      .forEach((input) => (input.checked = defaults.includes(input.value)));
  });
  const selected = () =>
    [...$("company-sections").querySelectorAll("input:checked")].map(
      (el) => el.value,
    );
  $("preview-company").addEventListener("click", () => {
    $("settings-panel").close();
    openResume(selected(), $("company-name").value.trim());
  });
  $("create-link").addEventListener("click", () => {
    const company = $("company-name").value.trim();
    if (!company) {
      $("company-name").focus();
      $("settings-status").textContent = "Enter a company name first.";
      return;
    }
    const row = node("div", undefined, "link-row"),
      info = node("div");
    info.append(
      node("strong", company),
      node("small", `${selected().length} sections · ${$("expiry").value}`),
    );
    const revoke = node("button", "Revoke", "text-button");
    revoke.addEventListener("click", () => {
      row.remove();
      $("settings-status").textContent = `Demo access for ${company} revoked.`;
    });
    row.append(info, revoke);
    $("company-links").prepend(row);
    $("settings-status").textContent =
      "Demo link created. No real link or access has been issued.";
  });
  for (const name of ["Diellza", "Drilona", "Drenusha", "Dredhza", "Ali"]) {
    const row = node("div", undefined, "sibling-access"),
      line = node("div"),
      select = document.createElement("select");
    select.setAttribute("aria-label", `${name}’s access`);
    for (const choice of ["No access", "Can view", "Can edit"]) {
      const option = node("option", choice);
      select.append(option);
    }
    line.append(node("span", name + " Marmullaku"), select);
    const details = node("details");
    details.hidden = true;
    details.append(node("summary", "Choose sections"));
    const list = node("div", undefined, "permission-list");
    permissions(list, defaults, `${name} access`);
    details.append(list);
    select.addEventListener("change", () => {
      details.hidden = select.selectedIndex === 0;
      $("settings-status").textContent =
        `${name}: ${select.value.toLowerCase()} · mockup only`;
    });
    row.append(line, details);
    $("sibling-permissions").append(row);
  }
  for (const [tab, panel, other, otherPanel] of [
    ["companies-tab", "companies", "family-tab", "family-panel"],
    ["family-tab", "family-panel", "companies-tab", "companies"],
  ]) {
    $(tab).addEventListener("click", () => {
      $(tab).setAttribute("aria-selected", "true");
      $(other).setAttribute("aria-selected", "false");
      $(panel).hidden = false;
      $(otherPanel).hidden = true;
    });
    $(tab).addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        $(other).click();
        $(other).focus();
      }
    });
  }
  function safeURL(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }
  function extraField(host, field, tag, label) {
    host.dataset.field = field;
    const value = node(tag, data[field]);
    value.dataset.value = field;
    const edit = node("button", undefined, "edit");
    edit.dataset.edit = field;
    edit.setAttribute("aria-label", label);
    edit.innerHTML = pencil;
    host.append(value, edit);
    return value;
  }
  function renderExtras() {
    $("extra-blocks").replaceChildren();
    for (const type of extraTypes) {
      const block = node("section", undefined, "extra-block extra-" + type),
        heading = node("div", undefined, "extra-heading");
      heading.append(
        node(
          "h3",
          {
            picture: "In pictures",
            fact: "Fun fact",
            link: "Elsewhere",
            button: "Explore",
          }[type],
        ),
      );
      const remove = node("button", undefined, "extra-remove");
      remove.setAttribute("aria-label", "Remove " + type);
      remove.innerHTML = '<svg aria-hidden="true"><use href="#close"/></svg>';
      remove.addEventListener("click", () => {
        finish(true);
        extraTypes = extraTypes.filter((value) => value !== type);
        save();
        renderExtras();
      });
      heading.append(remove);
      block.append(heading);
      if (type === "picture") {
        const image = node("img");
        image.src = data.picture;
        image.alt = data.pictureCaption;
        const change = node("button", "Change picture", "text-button");
        change.addEventListener("click", () => $("extra-picture").click());
        const caption = node("div", undefined, "extra-field");
        extraField(caption, "pictureCaption", "p", "Edit picture caption");
        block.append(image, caption, change);
      } else if (type === "fact") {
        extraField(block, "fact", "p", "Edit fun fact");
      } else {
        const line = node("div", undefined, "extra-field"),
          link = extraField(
            line,
            type + "Label",
            "a",
            "Edit " + type + " text",
          );
        link.href = safeURL(data[type + "URL"]) || "https://example.com";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (type === "button") link.className = "extra-cta";
        link.addEventListener("click", (e) => {
          if (link.isContentEditable) e.preventDefault();
        });
        const address = node("button", "Edit address", "text-button");
        address.dataset.urlType = type;
        address.addEventListener("click", () => {
          finish(true);
          $("link-form").dataset.type = type;
          $("extra-url").value = data[type + "URL"];
          $("link-error").textContent = "";
          $("link-editor").showPopover();
          $("extra-url").focus();
        });
        block.append(line, address);
      }
      $("extra-blocks").append(block);
    }
    document
      .querySelectorAll("[data-add]")
      .forEach(
        (button) => (button.disabled = extraTypes.includes(button.dataset.add)),
      );
  }
  document.querySelectorAll("[data-add]").forEach((button) =>
    button.addEventListener("click", () => {
      finish(true);
      extraTypes.push(button.dataset.add);
      $("add-extra").open = false;
      save();
      renderExtras();
    }),
  );
  $("extra-picture").addEventListener("change", () => {
    const file = $("extra-picture").files[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      $("resume-status").textContent = "Choose a PNG, JPEG or WebP under 1 MB.";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      data.picture = reader.result;
      save();
      renderExtras();
    });
    reader.addEventListener("error", () => {
      $("resume-status").textContent =
        "Could not read that picture. Try another file.";
    });
    reader.readAsDataURL(file);
  });
  $("link-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const url = safeURL($("extra-url").value);
    if (!url) {
      $("link-error").textContent = "Use an https:// or http:// address.";
      return;
    }
    data[$("link-form").dataset.type + "URL"] = url;
    save();
    renderExtras();
    $("link-editor").hidePopover();
  });
  renderExtras();
})();
