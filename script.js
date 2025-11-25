/* AI-like Study Planner logic — runs fully in browser (no external API)
Usage notes:
- Enter subjects one per line. Format:
  Subject: topic1|topic2|topic3
  Or simply:
  Subject
- Choose exam date and hours per day.
- Click Generate Plan.
*/

function parseSubjects(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const subjects = [];
  for(const line of lines){
    const parts = line.split(':');
    const name = parts[0].trim();
    const topics = parts[1] ? parts[1].split('|').map(t=>t.trim()).filter(Boolean) : [];
    subjects.push({name, topics, weight: Math.max(1, topics.length)});
  }
  return subjects;
}

function daysBetween(today, examDate){
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const e = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
  const diff = Math.floor((e - t)/(1000*60*60*24));
  return diff;
}

function formatTime(totalMinutes){
  const hh = Math.floor(totalMinutes/60);
  const mm = totalMinutes%60;
  const h = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? 'AM' : 'PM';
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${ampm}`;
}

function generatePlan(){
  const subjectsText = document.getElementById('subjectsInput').value;
  const examDateVal = document.getElementById('examDate').value;
  const hoursPerDay = Number(document.getElementById('hoursPerDay').value) || 3;
  const difficulty = Number(document.getElementById('difficulty').value) || 1.25;

  if(!subjectsText || !examDateVal){
    alert('Please fill subjects and exam date.');
    return;
  }

  const subjects = parseSubjects(subjectsText);
  const examDate = new Date(examDateVal);
  const today = new Date();
  const daysLeft = daysBetween(today, examDate);

  if(daysLeft <= 0){
    alert('Exam date must be at least tomorrow. Please choose a future date.');
    return;
  }

  // Reserve last 3 days for revision (if possible)
  const revisionDays = Math.min(3, Math.max(0, daysLeft-1));
  const studyDays = Math.max(1, daysLeft - revisionDays);

  // Compute total weight
  let totalWeight = 0;
  subjects.forEach(s => {
    // base weight: topics count or 1
    s.weight = (s.topics.length || 1) * difficulty;
    totalWeight += s.weight;
  });

  // Total study minutes available (excluding short daily breaks)
  const minutesPerDay = Math.round(hoursPerDay * 60);
  const breakMinutesPerDay = Math.min(30, Math.round(minutesPerDay * 0.12)); // ~12% as breaks
  const effectiveMinutesPerDay = Math.max(30, minutesPerDay - breakMinutesPerDay);

  // Create plan per day
  const plan = [];
  // For each study day
  for(let d=0; d<studyDays; d++){
    const dayIndex = d;
    const dayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1 + d);
    const dayObj = {date: dayDate, slots: []};
    let remaining = effectiveMinutesPerDay;
    // For each subject allocate minutes proportional to weight
    subjects.forEach(s => {
      // base minutes per day for subject
      const subjMinutes = Math.max(20, Math.round((s.weight/totalWeight) * effectiveMinutesPerDay));
      if(subjMinutes <= 0) return;
      // create a slot
      dayObj.slots.push({subject: s.name, minutes: subjMinutes, topics: s.topics});
      remaining -= subjMinutes;
    });
    // if leftover minutes, add to subjects with max weight
    if(remaining > 10){
      dayObj.slots.sort((a,b)=>b.minutes-a.minutes);
      dayObj.slots[0].minutes += remaining;
      remaining = 0;
    }
    plan.push(dayObj);
  }

  // Build revision days
  const revisionPlan = [];
  for(let r=0; r<revisionDays; r++){
    const dayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1 + studyDays + r);
    // revision: shorter schedule focused on summaries/mock tests
    revisionPlan.push({date: dayDate, slots: [{subject: 'Revision / Mock Test', minutes: Math.round(effectiveMinutesPerDay * 0.85), topics: []}]});
  }

  // Prepare output
  renderOutput({subjects, daysLeft, studyDays, revisionDays, minutesPerDay, breakMinutesPerDay, plan, revisionPlan});
}

function renderOutput(data){
  document.getElementById('outputCard').hidden = false;
  const summary = document.getElementById('summary');
  summary.innerHTML = `
    <p class="muted">Days until exam: <strong>${data.daysLeft}</strong> • Study days: <strong>${data.studyDays}</strong> • Revision days: <strong>${data.revisionDays}</strong></p>
    <p class="muted">Daily available: <strong>${Math.round(data.minutesPerDay/60*100)/100} hrs</strong> • Effective study (after short breaks): <strong>${Math.round((data.minutesPerDay - data.breakMinutesPerDay)/60*100)/100} hrs</strong></p>
  `;

  const tt = document.getElementById('timetable');
  tt.innerHTML = '';

  // Helper to create schedule times (start at 9:00 AM)
  for(const day of data.plan){
    const dayCard = document.createElement('div'); dayCard.className='timetable-day';
    const dt = new Date(day.date);
    dayCard.innerHTML = `<strong>${dt.toDateString()}</strong> <div class="muted">Study day</div>`;
    // assign times
    let cursor = 9*60; // minutes from midnight, 9:00 AM
    for(const slot of day.slots){
      const start = cursor;
      const end = start + slot.minutes;
      const slotDiv = document.createElement('div'); slotDiv.className='timetable-slot';
      const topicText = slot.topics && slot.topics.length ? ` — ${slot.topics.join(', ')}` : '';
      slotDiv.innerHTML = `<div><strong>${slot.subject}</strong><div class="muted">${slot.minutes} min${topicText}</div></div><div class="muted">${formatTime(start)} — ${formatTime(end)}</div>`;
      dayCard.appendChild(slotDiv);
      cursor = end + 10; // 10 min small break
    }
    tt.appendChild(dayCard);
  }

  // revision
  if(data.revisionPlan.length){
    const revHeader = document.createElement('div'); revHeader.innerHTML = `<h3>Revision Days</h3>`; tt.appendChild(revHeader);
    for(const day of data.revisionPlan){
      const dayCard = document.createElement('div'); dayCard.className='timetable-day';
      const dt = new Date(day.date);
      dayCard.innerHTML = `<strong>${dt.toDateString()}</strong> <div class="muted">Revision day</div>`;
      for(const slot of day.slots){
        const slotDiv = document.createElement('div'); slotDiv.className='timetable-slot';
        slotDiv.innerHTML = `<div><strong>${slot.subject}</strong><div class="muted">${slot.minutes} min — focus on summary, mock tests and weak topics</div></div><div class="muted">Flexible</div>`;
        dayCard.appendChild(slotDiv);
      }
      tt.appendChild(dayCard);
    }
  }

  // Scroll to output
  document.getElementById('outputCard').scrollIntoView({behavior:'smooth'});
}

// Event bindings
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('generateBtn').addEventListener('click', generatePlan);
  document.getElementById('clearBtn').addEventListener('click', ()=>{
    document.getElementById('subjectsInput').value = '';
    document.getElementById('examDate').value = '';
    document.getElementById('hoursPerDay').value = 4;
    document.getElementById('difficulty').value = '1.25';
    document.getElementById('outputCard').hidden = true;
  });
  document.getElementById('printBtn').addEventListener('click', ()=>window.print());
});
