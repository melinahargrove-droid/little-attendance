// Follow visible app navigation. Never click a hidden home hotspot after a modal
// closes onto My Classroom, or invoke production routing directly from a test.
async function openClassroom(page){
 if(await page.locator('#classroom.active').isVisible())return;
 if(!await page.locator('#dashboard.active').isVisible()){
  let returned=false;
  for(const selector of ['#themesHome','#busClose','#appleClose','#fallLeavesClose','#homeBtn']){
   const button=page.locator(selector);
   if(await button.isVisible()){await button.click();returned=true;break;}
  }
  if(!returned)throw Error('No visible route to My Classroom from the current screen');
 }
 await page.locator('#classHotspot').click();
 await page.locator('#classroom.active').waitFor();
}
async function openAttendanceControls(page){
 if(await page.locator('#teacherDialog').isVisible())return;
 await openClassroom(page);
 await page.locator('#classroomTeacher').click();
 await page.locator('#teacherDialog').waitFor();
}
module.exports={openClassroom,openAttendanceControls};
