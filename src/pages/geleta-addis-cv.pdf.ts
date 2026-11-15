/**
 * The downloadable CV, generated at build time from the same content as the site
 * (roles, education, profile), so it can never drift from the page and updates
 * whenever she edits something in the admin. It deliberately contains no phone
 * number and no referees: only what the site itself shows.
 *
 * Built with PDF standard fonts (Helvetica, Times) so it stays small and reads
 * cleanly in applicant-tracking systems.
 */
import type { APIRoute } from 'astro';
import PDFDocument from 'pdfkit';
import { getProfile, getEntries, getStudies, fmtMonth } from '../lib/ledger';

const INK = '#1f1a24', MUTED = '#5a5160', RED = '#b3262e', RULE = '#d9d2c6';
const M = 50, W = 595.28 - M * 2; // A4 with 50pt margins

export const GET: APIRoute = async () => {
  const profile = await getProfile();
  const entries = (await getEntries()).slice().reverse(); // newest first
  const studies = await getStudies();

  const doc = new PDFDocument({
    size: 'A4', margins: { top: M, bottom: 54, left: M, right: M }, bufferPages: true,
    info: { Title: `${profile.name.first} ${profile.name.last} · CV`, Author: `${profile.name.first} ${profile.name.last}`, Subject: profile.positioning.title },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));

  const room = (h: number) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };
  const heading = (t: string) => {
    room(60);
    doc.moveDown(0.9);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(RED).text(t.toUpperCase(), M, doc.y, { characterSpacing: 1.4 });
    doc.moveTo(M, doc.y + 3).lineTo(M + W, doc.y + 3).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.y += 9;
  };
  const bullet = (t: string) => {
    room(28);
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text('•', M + 2, y, { lineBreak: false });
    doc.fillColor(INK).text(t, M + 14, y, { width: W - 14, lineGap: 1.5 });
    doc.y += 2.5;
  };

  // ── Name and positioning ──
  doc.font('Helvetica-Bold').fontSize(27).fillColor(INK).text(`${profile.name.first} ${profile.name.last}`, M, M, { characterSpacing: -0.3 });
  doc.font('Times-Italic').fontSize(13).fillColor(RED).text(profile.positioning.title, M, doc.y + 1);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
    [profile.location, profile.contact.email, profile.contact.linkedin.replace(/^https?:\/\/(www\.)?/, '')].join('   ·   '),
    M, doc.y,
  );

  // ── Profile ──
  heading('Profile');
  doc.font('Helvetica').fontSize(9.8).fillColor(INK).text((profile.statement as string[]).join(' '), M, doc.y, { width: W, lineGap: 2 });

  // ── Experience ──
  heading('Experience');
  // The CV is a summary: recent roles get more detail, older ones fewer points, and the
  // customer-side and company-side points are interleaved so trimming stays balanced.
  const weave = (a: string[], b: string[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]]).flat().filter(Boolean) as string[];
  for (const [idx, e] of entries.entries()) {
    const d = e.data;
    const points = weave(d.customerSide, d.companySide).slice(0, idx < 3 ? 6 : idx < 6 ? 4 : 3);
    room(40 + points.length * 15);
    const top = doc.y;
    const when = `${fmtMonth(d.start)} – ${fmtMonth(d.end)}`;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(d.role, M, top, { width: W - 120, lineGap: 1 });
    const after = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(when, M + W - 118, top + 1.5, { width: 118, align: 'right' });
    doc.y = after;
    doc.font('Times-Italic').fontSize(10.5).fillColor(RED).text(d.org, M, doc.y, { continued: !!d.roleNote });
    if (d.roleNote) doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`   ${d.roleNote}`);
    doc.y += 3;
    points.forEach(bullet);
    doc.y += 5;
  }

  // ── Education ──
  heading('Education and certifications');
  for (const s of studies) {
    const d = s.data;
    room(44);
    const top = doc.y;
    const yrs = d.start ? `${d.start.slice(0, 4)}${d.end ? ' – ' + d.end.slice(0, 4) : ''}` : '';
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${d.award}, ${d.field}`, M, top, { width: W - 100 });
    const after = doc.y;
    if (yrs) doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(yrs, M + W - 98, top + 1, { width: 98, align: 'right' });
    doc.y = after;
    doc.font('Times-Italic').fontSize(10).fillColor(RED).text(d.institution, M, doc.y);
    if (d.items.length) doc.font('Helvetica').fontSize(8.8).fillColor(MUTED).text(d.items.join('  ·  '), M, doc.y + 1, { width: W, lineGap: 1.5 });
    doc.y += 6;
  }

  // ── Strengths and languages ──
  if (profile.skills.length || profile.languages.length) {
    heading('Strengths and languages');
    if (profile.skills.length) doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(profile.skills.join('  ·  '), M, doc.y, { width: W, lineGap: 2 });
    if (profile.languages.length) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(profile.languages.map((l: { name: string; level: string }) => `${l.name} (${l.level})`).join('   ·   '), M, doc.y, { width: W });
    }
  }

  // ── Footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // lets the footer sit in the margin without adding a page
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(
      `${profile.name.first} ${profile.name.last}  ·  ${i + 1} / ${range.count}`,
      M, doc.page.height - 36, { width: W, align: 'center', lineBreak: false },
    );
  }

  doc.end();
  const pdf = await done;
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf' } });
};
