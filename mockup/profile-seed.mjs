export function profilesToSeed(current,entries,seeded=[]) {
  return entries.filter(({profile})=>{
    if(seeded.includes(profile.id))return false;
    const existing=current.find(item=>item.id===profile.id),cv=existing?.cv;
    if(!cv)return true;
    return !cv.profile?.trim()&&!cv.experience?.length&&!cv.education?.length&&
      !Object.values(cv.editor?.rows||{}).some(rows=>rows.length);
  });
}
