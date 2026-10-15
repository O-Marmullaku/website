import {bootstrapPreview} from './preview-session.mjs?v=site-preview';
await bootstrapPreview();
const style=document.createElement('link');style.rel='stylesheet';style.href='../main/profile-live.css?v=accounts-2';document.head.append(style);
await import('./profile.js?v=site-preview');
