/**
 * !pdf — Generate real printable PDF files — FREE for ALL users
 * Uses pdfkit (pure JS, no external API, no API key needed)
 *
 * Usage:
 *   !pdf                              — Show info + help
 *   !pdf [your own prompt/text]       — Generate custom PDF from your text
 *   !pdf school [name]                — School application form
 *   !pdf enrollment [name]            — Enrollment form
 *   !pdf clearance [name]             — School clearance
 *   !pdf permit [name]                — Exam permit
 *   !pdf letter [name] [subject]      — Formal letter
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs-extra');
const path        = require('path');
const bold        = require('../../utils/bold');

const TEMP_DIR = path.join(process.cwd(), 'utils/data/pdf_temp');
fs.ensureDirSync(TEMP_DIR);

function cleanup(fp) { setTimeout(() => fs.remove(fp).catch(() => {}), 300000); }

// ── PDF builder helpers ───────────────────────────────────────────────────────
function createDoc() {
  return new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 72, right: 72 } });
}

function hline(doc, y, x1 = 72, x2 = 540) {
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
}

function field(doc, label, yPos, lineWidth = 350) {
  doc.fontSize(9).fillColor('#555').font('Helvetica').text(label, 72, yPos);
  hline(doc, yPos + 14, 72, 72 + lineWidth);
  return yPos + 28;
}

function twoFields(doc, label1, label2, yPos) {
  doc.fontSize(9).fillColor('#555').font('Helvetica').text(label1, 72, yPos);
  hline(doc, yPos + 14, 72, 290);
  doc.fontSize(9).text(label2, 310, yPos);
  hline(doc, yPos + 14, 310, 540);
  return yPos + 28;
}

function sectionHeader(doc, text, yPos) {
  doc.rect(72, yPos, 468, 18).fill('#003366');
  doc.fontSize(10).fillColor('white').font('Helvetica-Bold').text(text, 76, yPos + 4);
  doc.fillColor('black').font('Helvetica');
  return yPos + 26;
}

// ── CUSTOM PDF from user's own prompt/text ────────────────────────────────────
function generateCustomPDF(prompt) {
  const fp  = path.join(TEMP_DIR, `custom_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);

  const today = new Date().toLocaleDateString('en-PH', { dateStyle: 'long' });

  // Header bar
  doc.rect(0, 0, 612, 50).fill('#003366');
  doc.fontSize(18).fillColor('white').font('Helvetica-Bold')
     .text('GENERATED DOCUMENT', 0, 16, { align: 'center', width: 612 });

  doc.moveDown(3);
  doc.fontSize(9).fillColor('#888').font('Helvetica')
     .text(`Date: ${today}`, { align: 'right' });
  doc.moveDown(0.5);
  hline(doc, doc.y);
  doc.moveDown(1);

  // User's content — parse line by line for natural formatting
  const lines = prompt.split(/\n|\\n/).map(l => l.trim()).filter(Boolean);

  for (const rawLine of lines) {
    // Detect heading (ALL CAPS line, or starts with #)
    const isHeading = /^#+\s/.test(rawLine) || (rawLine === rawLine.toUpperCase() && rawLine.length > 3 && rawLine.length < 80);
    const text = rawLine.replace(/^#+\s*/, '');

    if (isHeading) {
      doc.moveDown(0.4);
      doc.fontSize(13).fillColor('#003366').font('Helvetica-Bold').text(text);
      doc.moveDown(0.2);
      hline(doc, doc.y, 72, 72 + Math.min(text.length * 7.5, 468));
      doc.moveDown(0.4);
    } else if (/^[-*•]\s/.test(rawLine)) {
      // Bullet point
      const content = rawLine.replace(/^[-*•]\s*/, '');
      doc.fontSize(11).fillColor('#222').font('Helvetica')
         .text(`• ${content}`, { indent: 12, lineGap: 2 });
    } else if (/^\d+\.\s/.test(rawLine)) {
      // Numbered list
      doc.fontSize(11).fillColor('#222').font('Helvetica')
         .text(rawLine, { indent: 12, lineGap: 2 });
    } else {
      // Regular paragraph
      doc.fontSize(11).fillColor('#222').font('Helvetica')
         .text(text, { lineGap: 3, paragraphGap: 4 });
    }

    // Auto page break check
    if (doc.y > 680) {
      doc.addPage();
      doc.rect(0, 0, 612, 30).fill('#003366');
      doc.moveDown(2);
    }
  }

  // Signature area at bottom
  if (doc.y < 620) {
    doc.moveTo(72, 680).lineTo(72, doc.y).stroke({ opacity: 0 }); // invisible spacer
    doc.y = Math.max(doc.y + 30, 640);
    hline(doc, doc.y, 72, 300);
    doc.fontSize(9).fillColor('#555').text('Signature', 72, doc.y + 4);
    hline(doc, doc.y - 4, 330, 540);
    doc.text('Date', 330, doc.y - 4 + 4);
  }

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── SCHOOL APPLICATION ────────────────────────────────────────────────────────
function generateSchoolApplication(studentName = '') {
  const fp  = path.join(TEMP_DIR, `school_app_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#003366')
     .text('REPUBLIC OF THE PHILIPPINES', { align: 'center' });
  doc.fontSize(11).fillColor('#003366')
     .text('DEPARTMENT OF EDUCATION', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#c00000')
     .text('SCHOOL APPLICATION FORM', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#003366')
     .text('For School Year: _____________________', { align: 'center' });

  hline(doc, doc.y + 8);
  doc.moveDown(0.8);

  let y = doc.y;
  y = sectionHeader(doc, 'I. PERSONAL INFORMATION', y);
  y = field(doc, 'Last Name:', y, 440);
  y = field(doc, 'First Name:', y, 440);
  y = field(doc, 'Middle Name:', y, 440);
  y = twoFields(doc, 'Date of Birth (MM/DD/YYYY):', 'Place of Birth:', y);
  y = twoFields(doc, 'Age:', 'Sex:   ☐ Male   ☐ Female', y);
  y = twoFields(doc, 'Nationality:', 'Religion:', y);
  y = field(doc, 'Complete Home Address:', y, 440);
  y = twoFields(doc, 'Contact Number:', 'Email Address:', y);

  y += 6;
  y = sectionHeader(doc, 'II. GRADE / YEAR LEVEL APPLYING FOR', y);
  y = twoFields(doc, 'Grade/Year Level:', 'Track/Strand (for SHS):', y);
  y = twoFields(doc, 'School Last Attended:', 'School Year Completed:', y);
  y = twoFields(doc, 'General Average:', 'LRN (Learner Reference No.):', y);

  y += 6;
  y = sectionHeader(doc, 'III. FAMILY BACKGROUND', y);
  y = field(doc, "Father's Name:", y, 440);
  y = twoFields(doc, "Father's Occupation:", "Contact Number:", y);
  y = field(doc, "Mother's Name:", y, 440);
  y = twoFields(doc, "Mother's Occupation:", "Contact Number:", y);
  y = twoFields(doc, 'Guardian (if different):', "Relationship:", y);

  y += 6;
  y = sectionHeader(doc, 'IV. REQUIREMENTS CHECKLIST', y);

  const reqs = [
    '☐  Form 137 / SF10 (Permanent Record)',
    '☐  Form 138 / Report Card (Latest)',
    '☐  PSA Birth Certificate',
    '☐  2x2 ID Picture (2 pcs)',
    '☐  Good Moral Certificate',
    '☐  Barangay Clearance',
  ];
  reqs.forEach(r => {
    doc.fontSize(10).fillColor('black').font('Helvetica').text(r, 80, y);
    y += 16;
  });

  y += 8;
  doc.fontSize(9).fillColor('#333').font('Helvetica-Oblique')
     .text('I hereby certify that all information provided above is true and correct.', 72, y);
  y += 22;

  hline(doc, y + 30, 72, 250);
  hline(doc, y + 30, 300, 540);
  doc.fontSize(9).fillColor('#555').font('Helvetica')
     .text("Applicant's Signature", 72, y + 33)
     .text('Date Signed', 300, y + 33);

  y += 60;
  hline(doc, y + 30, 72, 250);
  hline(doc, y + 30, 300, 540);
  doc.fontSize(9).text("Parent/Guardian's Signature", 72, y + 33)
     .text("School Registrar's Signature", 300, y + 33);

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── FORMAL LETTER ─────────────────────────────────────────────────────────────
function generateFormalLetter(name = 'Student', subject = 'Request Letter') {
  const fp  = path.join(TEMP_DIR, `letter_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);

  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  doc.fontSize(10).font('Helvetica').fillColor('black');
  doc.text(today, { align: 'right' });
  doc.moveDown();
  doc.text('The Principal / School Head');
  doc.text('_____________________________');
  doc.text('_____________________________');
  doc.moveDown();
  doc.font('Helvetica-Bold').text(`Subject: ${subject}`);
  doc.moveDown();
  doc.font('Helvetica').text('Dear Sir/Madam,');
  doc.moveDown();
  doc.text(
    `I, ${name || '__________________________'}, a student of this institution, ` +
    `would like to respectfully request for ______________________________________. ` +
    `This is in connection with __________________________________________________.`,
    { lineGap: 5 }
  );
  doc.moveDown();
  doc.text('In view of the above, I am humbly requesting for your kind consideration and approval of this request.');
  doc.moveDown();
  doc.text('I hope for your favorable response. Thank you very much.');
  doc.moveDown(2);
  doc.text('Respectfully yours,');
  doc.moveDown(3);
  hline(doc, doc.y, 72, 300);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').text(name || '______________________________');
  doc.font('Helvetica').text('Grade/Year & Section: _________________');
  doc.text('Student ID No.: _______________________');
  doc.text(`Date: ${today}`);

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── SCHOOL CLEARANCE ──────────────────────────────────────────────────────────
function generateClearance(name = '') {
  const fp  = path.join(TEMP_DIR, `clearance_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);
  const sy  = `${new Date().getFullYear() - 1}–${new Date().getFullYear()}`;

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#003366')
     .text('SCHOOL CLEARANCE FORM', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black')
     .text(`School Year: ${sy}`, { align: 'center' });
  hline(doc, doc.y + 8);
  doc.moveDown(1);

  let y = doc.y;
  y = field(doc, 'Student Name:', y, 440);
  y = twoFields(doc, 'Grade & Section:', 'LRN:', y);
  y += 10;

  y = sectionHeader(doc, 'CLEARANCE REQUIREMENTS', y);
  const depts = [
    'Librarian', 'Cashier / Finance Office', 'Guidance Office',
    'Subject Teacher — Math', 'Subject Teacher — Science',
    'Subject Teacher — English', 'Subject Teacher — Filipino',
    'Subject Teacher — MAPEH', 'Subject Teacher — TLE/TVL',
    'Class Adviser', 'Registrar', 'School Head / Principal',
  ];
  depts.forEach(d => {
    doc.fontSize(10).fillColor('black').font('Helvetica').text(d, 80, y, { width: 250 });
    hline(doc, y + 14, 360, 540);
    doc.fontSize(8).fillColor('#888').text('Signature & Date', 362, y + 1);
    y += 28;
  });

  y += 10;
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#333')
     .text('This clearance certifies that the above-named student has settled all accountabilities.', 72, y);

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── EXAM PERMIT ───────────────────────────────────────────────────────────────
function generatePermit(name = '') {
  const fp  = path.join(TEMP_DIR, `permit_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#003366')
     .text('EXAMINATION PERMIT', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('black')
     .text(`School Year: ${new Date().getFullYear()}–${new Date().getFullYear() + 1}  |  Semester: _____`, { align: 'center' });
  hline(doc, doc.y + 6);
  doc.moveDown(1);

  let y = doc.y;
  y = field(doc, 'Student Name:', y, 440);
  y = twoFields(doc, 'Student ID No.:', 'Course / Strand:', y);
  y = twoFields(doc, 'Year & Section:', 'Date Issued:', y);

  y += 6;
  y = sectionHeader(doc, 'SUBJECTS ENROLLED', y);
  const subjects = ['Mathematics', 'Science', 'English', 'Filipino', 'Social Studies', 'MAPEH', 'Values Education', 'Elective'];
  subjects.forEach((s, i) => {
    doc.fontSize(10).text(`${i + 1}. ${s}`, 80, y);
    hline(doc, y + 14, 300, 540);
    doc.fontSize(8).fillColor('#888').text("Teacher's Signature", 302, y + 1);
    doc.fillColor('black');
    y += 28;
  });

  y += 10;
  hline(doc, y + 30, 72, 250);
  doc.fontSize(9).fillColor('#555').text("Registrar's Signature", 72, y + 33);
  hline(doc, y + 30, 300, 540);
  doc.text("Principal's Signature", 300, y + 33);

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── ENROLLMENT FORM ───────────────────────────────────────────────────────────
function generateEnrollment(name = '') {
  const fp  = path.join(TEMP_DIR, `enrollment_${Date.now()}.pdf`);
  const doc = createDoc();
  const out = fs.createWriteStream(fp);
  doc.pipe(out);
  const sy  = `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`;

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#003366')
     .text('ENROLLMENT FORM', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#003366')
     .text(`School Year: ${sy}`, { align: 'center' });
  hline(doc, doc.y + 6);
  doc.moveDown(0.8);

  let y = doc.y;
  y = sectionHeader(doc, 'I. STUDENT INFORMATION', y);
  y = field(doc, 'Full Name (Last, First, Middle):', y, 440);
  y = twoFields(doc, 'LRN:', 'Student ID No.:', y);
  y = twoFields(doc, 'Grade / Year Level:', 'Section:', y);
  y = twoFields(doc, 'Track/Strand (SHS):', 'Semester:', y);
  y = twoFields(doc, 'Date of Birth:', 'Sex:', y);
  y = field(doc, 'Address:', y, 440);
  y = twoFields(doc, 'Contact Number:', 'Email:', y);

  y += 6;
  y = sectionHeader(doc, 'II. PARENT / GUARDIAN INFORMATION', y);
  y = field(doc, "Parent/Guardian Name:", y, 440);
  y = twoFields(doc, 'Relationship:', 'Contact Number:', y);
  y = field(doc, 'Address (if different):', y, 440);

  y += 6;
  y = sectionHeader(doc, 'III. SUBJECTS ENROLLED', y);
  for (let i = 1; i <= 8; i++) {
    doc.fontSize(10).fillColor('black').text(`${i}.`, 78, y);
    hline(doc, y + 14, 90, 400);
    y += 24;
  }

  y += 8;
  hline(doc, y + 30, 72, 250);
  hline(doc, y + 30, 300, 540);
  doc.fontSize(9).fillColor('#555').text("Student / Parent Signature", 72, y + 33)
     .text("Registrar / Class Adviser", 300, y + 33);

  doc.end();
  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(fp));
    out.on('error', reject);
  });
}

// ── FORM KEYWORDS ─────────────────────────────────────────────────────────────
const FORM_KEYWORDS = new Set([
  'school', 'application', 'enrollment', 'enroll',
  'clearance', 'permit', 'letter', 'help'
]);

// ── Command ───────────────────────────────────────────────────────────────────
module.exports.config = {
  name:            'pdf',
  version:         '2.0.0',
  hasPermssion:    0,
  credits:         'TEAM STARTCOPE BETA',
  description:     'Generate real printable PDF — custom prompt or school forms — FREE for ALL',
  commandCategory: 'Utility',
  usages:          '[your prompt] | school | enrollment | clearance | permit | letter [name]',
  cooldowns:       8
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const P    = global.config?.PREFIX || '!';
  const type = (args[0] || '').toLowerCase();

  // ── No args — show info/welcome ────────────────────────────────────────────
  if (!args.length || type === 'help') {
    return api.sendMessage(
      `📄 ${bold('HELLO! THIS PDF IS REAL!')}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ ${bold('SEND ME YOUR PROMPT — FREE TO ALL USERS!')}\n` +
      `🔓 ${bold('UNLOCKED PREMIUM')} — Walang bayad, lahat pwede!\n\n` +
      `💡 ${bold('HOW TO USE:')}\n` +
      `Just type ${bold(P + 'pdf')} + your content:\n\n` +
      `📝 ${bold('CUSTOM PDF (anything you want):')}\n` +
      `  ${P}pdf My resignation letter to the company...\n` +
      `  ${P}pdf Minutes of the meeting\\nAttendees: Juan...\n` +
      `  ${P}pdf REPORT\\nThis is my weekly report...\n\n` +
      `🏫 ${bold('SCHOOL FORMS (ready-made):')}\n` +
      `  ${P}pdf school [name]        — Application\n` +
      `  ${P}pdf enrollment [name]    — Enrollment\n` +
      `  ${P}pdf clearance [name]     — Clearance\n` +
      `  ${P}pdf permit [name]        — Exam Permit\n` +
      `  ${P}pdf letter [name] [subj] — Formal Letter\n\n` +
      `📲 ${bold('PAANO MAG-PRINT:')}\n` +
      `1. I-download ang PDF\n` +
      `2. Buksan sa phone/computer\n` +
      `3. I-print — pwede na!`,
      threadID, messageID
    );
  }

  api.setMessageReaction('📄', messageID, () => {}, true);
  api.sendMessage(`⏳ ${bold('Generating your PDF...')} Please wait...`, threadID);

  try {
    let fp, formName, emoji;

    // ── School forms ───────────────────────────────────────────────────────
    if (type === 'school' || type === 'application') {
      const name = args.slice(1).join(' ').trim();
      fp = await generateSchoolApplication(name);
      formName = 'School Application Form';
      emoji = '🏫';
    } else if (type === 'enrollment' || type === 'enroll') {
      const name = args.slice(1).join(' ').trim();
      fp = await generateEnrollment(name);
      formName = 'Enrollment Form';
      emoji = '📋';
    } else if (type === 'clearance') {
      const name = args.slice(1).join(' ').trim();
      fp = await generateClearance(name);
      formName = 'School Clearance Form';
      emoji = '✅';
    } else if (type === 'permit') {
      const name = args.slice(1).join(' ').trim();
      fp = await generatePermit(name);
      formName = 'Exam Permit';
      emoji = '🎫';
    } else if (type === 'letter') {
      const rest = args.slice(1);
      const name = rest[0] || 'Student';
      const subj = rest.slice(1).join(' ').trim() || 'Request Letter';
      fp = await generateFormalLetter(name, subj);
      formName = 'Formal Letter';
      emoji = '✉️';

    // ── Custom prompt — the entire args are the user's content ────────────
    } else {
      const prompt = args.join(' ').trim();
      fp = await generateCustomPDF(prompt);
      formName = 'Custom Document';
      emoji = '📄';
    }

    api.setMessageReaction('✅', messageID, () => {}, true);

    const isCustom = !FORM_KEYWORDS.has(type);

    return api.sendMessage({
      body:
        `${emoji} ${bold(formName + ' — READY!')} 🖨️\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📄 ${bold('Format:')} PDF (printable)\n` +
        `📅 ${bold('Date:')} ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}\n` +
        (isCustom ? `📝 ${bold('Content:')} Your custom document\n` : '') +
        `\n📲 ${bold('HOW TO PRINT:')}\n` +
        `1. Download this PDF file\n` +
        `2. Open on your phone or computer\n` +
        `3. Tap Print — tapos na!`,
      attachment: fs.createReadStream(fp)
    }, threadID, () => cleanup(fp));

  } catch (e) {
    api.setMessageReaction('❌', messageID, () => {}, true);
    return api.sendMessage(
      `❌ ${bold('PDF generation failed.')}\n🔧 ${e.message}`,
      threadID, messageID
    );
  }
};
