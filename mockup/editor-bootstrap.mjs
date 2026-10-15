import {bootstrapPreview} from './preview-session.mjs?v=site-preview';
await bootstrapPreview();
const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=accounts-2';document.head.append(style);
const settingsStyle=document.createElement('link');settingsStyle.rel='stylesheet';settingsStyle.href='settings.css?v=automatic-timing';document.head.append(settingsStyle);
await import('./profile.js?v=automatic-timing');
