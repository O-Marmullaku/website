import { resolveQuote } from "./picture-anchor.mjs";
import { putPDF, getPDF, deletePDF } from "./pdf-store.mjs";
import { createPDFViewer } from "./pdf-viewer.mjs";

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
    extraTypes = ["picture", "fact", "link", "button"],
    pictureAnchor = null,
    pickingPicture = false,
    pendingDocument = null,
    documents = [],
    documentAccess = true,
    documentURL = null,
    documentGeneration = 0,
    documentTrigger = null;
  let viewerPromise;
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && typeof stored === "object")
      for (const field of Object.keys(initial))
        if (typeof stored[field] === "string") data[field] = stored[field];
    if (Array.isArray(stored?.extraTypes))
      extraTypes = [...new Set(stored.extraTypes)].filter((type) =>
        ["picture", "fact", "link", "button"].includes(type),
      );
    if (sections.some(([field]) => field === stored?.pictureAnchor?.field)) {
      const saved = stored.pictureAnchor;
      pictureAnchor = {
        field: saved.field,
        quote:
          typeof saved.quote === "string" ? saved.quote.slice(0, 5000) : "",
        before: typeof saved.before === "string" ? saved.before.slice(-32) : "",
        after: typeof saved.after === "string" ? saved.after.slice(0, 32) : "",
      };
    }
    if (Array.isArray(stored?.documents))
      documents = stored.documents
        .filter(
          (doc) =>
            typeof doc?.id === "string" &&
            /^[a-f0-9-]{36}$/i.test(doc.id) &&
            typeof doc.name === "string",
        )
        .map((doc) => ({
          id: doc.id,
          name: doc.name.slice(0, 180),
          anchor: sections.some(([field]) => field === doc.anchor?.field)
            ? {
                field: doc.anchor.field,
                quote:
                  typeof doc.anchor.quote === "string"
                    ? doc.anchor.quote.slice(0, 5000)
                    : "",
                before:
                  typeof doc.anchor.before === "string"
                    ? doc.anchor.before.slice(-32)
                    : "",
                after:
                  typeof doc.anchor.after === "string"
                    ? doc.anchor.after.slice(0, 32)
                    : "",
              }
            : null,
        }));
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
    decoratePictureAnchor();
    renderDocumentLinks();
  }
  function save() {
    let message = "Saved in this browser";
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...data, extraTypes, pictureAnchor, documents }),
      );
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
    decoratePictureAnchor();
    renderDocumentLinks();
    if (document.activeElement === value) button.focus({ preventScroll: true });
    if (!keep)
      $("resume-status").textContent = $("save-status").textContent =
        "Changes cancelled";
  }
  function start(button) {
    if (previewing || pickingPicture || button.dataset.edit === "name") return;
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
    value.textContent = data[field];
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
    cancelAttachment();
    previewing = !!allowed;
    documentAccess = !allowed || allowed.includes("documents");
    closeDocument();
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
    decoratePictureAnchor();
    renderDocumentLinks();
    renderDocumentLibrary();
    requestAnimationFrame(alignPicture);
  }
  $("resume-open").addEventListener("click", () => openResume());
  $("exit-preview").addEventListener("click", () => openResume());
  for (const id of ["settings-open", "settings-icon-open"])
    $(id).addEventListener("click", (event) => {
      event.preventDefault();
      finish(true);
      $("settings-panel").showModal();
    });
  document.querySelectorAll("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      finish(true);
      cancelAttachment();
      closeDocument();
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
      ["documents", "Supporting documents"],
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
  function sectionName(field) {
    return sections.find(([key]) => key === field)?.[1] || "";
  }
  function pictureTarget() {
    if (!pictureAnchor) return null;
    return (
      document.querySelector(".picture-anchor") ||
      document.querySelector(`[data-section="${pictureAnchor.field}"] h3`)
    );
  }
  function showPicture() {
    const block = document.querySelector(".extra-picture");
    if (!block) return;
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.classList.remove("attachment-focus");
    requestAnimationFrame(() => block.classList.add("attachment-focus"));
  }
  function decoratePictureAnchor() {
    document.querySelectorAll(".picture-pin").forEach((el) => el.remove());
    document
      .querySelectorAll(".picture-anchor")
      .forEach((el) => el.replaceWith(document.createTextNode(el.textContent)));
    if (
      !pictureAnchor ||
      !extraTypes.includes("picture") ||
      activeEditor?.field === pictureAnchor.field
    ) {
      requestAnimationFrame(alignPicture);
      return;
    }
    if (previewing && $("extras-rail").hidden) return;
    const section = document.querySelector(
        `[data-section="${pictureAnchor.field}"]`,
      ),
      value = section?.querySelector("[data-value]");
    if (!value || section.hidden) return;
    const text = data[pictureAnchor.field],
      start = resolveQuote(text, pictureAnchor);
    if (start >= 0) {
      const mark = node("mark", pictureAnchor.quote, "picture-anchor");
      mark.tabIndex = 0;
      mark.setAttribute("role", "button");
      mark.setAttribute("aria-label", `Show picture: ${pictureAnchor.quote}`);
      mark.addEventListener("click", showPicture);
      mark.addEventListener("keydown", (event) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          showPicture();
        }
      });
      value.replaceChildren(
        document.createTextNode(text.slice(0, start)),
        mark,
        document.createTextNode(text.slice(start + pictureAnchor.quote.length)),
      );
    } else {
      const pin = node("button", undefined, "picture-pin");
      pin.setAttribute(
        "aria-label",
        `Show picture attached to ${sectionName(pictureAnchor.field)}`,
      );
      pin.innerHTML =
        '<svg aria-hidden="true"><use href="#picture-icon"/></svg>';
      pin.addEventListener("click", showPicture);
      section.querySelector("h3").append(pin);
    }
    const label = document.querySelector(".picture-anchor-label");
    if (label) {
      label.textContent =
        sectionName(pictureAnchor.field) +
        (start >= 0 ? " · “" + pictureAnchor.quote.slice(0, 48) + "”" : "");
      label.title =
        pictureAnchor.quote && start < 0
          ? "The linked words changed. The picture remains attached to this section."
          : "Find attached text";
    }
    requestAnimationFrame(alignPicture);
  }
  function alignPicture() {
    const block = document.querySelector(".extra-picture"),
      target = pictureTarget();
    if (!block) {
      $("extras-rail").classList.remove("has-attachment");
      return;
    }
    block.style.paddingTop = "";
    $("extras-rail").classList.toggle("has-attachment", !!target);
    if (!target || innerWidth <= 1000 || $("extras-rail").hidden) return;
    block.style.paddingTop =
      Math.max(
        0,
        target.getBoundingClientRect().top -
          block.querySelector("img").getBoundingClientRect().top,
      ) + "px";
  }
  function cancelAttachment() {
    pickingPicture = false;
    pendingDocument = null;
    $("resume").classList.remove("picking-picture");
    $("cancel-attachment").hidden = true;
    document.querySelectorAll(".paper [data-section]").forEach((section) => {
      section.removeAttribute("tabindex");
      section.removeAttribute("role");
      section.removeAttribute("aria-label");
    });
  }
  function pickAttachment(documentId = null) {
    finish(true);
    cancelAttachment();
    pendingDocument = typeof documentId === "string" ? documentId : null;
    // Flatten edited paragraphs before measuring a text selection.
    sections.forEach(([field]) => sync(field));
    pickingPicture = true;
    $("resume").classList.add("picking-picture");
    $("cancel-attachment").hidden = false;
    document.querySelectorAll(".paper [data-section]").forEach((section) => {
      section.tabIndex = 0;
      section.setAttribute("role", "button");
      section.setAttribute(
        "aria-label",
        `Attach ${pendingDocument ? "document" : "picture"} to ${sectionName(section.dataset.section)}`,
      );
    });
    $("resume-status").textContent =
      `Click a section, or highlight the words to attach this ${pendingDocument ? "document" : "picture"} to.`;
  }
  $("cancel-attachment").addEventListener("click", () => {
    cancelAttachment();
    $("resume-status").textContent = "Attachment unchanged";
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (pickingPicture && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelAttachment();
        $("resume-status").textContent = "Attachment unchanged";
      } else if (
        pickingPicture &&
        event.key === "Enter" &&
        event.target.matches(".paper [data-section]")
      ) {
        event.preventDefault();
        attachToSection(event.target.dataset.section);
      }
    },
    true,
  );
  function attachToSection(field, quote = "", before = "", after = "") {
    const doc = documents.find((doc) => doc.id === pendingDocument);
    if (doc) doc.anchor = { field, quote, before, after };
    else pictureAnchor = { field, quote, before, after };
    cancelAttachment();
    getSelection()?.removeAllRanges();
    save();
    renderExtras();
    $("resume-status").textContent =
      `${doc ? "Document" : "Picture"} attached to ${sectionName(field)}`;
  }
  document.addEventListener("pointerup", (event) => {
    if (!pickingPicture || event.target.closest("button,a")) return;
    const section = event.target.closest(".paper [data-section]");
    if (!section) return;
    const field = section.dataset.section,
      value = section.querySelector("[data-value]"),
      selection = getSelection();
    let quote = "",
      before = "",
      after = "";
    if (selection?.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (
        !value.contains(range.startContainer) ||
        !value.contains(range.endContainer)
      ) {
        $("resume-status").textContent =
          "Highlight words within a single section.";
        return;
      }
      quote = range.toString();
      const prefix = range.cloneRange();
      prefix.selectNodeContents(value);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length,
        text = data[field];
      if (!text.includes(quote)) {
        $("resume-status").textContent = "Choose the words again.";
        return;
      }
      before = text.slice(Math.max(0, start - 32), start);
      after = text.slice(start + quote.length, start + quote.length + 32);
    }
    attachToSection(field, quote, before, after);
  });
  addEventListener("resize", alignPicture);
  document.fonts.ready.then(alignPicture);
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
        if (type === "picture") pictureAnchor = null;
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
        const attachment = node("div", undefined, "picture-attachment");
        if (pictureAnchor) {
          const label = node(
            "button",
            sectionName(pictureAnchor.field),
            "text-button picture-anchor-label",
          );
          label.addEventListener("click", () =>
            pictureTarget()?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            }),
          );
          attachment.append(label);
        }
        const attach = node(
          "button",
          pictureAnchor ? "Reattach" : "Attach to résumé",
          "text-button",
        );
        attach.addEventListener("click", pickAttachment);
        attachment.append(attach);
        if (pictureAnchor) {
          const detach = node("button", "Detach", "text-button");
          detach.addEventListener("click", () => {
            pictureAnchor = null;
            cancelAttachment();
            save();
            renderExtras();
          });
          attachment.append(detach);
        }
        block.append(image, caption, change, attachment);
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
    decoratePictureAnchor();
    renderDocumentLibrary();
    renderDocumentLinks();
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
  function documentVisible(doc) {
    return (
      !previewing ||
      (documentAccess &&
        doc.anchor &&
        !document.querySelector(`[data-section="${doc.anchor.field}"]`)?.hidden)
    );
  }
  function renderDocumentLinks() {
    document.querySelectorAll(".document-attachment").forEach((item) => {
      const doc = documents.find((doc) => doc.id === item.dataset.documentId);
      if (
        !doc?.anchor ||
        !documentVisible(doc) ||
        item.closest("[data-section]").dataset.section !== doc.anchor.field
      )
        item.remove();
    });
    for (const doc of documents) {
      if (!doc.anchor || !documentVisible(doc)) continue;
      const section = document.querySelector(
        `[data-section="${doc.anchor.field}"]`,
      );
      if (!section) continue;
      let links = section.querySelector(".document-attachments");
      if (!links) {
        links = node("div", undefined, "document-attachments");
        section.append(links);
      }
      let item = links.querySelector(`[data-document-id="${doc.id}"]`);
      if (!item) {
        item = node("div", undefined, "document-attachment");
        item.dataset.documentId = doc.id;
        const button = node("button", undefined, "document-link");
        button.innerHTML =
          '<svg aria-hidden="true"><use href="#pdf-icon"/></svg>';
        button.append(node("span", doc.name));
        button.addEventListener("click", () => openDocument(doc.id, button));
        item.append(button);
        links.append(item);
      }
      item.querySelector(".document-context")?.remove();
      if (resolveQuote(data[doc.anchor.field], doc.anchor) >= 0)
        item.append(
          node(
            "small",
            "“" + doc.anchor.quote.slice(0, 90) + "”",
            "document-context",
          ),
        );
    }
    document
      .querySelectorAll(".document-attachments:empty")
      .forEach((el) => el.remove());
  }
  function renderDocumentLibrary() {
    $("pdf-list").replaceChildren();
    document.querySelector(".pdf-library").hidden =
      previewing && !documentAccess;
    for (const doc of documents.filter(documentVisible)) {
      const item = node("div", undefined, "pdf-item"),
        open = node("button", doc.name, "text-button pdf-name");
      open.addEventListener("click", () => openDocument(doc.id, open));
      item.append(
        open,
        node(
          "small",
          doc.anchor ? sectionName(doc.anchor.field) : "Choose a section",
        ),
      );
      const actions = node(
          "div",
          undefined,
          "pdf-item-actions document-owner-action",
        ),
        attach = node(
          "button",
          doc.anchor ? "Reattach" : "Attach to résumé",
          "text-button",
        ),
        remove = node("button", "Remove", "text-button");
      attach.addEventListener("click", () => {
        closeDocument();
        pickAttachment(doc.id);
      });
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try {
          await deletePDF(doc.id);
          documents = documents.filter((value) => value.id !== doc.id);
          closeDocument();
          save();
          renderDocumentLibrary();
          renderDocumentLinks();
        } catch (error) {
          $("resume-status").textContent = error.message;
          remove.disabled = false;
        }
      });
      actions.append(attach, remove);
      item.append(actions);
      $("pdf-list").append(item);
    }
  }
  function closeDocument(restoreFocus = false) {
    documentGeneration++;
    $("document-reader").hidden = true;
    document
      .querySelector(".resume-workspace")
      .classList.remove("document-open");
    viewerPromise?.then((viewer) => viewer.close());
    $("document-new-tab").removeAttribute("href");
    if (documentURL) URL.revokeObjectURL(documentURL);
    documentURL = null;
    if (restoreFocus && documentTrigger?.isConnected)
      documentTrigger.focus({ preventScroll: true });
    documentTrigger = null;
    requestAnimationFrame(alignPicture);
  }
  async function openDocument(id, trigger) {
    const doc = documents.find((doc) => doc.id === id);
    if (!doc || !documentVisible(doc)) return;
    finish(true);
    cancelAttachment();
    closeDocument();
    documentTrigger = trigger;
    const generation = ++documentGeneration;
    $("document-title").textContent = doc.name;
    $("document-status").textContent = "Opening PDF…";
    $("document-new-tab").hidden = true;
    $("document-reader").hidden = false;
    document.querySelector(".resume-workspace").classList.add("document-open");
    $("close-document").focus({ preventScroll: true });
    try {
      const file = await getPDF(id);
      if (generation !== documentGeneration) return;
      if (!file)
        throw new Error(
          "This PDF is unavailable in this browser. Add it again.",
        );
      documentURL = URL.createObjectURL(file);
      $("document-new-tab").href = documentURL;
      $("document-new-tab").hidden = false;
      viewerPromise ||= createPDFViewer($("document-reader"));
      const viewer = await viewerPromise;
      if (generation !== documentGeneration) return;
      await viewer.open(file);
    } catch (error) {
      if (generation === documentGeneration)
        $("document-status").textContent = error.message;
    }
  }
  $("close-document").addEventListener("click", () => closeDocument(true));
  $("resume").addEventListener("cancel", (event) => {
    if (!$("document-reader").hidden) {
      event.preventDefault();
      closeDocument(true);
    }
  });
  $("resume").addEventListener("close", () => {
    cancelAttachment();
    closeDocument();
  });
  for (const id of ["add-pdf", "add-pdf-shortcut"])
    $(id).addEventListener("click", () => {
      $("add-extra").open = false;
      $("pdf-file").click();
    });
  $("pdf-file").addEventListener("change", async () => {
    const file = $("pdf-file").files[0];
    if (!file) return;
    $("resume-status").textContent = "Adding PDF…";
    try {
      const id = await putPDF(file);
      documents.push({ id, name: file.name.slice(0, 180), anchor: null });
      save();
      renderDocumentLibrary();
      pickAttachment(id);
    } catch (error) {
      $("resume-status").textContent = error.message;
    } finally {
      $("pdf-file").value = "";
    }
  });
  renderExtras();
})();
