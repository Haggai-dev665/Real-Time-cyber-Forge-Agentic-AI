/**
 * What is accepted from a file upload, and how it is described (SEC-04).
 *
 * A file's name, its claimed type and the metadata sent with it are written by
 * whoever uploads it. They are stored as evidence and shown again in reports,
 * so they are treated as untrusted text:
 *
 *   - the name keeps its last path part only, loses control characters and
 *     the Unicode controls that reorder text (which can make "exe.pdf" read as
 *     "fdp.exe"), and is cut to MAX_NAME characters with its extension kept;
 *   - metadata must be a flat object of at most MAX_META_KEYS short keys with
 *     string, number or boolean values; anything else is dropped and counted;
 *   - the type is read from the file's first bytes, not from its name or the
 *     type the client claimed, and a name that disagrees with the content is
 *     reported as a finding.
 *
 * Archives are recognised but not opened: what is inside a ZIP, RAR, 7z or
 * gzip file is not analysed.
 */

const MAX_NAME = 200;
const MAX_META_KEYS = 20;
const MAX_META_KEY = 64;
const MAX_META_VALUE = 500;

// C0/C1 controls, and the bidirectional and zero-width format characters
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

function safeFilename(raw) {
  let name = String(raw == null ? '' : raw);
  name = name.split(/[\\/]/).pop();
  name = name.replace(UNSAFE_CHARS, '').replace(/\s+/g, ' ').trim();
  name = name.replace(/^\.+/, '');
  if (!name) return 'unnamed';
  if (name.length > MAX_NAME) {
    const ext = (name.match(/\.[A-Za-z0-9]{1,10}$/) || [''])[0];
    name = name.slice(0, MAX_NAME - ext.length) + ext;
  }
  return name;
}

/**
 * @param {unknown} raw - the metadata field as sent (a JSON string from a form, or an object)
 * @returns {{ metadata: object, dropped: number, invalid: boolean }}
 */
function boundedMetadata(raw) {
  let value = raw;
  if (value === undefined || value === null || value === '') return { metadata: {}, dropped: 0, invalid: false };
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (_) { return { metadata: {}, dropped: 0, invalid: true }; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { metadata: {}, dropped: 0, invalid: true };
  const metadata = {};
  let dropped = 0;
  for (const [key, item] of Object.entries(value)) {
    const cleanKey = String(key).replace(UNSAFE_CHARS, '').slice(0, MAX_META_KEY);
    const ok = cleanKey && !cleanKey.startsWith('$') && !cleanKey.includes('.') && cleanKey !== '__proto__'
      && Object.keys(metadata).length < MAX_META_KEYS;
    if (!ok) { dropped += 1; continue; }
    if (typeof item === 'string') metadata[cleanKey] = item.replace(UNSAFE_CHARS, '').slice(0, MAX_META_VALUE);
    else if (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) metadata[cleanKey] = item;
    else dropped += 1;
  }
  return { metadata, dropped, invalid: false };
}

// [type, label, test on the first bytes]
const SIGNATURES = [
  ['pe', 'a Windows executable (MZ header)', b => b[0] === 0x4d && b[1] === 0x5a],
  ['elf', 'a Linux executable (ELF header)', b => b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46],
  ['macho', 'a macOS executable (Mach-O header)', b => [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(b.length >= 4 ? b.readUInt32BE(0) : -1)],
  ['pdf', 'a PDF document', b => b.slice(0, 5).toString('latin1') === '%PDF-'],
  ['zip', 'a ZIP container (archive, Office document, JAR or APK)', b => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)],
  ['ole', 'an OLE container (legacy Office document or MSI)', b => b.length >= 8 && b.readUInt32BE(0) === 0xd0cf11e0 && b.readUInt32BE(4) === 0xa1b11ae1],
  ['rar', 'a RAR archive', b => b.slice(0, 4).toString('latin1') === 'Rar!'],
  ['7z', 'a 7-Zip archive', b => b.length >= 6 && b.slice(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))],
  ['gzip', 'a gzip archive', b => b[0] === 0x1f && b[1] === 0x8b],
  ['png', 'a PNG image', b => b.length >= 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['jpeg', 'a JPEG image', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['gif', 'a GIF image', b => b.slice(0, 4).toString('latin1') === 'GIF8'],
  ['script', 'a script (starts with #!)', b => b[0] === 0x23 && b[1] === 0x21]
];

/** The type the content shows, from its first bytes: one of SIGNATURES, else 'text', 'binary' or 'empty'. */
function detectType(buffer) {
  if (!buffer || buffer.length === 0) return { type: 'empty', label: 'an empty file' };
  for (const [type, label, test] of SIGNATURES) {
    try { if (test(buffer)) return { type, label }; } catch (_) { /* too short for this test */ }
  }
  const head = buffer.slice(0, 4096);
  const printable = head.filter(byte => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127) || byte >= 128).length;
  return printable / head.length > 0.95 && !head.includes(0)
    ? { type: 'text', label: 'text' }
    : { type: 'binary', label: 'unrecognised binary data' };
}

// which detected types each extension may honestly have
const EXTENSION_TYPES = {
  pdf: ['pdf'], png: ['png'], jpg: ['jpeg'], jpeg: ['jpeg'], gif: ['gif'],
  zip: ['zip'], docx: ['zip'], xlsx: ['zip'], pptx: ['zip'], jar: ['zip'], apk: ['zip'], odt: ['zip'],
  doc: ['ole'], xls: ['ole'], ppt: ['ole'], msi: ['ole'],
  rar: ['rar'], '7z': ['7z'], gz: ['gzip'], tgz: ['gzip'],
  exe: ['pe'], dll: ['pe'], scr: ['pe'], sys: ['pe'],
  txt: ['text'], csv: ['text'], json: ['text'], xml: ['text'], html: ['text'], htm: ['text'], md: ['text'], log: ['text'],
  js: ['text', 'script'], py: ['text', 'script'], sh: ['text', 'script'], ps1: ['text'], bat: ['text'], cmd: ['text'], vbs: ['text']
};
const EXECUTABLE = new Set(['pe', 'elf', 'macho']);
const ARCHIVE = new Set(['zip', 'rar', '7z', 'gzip']);

/**
 * Findings about what the file is, compared with what its name and claimed type say.
 * @returns {{ detected: {type, label}, findings: string[] }}
 */
function describeContent(filename, buffer, claimedMime = '') {
  const detected = detectType(buffer);
  const findings = [];
  const ext = ((filename.match(/\.([A-Za-z0-9]{1,10})$/) || [])[1] || '').toLowerCase();
  const expected = EXTENSION_TYPES[ext];
  if (expected && !expected.includes(detected.type) && detected.type !== 'empty') {
    findings.push(EXECUTABLE.has(detected.type)
      ? `File is named .${ext} but its content is ${detected.label}: a disguised executable.`
      : `File is named .${ext} but its content is ${detected.label}.`);
  } else if (!ext && EXECUTABLE.has(detected.type)) {
    findings.push(`File has no extension and its content is ${detected.label}.`);
  }
  if (EXECUTABLE.has(detected.type) && /^(image|text|audio|video)\//i.test(claimedMime)) {
    findings.push(`File was sent as ${String(claimedMime).slice(0, 80)} but its content is ${detected.label}.`);
  }
  if (ARCHIVE.has(detected.type)) {
    findings.push(`Content is ${detected.label}; what it contains was not unpacked or analysed.`);
  }
  return { detected, findings };
}

module.exports = { safeFilename, boundedMetadata, detectType, describeContent, MAX_NAME, MAX_META_KEYS };
