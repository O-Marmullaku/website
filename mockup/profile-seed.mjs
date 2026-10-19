const starterText=new Set([
  'Write a short introduction.', 'Write a short introduction and what you want to do next.',
  'Introduce yourself in a few sentences. What do you enjoy building, what are you good at, and what would you like to do next?',
  'Email address','Portfolio website','Interface design','Web development','Creative technology',
  'Add your languages','Your latest role','Your latest role or project','Company or organisation',
  'Company or organisation · Dates','Qualification or programme','Institution','Institution · Dates',
  'Dates','Describe your work and what you achieved.','Add a relevant certification','Add your interests',
  'What keeps you curious outside work?'
]);
function isStarter(cv) {
  const rows=[...cv.experience||[],...cv.education||[],...Object.values(cv.editor?.rows||{}).flat()];
  const text=[cv.profile,...rows.flatMap(row=>[row.title,row.detail,row.body,row.date])]
    .filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());
  return text.length>0&&text.every(value=>starterText.has(value));
}
export function profilesToSeed(current,entries,seeded=[]) {
  return entries.filter(({profile})=>{
    const existing=current.find(item=>item.id===profile.id),cv=existing?.cv;
    if(!cv)return true;
    if(isStarter(cv))return true;
    if(seeded.includes(profile.id))return false;
    return !cv.profile?.trim()&&!cv.experience?.length&&!cv.education?.length&&
      !Object.values(cv.editor?.rows||{}).some(rows=>rows.length);
  });
}

export function applyCopyUpdates(profile,updates=[]) {
  let changed=false;
  for(const update of updates){
    const path=update.path;
    if(!Array.isArray(path)||path[0]!=='cv'||path.length>8||path.some(key=>!['string','number'].includes(typeof key)||['__proto__','constructor','prototype'].includes(String(key))))continue;
    let target=profile;
    for(const key of path.slice(0,-1))target=target?.[key];
    const key=path.at(-1);
    if(!target||!Object.hasOwn(target,key)||JSON.stringify(target[key])!==JSON.stringify(update.before))continue;
    target[key]=structuredClone(update.after);changed=true;
  }
  return changed;
}
