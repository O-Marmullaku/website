import { rowLayouts, moveRow, contactLabel } from "./cv-rows.mjs?v=original-composition";

export function createRowEditor({
  rows,
  onChange,
  beforeEdit,
  attachPDF,
  isReadOnly,
  beforeRender = () => {},
}) {
  let active, undo, logoTarget;
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const undoButton = document.getElementById("undo-row");
  const logoInput = document.getElementById("row-logo");
  const status = document.getElementById("resume-status");
  document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll(".cv-row-options[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  const sections = Object.fromEntries(
    Object.keys(rowLayouts).map((field) => [
      field,
      document.querySelector(`[data-section="${field}"]`),
    ]),
  );
  const commit = () => onChange(rows);
  function checkpoint() {
    finish(true);
    undo = structuredClone(rows);
    undoButton.hidden = false;
    undoButton.textContent="Undo";undoButton.setAttribute("aria-label","Undo last change");
  }
  function finish(keep = true) {
    if (!active) return;
    const editor = active;
    active = null;
    editor.controller.abort();
    if (editor.key === 'href' && editor.row.href && !/^(https?:\/\/|mailto:|tel:)/i.test(editor.row.href)) {
      keep=false; status.textContent='Use a web, email or phone link.';
    }
    if (!keep) {
      editor.row[editor.key] = editor.old;
      editor.value.textContent = editor.old;
    }
    editor.value.contentEditable = "false";
    editor.value.removeAttribute("role");
    editor.value.removeAttribute("aria-label");
    editor.value.removeAttribute("aria-multiline");
    prepareField(editor.value);
    editor.host.classList.remove("editing");
    commit();
    if (editor.key === 'href') paint(Object.keys(rows).find(key=>rows[key].includes(editor.row)));
  }
  function edit(value, button, row, key) {
    if (isReadOnly()) return;
    beforeEdit();
    finish(true);
    const controller = new AbortController(),
      options = { signal: controller.signal };
    const host = value.parentElement;
    active = { value, button, row, key, host, controller, old: row[key] };
    value.contentEditable = "plaintext-only";
    value.setAttribute("role", "textbox");
    value.setAttribute("aria-label", button.getAttribute("aria-label"));
    value.setAttribute("aria-multiline", String(key === "body"));
    host.classList.add("editing");
    value.addEventListener(
      "input",
      () => {
        row[key] = value.innerText.replace(/\r/g, "").slice(0, key==='body'?5000:key==='date'?100:key==='href'?500:1000);
        commit();
      },
      options,
    );
    value.addEventListener("blur", () => finish(true), options);
    value.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" ||
          (event.key === "Enter" &&
            (key !== "body" || event.ctrlKey || event.metaKey))
        ) {
          event.preventDefault();
          event.stopPropagation();
          finish(event.key !== "Escape");
          button.focus({ preventScroll: true });
        }
      },
      options,
    );
    value.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(value);
    range.collapse(false);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  }
  function prepareField(value){
    const readOnly=isReadOnly();value.tabIndex=readOnly?(value.tagName==='A'?0:-1):0;
    if(!value.isContentEditable){
      if(readOnly){value.removeAttribute('role');value.removeAttribute('aria-label');}
      else{value.setAttribute('role','button');value.setAttribute('aria-label',value.dataset.editLabel);}
    }
  }
  function field(host, row, key, label, placeholder = "") {
    const wrapper = node("div", "cv-cell cv-cell-" + key);
    const value = node(key === "title" && row.href ? "a" : key === "title" ? "p" : "div", "cv-row-text", row[key]);
    if (value.tagName === "A") {
      value.href = row.href; value.rel = "noopener"; value.target = "_blank";
      value.addEventListener("click", event => { if (value.isContentEditable) event.preventDefault(); });
    }
    value.dataset.rowText = key;
    value.dataset.placeholder = placeholder;
    value.dataset.editLabel=label;
    prepareField(value);
    value.addEventListener('click',event=>{
      if(!isReadOnly()&&!value.isContentEditable){event.preventDefault();edit(value,value,row,key);}
    });
    value.addEventListener('keydown',event=>{
      if(!isReadOnly()&&!value.isContentEditable&&['Enter',' ','F2'].includes(event.key)){event.preventDefault();edit(value,value,row,key);}
    });
    wrapper.append(value);
    host.append(wrapper);
  }
  function action(menu, label, callback, disabled = false) {
    const button = node("button", "", label);
    button.disabled = disabled;
    button.addEventListener("click", () => {
      menu.parentElement.open = false;
      if (!isReadOnly()) callback();
    });
    menu.append(button);
  }
  function paint(fieldName) {
    beforeRender();
    const section = sections[fieldName],
      layout = rowLayouts[fieldName];
    section.querySelector(".section-copy")?.remove();
    let container = section.querySelector(".cv-rows");
    if (!container) {
      container = node("div", "cv-rows");
      section.append(container);
    }
    container.replaceChildren();
    for (const [index, row] of rows[fieldName].entries()) {
      const item = node("div", "cv-row cv-row-" + layout);
      item.dataset.rowId = row.id;
      const label = `${fieldName} row ${index + 1}`;
      let languageLevel;
      if (layout === "timeline")
        field(item, row, "date", `Edit dates for ${label}`, "Dates");
      const content = node("div", "cv-row-content");
      if(fieldName==='contact'){
        const label=contactLabel(row);if(label)content.append(node('strong','cv-contact-label',label));
        const shapes={Address:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',Telephone:'<path d="m5 3 4 4-2 3c2 4 3 5 7 7l3-2 4 4-3 3C9 21 3 15 2 6Z"/>','E-mail':'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',Website:'<path d="m10 13 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',date:'<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>'};
        const shape=shapes[label]||(/^\d{1,2}\.\d{1,2}\.\d{4}/.test(row.title)?shapes.date:null);
        if(shape){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.classList.add('cv-contact-icon');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML=shape;item.append(icon);}
      }
      field(
        content,
        row,
        "title",
        `Edit title for ${label}`,
        layout === "timeline" ? "Role or qualification" : "Add text",
      );
      if (layout === "timeline") {
        field(
          content,
          row,
          "detail",
          `Edit organisation for ${label}`,
          "Organisation",
        );
        if (row.body)
          field(content, row, "body", `Edit description for ${label}`);
      }
      if (fieldName === 'certificates') {
        field(content,row,'detail',`Edit issuer for ${label}`,'Issuer');
        field(content,row,'date',`Edit date for ${label}`,'Date');
      }
      if (layout === "language") {
        if (row.detail) content.querySelector('.cv-cell-title').append(node("span", "cv-language-description", ` (${row.detail})`));
        const level = node("select", "cv-language-level cv-owner");
        level.setAttribute("aria-label", `Language level for ${label}`);
        for (const [value, title] of [
          "No rating",
          "Beginner",
          "Elementary",
          "Intermediate",
          "Advanced",
          "Fluent / native",
        ].entries()) {
          const option = node("option", "", title);
          option.value = value;
          level.append(option);
        }
        level.value = row.level;
        const dots = node("span", "cv-language-dots");
        dots.setAttribute("aria-label", `${row.level} of 5`);
        for (let i = 1; i <= 5; i++)
          dots.append(node("i", i <= row.level ? "filled" : ""));
        dots.hidden = row.level === 0;
        level.addEventListener("change", () => {
          if (isReadOnly()) return;
          checkpoint();
          row.level = Number(level.value);
          row.detail = "";
          paint(fieldName);
          commit();
        });
        content.append(dots);languageLevel=level;
      }
      item.append(content);
      if (row.logo) {
        const logo = node("img", "cv-row-logo");
        logo.src = row.logo;
        logo.alt = row.title ? `${row.title} logo` : "Organisation logo";
        item.append(logo);
      }
      const options = node("details", "cv-row-options cv-owner");
      const summary = node("summary", "");
      summary.setAttribute("aria-label", `Options for ${label}`);
      summary.innerHTML =
        '<svg aria-hidden="true"><use href="#more-icon"/></svg>';
      const menu = node("div", "cv-row-menu");
      if(languageLevel){const label=node('label','cv-menu-label','Language level');label.append(languageLevel);menu.append(label);}
      if (fieldName === "contact") {
        action(menu, "Edit link", () => {
          let cell=content.querySelector('.cv-cell-href');
          if (!cell) {field(content,row,'href',`Edit link for ${label}`,'https://, mailto: or tel:');cell=content.querySelector('.cv-cell-href');}
          cell.querySelector('[data-row-text]').click();
        });
      }
      action(
        menu,
        "Move up",
        () => {
          checkpoint();
          rows[fieldName] = moveRow(rows[fieldName], row.id, -1);
          paint(fieldName);
          commit();
        },
        index === 0,
      );
      action(
        menu,
        "Move down",
        () => {
          checkpoint();
          rows[fieldName] = moveRow(rows[fieldName], row.id, 1);
          paint(fieldName);
          commit();
        },
        index === rows[fieldName].length - 1,
      );
      if (layout === "timeline") {
        action(
          menu,
          "Add description",
          () => {
            checkpoint();
            row.body ||= "Describe your contribution";
            paint(fieldName);
            commit();
          },
          !!row.body,
        );
        action(menu, row.logo ? "Change logo" : "Add logo", () => {
          logoTarget = { fieldName, id: row.id };
          logoInput.click();
        });
        if (row.logo)
          action(menu, "Remove logo", () => {
            checkpoint();
            row.logo = "";
            paint(fieldName);
            commit();
          });
      }
      action(menu, "Attach PDF", () => attachPDF(fieldName, row.id));
      action(menu, "Duplicate entry", () => {
        checkpoint();
        rows[fieldName].splice(index + 1, 0, {
          ...row,
          id: crypto.randomUUID(),
        });
        paint(fieldName);
        commit();
      });
      action(menu, "Delete entry", () => {
        checkpoint();
        rows[fieldName].splice(index, 1);
        paint(fieldName);
        commit();
      });
      options.append(summary, menu);
      options.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && options.open) {
          event.preventDefault();
          event.stopPropagation();
          options.open = false;
          summary.focus({ preventScroll: true });
        }
      });
      item.append(options);
      container.append(item);
    }
    let add = section.querySelector(".cv-add-row");
    if (!add) {
      const names={contact:'contact detail',skills:'skill',languages:'language',experience:'experience',education:'education',certificates:'certificate',interests:'interest'};
      add = node('button','cv-add-row cv-owner',`+ Add ${names[fieldName]}`);
      add.setAttribute('aria-label',`Add ${names[fieldName]}`);
      add.addEventListener("click", () => {
        if (isReadOnly()) return;
        beforeEdit();
        checkpoint();
        const row = {
          id: crypto.randomUUID(),
          date: "",
          title: "",
          detail: "",
          body: "",
          logo: "",
          level: 0,
        };
        rows[fieldName].push(row);
        paint(fieldName);
        commit();
        section
          .querySelector(`[data-row-id="${row.id}"] .cv-cell-title [data-row-text]`)
          .click();
      });
      section.append(add);
    }
    section.append(add);
  }
  undoButton.addEventListener("click", () => {
    if (!undo || isReadOnly()) return;
    beforeEdit();
    rows = undo;
    undo = null;
    undoButton.hidden = true;
    Object.keys(rowLayouts).forEach(paint);
    commit();
  });
  logoInput.addEventListener("change", async () => {
    const file = logoInput.files[0],
      target = logoTarget;
    logoInput.value = "";
    if (!file || !target || isReadOnly()) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      status.textContent = "Choose a PNG, JPEG or WebP logo smaller than 1 MB.";
      return;
    }
    try {
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const row = rows[target.fieldName].find((row) => row.id === target.id);
      if (!row || isReadOnly()) return;
      checkpoint();
      row.logo = url;
      paint(target.fieldName);
      commit();
    } catch {
      status.textContent = "Could not read this logo. Choose the file again.";
    }
  });
  Object.keys(rowLayouts).forEach(paint);
  return {
    finish,
    syncMode(){document.querySelectorAll(".cv-row-text[data-edit-label]").forEach(prepareField);},
    editFirst(fieldName) {
      sections[fieldName]?.querySelector(".cv-cell-title [data-row-text]")?.click();
    },
  };
}
