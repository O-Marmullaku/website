import {setupCVAppearance} from './cv-appearance.mjs?v=appearance-panel';
import {setupExtrasRail,libraryDocuments} from '../main/cv-extras-rail.mjs?v=links-documents';
import {setupCVPagination} from './cv-pagination.mjs?v=reading-position-1';
import {setupImageMagnifier} from './image-magnifier.mjs?v=pdf-workspace-2';
import {setupDocumentHints} from './document-hints.mjs?v=cleanup';
import {setupExperienceProjects} from './experience-projects.mjs?v=experience-projects-2';
import { resolveQuote } from "./picture-anchor.mjs";
import { createPDFViewer } from "./pdf-viewer.mjs?v=reader-sheet-1";
import { normalizeRows, rowLayouts, rowText } from "./cv-rows.mjs?v=accounts-2";
import { createRowEditor } from "./cv-row-editor.mjs?v=reference-layout";

(async () => {
  const adapter = await (await import('../main/profile-adapter.mjs?v=parallel-media-1')).createLiveAdapter();
  const $ = (id) => document.getElementById(id);
  setupDocumentHints($('resume'));
  let experienceProjects;
  const sections = [
    ["contact", "Contact"],
    ["skills", "Skills"],
    ["languages", "Languages"],
    ["profile", "Profile"],
    ["experience", "Professional Experience"],
    ["education", "Education"],
    ["certificates", "Certificates"],
    ["interests", "Interests / Hobbies"],
  ];
  const initial = {
    name: "Osman Marmullaku",
    role: "Job title",
    theme: "navy",
    typography: "classic",
    entryStyle: "plain",
    contact: "Email address\nPortfolio website",
    skills: "Interface design\nWeb development\nCreative technology",
    languages: "Add your languages",
    profile: "Write a short introduction and what you want to do next.",
    experience:
      "Your latest role or project\nCompany or organisation · Dates\n\nDescribe your work and what you achieved.",
    education: "Qualification or programme\nInstitution · Dates",
    certificates: "Add a relevant certification",
    interests: "Add your interests",
    fact: "Something about you.",
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
  let sharing,pagination;
  let viewerPromise,
    cvRows,
    rowEditor,
    uploadAnchor = null;
  try {
    const stored = adapter.state;
    cvRows = stored?.cvRows;
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
        rowId:
          typeof saved.rowId === "string" &&
          /^[a-f0-9-]{36}$/i.test(saved.rowId)
            ? saved.rowId
            : null,
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
                rowId:
                  typeof doc.anchor.rowId === "string" &&
                  /^[a-f0-9-]{36}$/i.test(doc.anchor.rowId)
                    ? doc.anchor.rowId
                    : null,
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
  const oldIntroduction =
    "Introduce yourself in a few sentences. What do you enjoy building, what are you good at, and what would you like to do next?";
  const oldDescription =
    "Describe what you built, your contribution, and the difference it made. Keep it specific and in your own words.";
  if (data.profile === oldIntroduction) data.profile = initial.profile;
  if (data.role === "Your professional title") data.role = initial.role;
  if (
    data.fact === "One detail that makes this profile yours." ||
    data.fact === "A small detail beyond the résumé."
  )
    data.fact = "Add a fun fact";
  cvRows = normalizeRows(cvRows, data);
  for (const row of cvRows.experience)
    if (row.body.trim() === oldDescription)
      row.body = "Describe your work and what you achieved.";
  for (const row of cvRows.interests)
    if (row.title === "What keeps you curious outside work?")
      row.title = initial.interests;
  let rowIdentity = Object.values(cvRows)
    .flat()
    .map((row) => row.id)
    .join(",");
  for (const field of Object.keys(rowLayouts))
    data[field] = rowText(cvRows[field]);
  const pencil = '<svg aria-hidden="true"><use href="#pencil"/></svg>';
  function node(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function sync(field, except) {
    if(field==='entryStyle'){document.documentElement.dataset.cvEntries=data.entryStyle==='timeline'?'timeline':'plain';return;}
    if(field==='typography'){document.documentElement.dataset.cvTypography=data.typography==='compact'?'compact':'classic';return;}
    if(field==='theme'){document.documentElement.dataset.cvTheme=['navy','blue-gray','charcoal','forest','burgundy'].includes(data.theme)?data.theme:'navy';return;}

    document.querySelectorAll(`[data-value="${field}"]`).forEach((el) => {
      if (el !== except) {
        if(field==='name'&&el.id==='resume-name'){
          const [first,...rest]=data.name.split(' ');el.replaceChildren(node('span',first,'cv-first-name'),document.createTextNode(' '),node('span',rest.join(' '),'cv-last-name'));
        }else el.textContent = data[field];
      }
    });
    decoratePictureAnchor();
    renderDocumentLinks();
  }
  function save() {
    pagination?.schedule();
    adapter.save({...data,extraTypes,pictureAnchor,documents,cvRows});
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
    if(!rowLayouts[field]){edit.classList.add("cv-copy-edit");block.append(edit);}
    const value = node("p", undefined, "section-copy");
    value.dataset.value = field;
    block.append(heading, value);
    (["contact", "languages", "certificates"].includes(field)
      ? sidebar
      : mainColumn
    ).append(block);
  }
  const portrait = document.querySelector(".paper-header > img");
  portrait.className = "cv-portrait";
  sidebar.prepend(portrait);
  mainColumn.prepend(document.querySelector(".paper-header"));
  for (const field of ['contact','languages','certificates'])
    sidebar.append(document.querySelector(`[data-section="${field}"]`));
  for (const field of ['profile','education','experience','skills','interests'])
    mainColumn.append(document.querySelector(`[data-section="${field}"]`));
  rowEditor = createRowEditor({
    rows: cvRows,
    onChange(rows) {
      cvRows = rows;
      const identity = Object.values(rows)
        .flat()
        .map((row) => row.id)
        .join(",");
      const structureChanged = identity !== rowIdentity;
      rowIdentity = identity;
      for (const field of Object.keys(rowLayouts))
        data[field] = rowText(rows[field]);
      save();
      decoratePictureAnchor();
      renderDocumentLinks();
      if (structureChanged) renderDocumentLibrary();
    },
    beforeEdit: () => finish(true),
    isReadOnly: () => previewing || pickingPicture,
    beforeRender: () => pagination?.restore(),
    attachPDF(field, rowId) {
      finish(true);
      uploadAnchor = { field, rowId, quote: "", before: "", after: "" };
      $("pdf-file").click();
    },
  });
  experienceProjects=setupExperienceProjects($('resume'));
  Object.keys(initial).forEach(sync);
  function finish(keep) {
    rowEditor?.finish(keep);
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
    if (rowLayouts[button.dataset.edit]) {
      rowEditor.editFirst(button.dataset.edit);
      return;
    }
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
    else if(!previewing){
      const value=e.target.closest('#resume .section-copy[data-value],#resume .paper-header [data-value="role"]');
      if(value&&!value.isContentEditable){const button=value.closest('[data-field]')?.querySelector('[data-edit]');if(button)start(button);}
    }
  });
  function openResume(allowed = null) {
    pagination?.restore();
    finish(true);
    cancelAttachment();
    previewing = !!allowed;
    documentAccess = !allowed || allowed.includes("documents");
    closeDocument();
    $("resume").classList.toggle("preview-view", previewing);
    rowEditor.syncMode();
    document.querySelectorAll('[data-cv-view]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.cvView==='preview')===previewing)));
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
    extrasRail?.sync();
    requestAnimationFrame(alignPicture);
    pagination?.layout();
  }
  let closing=false;
  const pendingUploads=new Set();
  window.flushProfile=async()=>{
    finish(true);cancelAttachment();
    const dialogs=[$('resume'),$('settings-panel')];
    dialogs.forEach(dialog=>{dialog.inert=true;});
    try {await Promise.all(pendingUploads);return await adapter.settle();}
    catch(error){$('resume-status').textContent=$('settings-status').textContent=error.message;throw error;}
    finally{dialogs.forEach(dialog=>{dialog.inert=false;});}
  };
  async function closeDialog(id) {
    if(closing)return;closing=true;
    finish(true);cancelAttachment();
    try {
      if(!(id==='settings-panel'&&$('resume').open))parent.postMessage({type:'marmullaku-close'},location.origin);
      else {await $(id).animate([{opacity:1},{opacity:0,transform:'translateY(8px)'}],{duration:180}).finished;$(id).close();}
    } catch(error){$('resume-status').textContent=$('settings-status').textContent=error.message;}
    finally{closing=false;}
  }
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.dataset.close)));
  for(const id of ['resume','settings-panel']) {
    $(id).addEventListener('click',event=>{if(event.target===$(id))closeDialog(id);});
    $(id).addEventListener('cancel',event=>{
      event.preventDefault();
      if(id==='resume'&&!$('document-reader').hidden){
        if($('document-reader').classList.contains('is-maximized')&&innerWidth>680)setDocumentMaximized(false);
        else closeDocument(true);
      }else closeDialog(id);
    });
    $(id).addEventListener('close',()=>{
      if($(id).open||(id==='settings-panel'&&$('resume').open))return;
      // Repeated Escape can force a native close; keep the draft visible until settled.
      $(id).showModal();closeDialog(id);
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
      (pictureAnchor.rowId &&
        document.querySelector(`[data-row-id="${pictureAnchor.rowId}"]`)) ||
      document.querySelector(`[data-section="${pictureAnchor.field}"] h3`)
    );
  }
  function showPicture() {
    extrasRail?.open();
    sharing?.track("picture", "Viewed photo: " + data.pictureCaption);
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
    );
    if (!section || section.hidden) return;
    const anchorHost =
      (pictureAnchor.rowId &&
        section.querySelector(`[data-row-id="${pictureAnchor.rowId}"]`)) ||
      section;
    const candidates = [
      ...anchorHost.querySelectorAll("[data-row-text],[data-value]"),
    ];
    const matched = candidates.filter(
      (el) =>
        !el.isContentEditable &&
        resolveQuote(el.textContent, pictureAnchor) >= 0,
    );
    const value = matched.length === 1 ? matched[0] : null;
    const text = value?.textContent || "",
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
      (
        anchorHost.querySelector(".cv-cell-title") ||
        section.querySelector("h3")
      ).append(pin);
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
  let extrasRail;
  function alignPicture() {
    const block=document.querySelector('.extra-picture');
    if(!block)return;
    block.style.paddingTop='';block.style.marginTop='';
    $('extras-rail').classList.remove('has-attachment');
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
  function attachToSection(
    field,
    quote = "",
    before = "",
    after = "",
    rowId = null,
  ) {
    const doc = documents.find((doc) => doc.id === pendingDocument);
    if (doc) doc.anchor = { field, quote, before, after, rowId };
    else pictureAnchor = { field, quote, before, after, rowId };
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
      selection = getSelection(),
      row = event.target.closest("[data-row-id]");
    const selectionNode = selection?.anchorNode;
    const value =
      (selectionNode?.nodeType === Node.ELEMENT_NODE
        ? selectionNode
        : selectionNode?.parentElement
      )?.closest("[data-row-text],[data-value]") ||
      section.querySelector("[data-value]");
    let quote = "",
      before = "",
      after = "";
    if (selection?.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      if (
        !value ||
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
        text = value.textContent;
      if (!text.includes(quote)) {
        $("resume-status").textContent = "Choose the words again.";
        return;
      }
      before = text.slice(Math.max(0, start - 32), start);
      after = text.slice(start + quote.length, start + quote.length + 32);
    }
    attachToSection(field, quote, before, after, row?.dataset.rowId || null);
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
            picture: "Photos",
            fact: "Fun fact",
            link: "Links",
            button: "Button",
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
        if(data.picture) image.src = data.picture;else image.hidden=true;
        image.alt = data.pictureCaption;
        image.addEventListener('error',()=>{
          image.hidden=true;
          if(!adapter.editable)block.remove();
          else {change.textContent='Choose another picture';block.prepend(node('p','Picture unavailable.','picture-unavailable'));}
        },{once:true});
        const change = node("button", data.picture ? "Change picture" : "Add picture", "text-button");
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
          pictureAnchor ? "Reattach" : "Attach to CV",
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
        image.addEventListener('click',()=>sharing?.track('picture'));
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
        const addressURL=safeURL(data[type + 'URL']);
        if(addressURL) link.href=addressURL;
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
  $('cancel-link')?.addEventListener('click',()=>{ $('link-editor').hidePopover();document.querySelector(`[data-url-type="${$('link-form').dataset.type}"]`)?.focus({preventScroll:true}); });
  function documentVisible() {return !previewing || documentAccess;}
  function renderDocumentLinks() {
    document.querySelectorAll(".document-attachment").forEach((item) => {
      const doc = documents.find((doc) => doc.id === item.dataset.documentId);
      const expectedRow =
        doc?.anchor?.rowId &&
        document.querySelector(`[data-row-id="${doc.anchor.rowId}"]`);
      if (
        !doc?.anchor ||
        !documentVisible(doc) ||
        item.closest("[data-section]").dataset.section !== doc.anchor.field ||
        (item.closest("[data-row-id]") || null) !== (expectedRow || null)
      )
        item.remove();
    });
    for (const doc of documents) {
      if (!doc.anchor || !documentVisible(doc)) continue;
      const section = document.querySelector(
        `[data-section="${doc.anchor.field}"]`,
      );
      if (!section) continue;
      const row =
        doc.anchor.rowId &&
        document.querySelector(`[data-row-id="${doc.anchor.rowId}"]`);
      if (doc.anchor.rowId && !row) continue;
      const host = row || section;
      let links = host.querySelector(":scope > .document-attachments");
      if (!links) {
        links = node("div", undefined, "document-attachments");
        host.append(links);
      }
      let item = links.querySelector(`[data-document-id="${doc.id}"]`);
      if (!item) {
        item = node("div", undefined, "document-attachment");
        item.dataset.documentId = doc.id;
        const button = node("button", undefined, "document-link");
        button.setAttribute('aria-label',`Open ${doc.name}`);
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
    document.querySelectorAll('.cv-row').forEach(row=>{
      row.classList.toggle('cv-document-card',!!row.querySelector(':scope > .document-attachments .document-link'));
    });
    experienceProjects?.sync();
  }
  $('resume').addEventListener('click',event=>{
    const row=event.target.closest('.cv-document-card');
    if(!row||pickingPicture||event.defaultPrevented||event.target.closest('button,a,summary,input,select,textarea,[contenteditable="plaintext-only"]'))return;
    if(!previewing&&event.target.closest('.cv-row-text'))return;
    if(getSelection()?.toString())return;
    row.querySelector('.document-link')?.click();
  });
  function renderDocumentLibrary() {
    $("pdf-list").replaceChildren();
    const attachedIDs=new Set([...document.querySelectorAll('#resume .paper .document-attachment')].filter(item=>!item.closest('[data-section]')?.hidden).map(item=>item.dataset.documentId));
    const library=libraryDocuments(documents.filter(documentVisible),attachedIDs,previewing);
    document.querySelector(".pdf-library").hidden =
      previewing && (!documentAccess || !library.length);
    for (const doc of library) {
      const item = node("div", undefined, "pdf-item"),
        open = node("button", doc.name, "text-button pdf-name");
      const icon=node('span',undefined,'pdf-file-icon');icon.innerHTML='<svg aria-hidden="true"><use href="#pdf-icon"/></svg>';open.prepend(icon);
      open.addEventListener("click", () => openDocument(doc.id, open));
      item.append(
        open,
        node(
          "small",
          doc.anchor?.rowId &&
            !document.querySelector(`[data-row-id="${doc.anchor.rowId}"]`)
            ? "Reattach to a row"
            : doc.anchor
              ? sectionName(doc.anchor.field)
              : "Choose a section",
        ),
      );
      const actions = node(
          "div",
          undefined,
          "pdf-item-actions document-owner-action",
        ),
        attach = node(
          "button",
          doc.anchor ? "Reattach" : "Attach to CV",
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
          const previous=documents;
          documents = documents.filter((value) => value.id !== doc.id);
          save();
          try {await adapter.flush();}
          catch(error){documents=previous;save();throw error;}
          try {await adapter.deletePDF(doc.id);}
          catch {$("resume-status").textContent='Removed from CV. The stored file could not be removed.';}
          closeDocument();
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
  let documentExit,documentEntry,documentScrollTop=0;
  function setDocumentOpen(open){
    document.querySelector('.resume-workspace').classList.toggle('document-open',open);
    document.querySelector('.resume-toolbar').inert=open;
  }
  function setDocumentMaximized(maximized){
    const reader=$('document-reader'),button=$('document-maximize');
    reader.classList.toggle('is-maximized',maximized);
    button.title=maximized?'Restore PDF size':'Maximize PDF';
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(maximized));
    reader.setAttribute('role',maximized?'dialog':'complementary');
    if(maximized)reader.setAttribute('aria-modal','true');else reader.removeAttribute('aria-modal');
    for(const sibling of reader.parentElement.children)if(sibling!==reader)sibling.inert=maximized;
    document.querySelector('.resume-toolbar').inert=maximized||!reader.hidden;
  }
  $('document-maximize').addEventListener('click',()=>setDocumentMaximized(!$('document-reader').classList.contains('is-maximized')));
  $('document-reader').addEventListener('keydown',event=>{
    if(event.key!=='Tab'||!event.currentTarget.classList.contains('is-maximized'))return;
    const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(control=>control.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&event.target===first||!event.shiftKey&&event.target===last){
      event.preventDefault();
      (event.shiftKey?last:first)?.focus({preventScroll:true});
    }
  });
  function closeDocument(restoreFocus = false) {
    const reader = $("document-reader"),style=getComputedStyle(reader);
    const wasOpen=!reader.hidden;
    const current={opacity:style.opacity,transform:style.transform};
    documentEntry?.cancel();documentEntry=null;
    documentExit?.cancel();
    documentExit = null;
    const generation = ++documentGeneration;
    const cleanup = () => {
      if (generation !== documentGeneration) return;
      reader.hidden = true;
      reader.inert = false;
      setDocumentMaximized(false);
      documentExit?.cancel();
      documentExit = null;
      setDocumentOpen(false);
      viewerPromise?.then((viewer) => viewer.close());
      $("document-download").removeAttribute("href");
      $("document-download").hidden = true;
      $('document-save').removeAttribute('href');$('document-save').hidden=true;
      if (documentURL) URL.revokeObjectURL(documentURL);
      documentURL = null;
      if(restoreFocus&&documentTrigger?.closest('#extras-rail'))extrasRail?.open();
      if(restoreFocus&&documentTrigger?.isConnected)documentTrigger.focus({preventScroll:true});
      if(wasOpen)$('resume').scrollTop=documentScrollTop;
      documentTrigger = null;
      requestAnimationFrame(alignPicture);
    };
    if (restoreFocus && !reader.hidden) {
      reader.inert = true;
      documentExit = reader.animate([
        {opacity:current.opacity,transform:current.transform},
        {opacity:0,transform:'translateX(18px)'}
      ],{duration:220,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
      documentExit.finished.catch(()=>{}).then(cleanup);
    } else cleanup();
  }
  async function openDocument(id, trigger) {
    const doc = documents.find((doc) => doc.id === id);
    if (!doc || !documentVisible(doc)) return;
    finish(true);
    cancelAttachment();
    if($('extras-rail').matches(':popover-open'))$('extras-rail').hidePopover();
    closeDocument();
    documentTrigger = trigger;
    documentScrollTop=$('resume').scrollTop;
    const generation = ++documentGeneration;
    $("document-title").textContent = doc.name;
    $("document-title").title = doc.name;
    $("document-status").textContent = "Opening PDF…";
    $("document-download").hidden = true;
    $("document-reader").hidden = false;
    setDocumentOpen(true);
    documentEntry=$('document-reader').animate([{opacity:0,transform:'translateX(32px) scale(.985)'},{opacity:1,transform:'none'}],{duration:400,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
    documentEntry.finished.catch(()=>{});
    $("close-document").focus({ preventScroll: true });
    try {
      const file = await adapter.getPDF(id);
      if (generation !== documentGeneration) return;
      if (!file)
        throw new Error(
          "This PDF is unavailable. Add it again.",
        );
      documentURL = URL.createObjectURL(file);
      $("document-download").href = documentURL;
      $("document-download").download = doc.name.replace(/\.pdf$/i,'')+'.pdf';
      $('document-save').href=documentURL;$('document-save').download=$('document-download').download;$('document-save').hidden=false;
      sharing?.track("document", "Opened PDF: " + doc.name);
      viewerPromise ||= createPDFViewer($("document-reader"));
      const viewer = await viewerPromise;
      if (generation !== documentGeneration) return;
      try {await viewer.open(file);}
      catch(error){throw new Error(error.name==='PasswordException'?'This PDF needs a password. Download it to open in a PDF app.':'Could not display this PDF. Download it to open in a PDF app.');}
    } catch (error) {
      if (generation === documentGeneration){
        $("document-status").textContent = error.message;
        $('document-download').hidden=!documentURL;
      }
    }
  }
  $("close-document").addEventListener("click", () => closeDocument(true));
  $("resume").addEventListener("close", () => {
    cancelAttachment();
    closeDocument();
  });
  for (const id of ["add-pdf", "add-pdf-shortcut"])
    $(id).addEventListener("click", () => {
      uploadAnchor = null;
      $("add-extra").open = false;
      $("pdf-file").click();
    });
  $("pdf-file").addEventListener("change", () => {
    const file = $("pdf-file").files[0];
    if (!file) return;
    const anchor = uploadAnchor;
    uploadAnchor = null;
    $("resume-status").textContent = "Adding PDF…";
    const uploading=(async()=>{
    try {
      const id = await adapter.putPDF(file);
      documents.push({ id, name: file.name.slice(0, 180), anchor });
      save();
      renderDocumentLibrary();
      if (anchor) {
        renderDocumentLinks();
        $("resume-status").textContent = "Document attached to this row";
      } else pickAttachment(id);
    } catch (error) {
      $("resume-status").textContent = error.message;
    } finally {
      $("pdf-file").value = "";
    }
    })();
    pendingUploads.add(uploading);
    uploading.finally(()=>pendingUploads.delete(uploading));
  });
  sharing = await (await import('../main/live-sharing.mjs?v=sharing-recovery-1')).createLiveSharing(adapter,window.flushProfile);
  document.addEventListener("click", (event) => {
    const link = event.target.closest("#extra-blocks a");
    if (link)
      sharing.track(
        link.classList.contains("extra-cta") ? "button" : "link",
        "Opened " + link.textContent.trim(),
      );
  });
  renderExtras();
  {
    const card=parent.document.querySelector(`.role[data-i18n="${adapter.profile.id}"]`)?.closest('.card');
    portrait.src = card?.querySelector('.who')?.src || `../main/pictures/portraits/${adapter.profile.id}.webp`;
    document.querySelector('.paper-foot span').textContent = '';
    document.querySelector('.pdf-help').textContent = 'PDF · up to 10 MB';
    const download=node('button','','text-button cv-download');download.setAttribute('aria-label','Save CV as PDF');
    download.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg><span>Save CV as PDF</span>';
    download.addEventListener('click',()=>window.print());
    addEventListener('beforeprint',()=>{finish(true);rowEditor.finish(true);});
    document.querySelector('.resume-toolbar').insertBefore(download,document.querySelector('[data-close="resume"]'));
    if(adapter.editable){
      const appearanceUI=setupCVAppearance({data,onChange(field){sync(field);save();}});
      const controls=node('div',undefined,'cv-view-switch');
      const modes=node('div',undefined,'cv-mode-options');modes.setAttribute('role','group');modes.setAttribute('aria-label','CV view');
      for(const mode of ['edit','preview']){
        const button=node('button',mode==='edit'?'Edit':'Preview');button.dataset.cvView=mode;
        button.addEventListener('click',()=>{if(previewing===(mode==='preview'))return;openResume(mode==='edit'?null:['contact','skills','languages','profile','experience','education','certificates','interests','documents','extras']);});
        modes.append(button);
      }
      controls.append(modes,appearanceUI.toggle);
      document.querySelector('.resume-toolbar').prepend(controls);
      const help=node('p','Click text to edit. Changes save automatically.','cv-edit-help');document.querySelector('#resume').append(help);
    }
    extrasRail=setupExtrasRail({editable:()=>!previewing,onLayout:alignPicture});
    addEventListener('beforeunload',event=>{if(adapter.dirty||pendingUploads.size){event.preventDefault();event.returnValue='';}});
    if(new URLSearchParams(location.search).get('view')==='settings'&&adapter.editable) $('settings-panel').showModal();
    else openResume(['contact','skills','languages','profile','experience','education','certificates','interests','documents','extras']);
    await portrait.decode().catch(()=>{});
    pagination=setupCVPagination(document.querySelector('.paper'));
    document.fonts.addEventListener('loadingdone',pagination.schedule);
    pagination.layout();
    setupImageMagnifier();
    parent.postMessage({type:'marmullaku-ready'},location.origin);
  }
})().catch(error=>{
  parent.postMessage({type:'marmullaku-error',message:error.message},location.origin);
});
