import {bootstrapPreview} from './preview-session.mjs?v=site-preview';
await bootstrapPreview();
const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=centered-paper';document.head.append(style);
const settingsStyle=document.createElement('link');settingsStyle.rel='stylesheet';settingsStyle.href='settings.css?v=centered-paper';document.head.append(settingsStyle);
await import('./profile.js?v=centered-paper');
