const { withTransaction } = require('../config/db');
const facultyRepository = require('../repositories/faculty-repository');
const { cleanFacultyName, normalizeFacultyName } = require('../utils/faculty-identity');
const { normalizePhoneNumber } = require('../utils/student-identity');
const { normalizeSection, isValidSection } = require('../utils/validation');

function formatFaculty(item, role = 'Faculty') {
  if (!item) return null;
  return {
    id: item.faculty_id,
    name: item.name,
    phoneNumber: item.phone_number || null,
    designation: item.designation || null,
    department: item.department || null,
    role,
    contactAvailable: Boolean(item.phone_number),
  };
}

async function facultyForStudent(section) {
  const result = await facultyRepository.getSectionFaculty(section);
  const coordinator = formatFaculty(result.coordinator, 'Coordinator');
  const coordinatorName = coordinator ? normalizeFacultyName(coordinator.name) : null;
  return [
    ...(coordinator ? [coordinator] : []),
    ...result.faculty
      .filter((item) => normalizeFacultyName(item.name) !== coordinatorName)
      .map((item) => formatFaculty(item)),
  ];
}

function validateFacultyInput(body) {
  const name = cleanFacultyName(body.name);
  const phoneInput = String(body.phoneNumber ?? body.phone_number ?? '').trim();
  const phoneNumber = phoneInput ? normalizePhoneNumber(phoneInput) : null;
  const designation = String(body.designation || '').trim().replace(/\s+/g, ' ') || null;
  const department = String(body.department || '').trim().replace(/\s+/g, ' ') || null;
  const section = normalizeSection(body.section);
  const role = body.role === 'Coordinator' ? 'Coordinator' : 'Faculty';
  const errors = [];
  if (!normalizeFacultyName(name)) errors.push('Faculty name is required.');
  if (phoneInput && !phoneNumber) errors.push('Enter a valid 10-digit Indian phone number.');
  if (role === 'Coordinator' && !isValidSection(section)) errors.push('Select a valid class or section.');
  return { name, phoneNumber, designation, department, section, role, isActive: body.isActive === false ? 0 : 1, errors };
}

async function saveFaculty(body, adminId) {
  const values = validateFacultyInput(body);
  if (values.errors.length) return { errors: values.errors };
  if (values.role === 'Coordinator') {
    const coordinator = await facultyRepository.getCoordinator(values.section);
    const replacingDifferentFaculty = coordinator
      && Number(coordinator.faculty_id) !== Number(body.id)
      && normalizeFacultyName(coordinator.name) !== normalizeFacultyName(values.name);
    if (replacingDifferentFaculty && !body.replaceCoordinator) {
      return { conflict: `${coordinator.name} is the current coordinator. Confirm replacement to continue.` };
    }
  }
  const facultyId = await withTransaction(async (transaction) => {
    const id = await facultyRepository.saveContact({ ...values, id: body.id }, transaction);
    if (values.role === 'Coordinator') await facultyRepository.setCoordinator(values.section, id, transaction);
    else if (values.section) await facultyRepository.clearCoordinator(values.section, id, transaction);
    await transaction.execute(
      `INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, body.id ? 'UPDATE' : 'CREATE', 'FACULTY', String(id), JSON.stringify({ section: values.section || null, role: values.role })]
    );
    return id;
  });
  return { faculty: formatFaculty(await facultyRepository.findById(facultyId), values.role) };
}

async function saveImportedCoordinator(body, section, adminId, operations) {
  const values = validateFacultyInput({
    ...body,
    section,
    role: 'Coordinator',
    designation: body.designation || 'Class Coordinator',
  });
  if (values.errors.length) return { errors: values.errors };

  const existing = await facultyRepository.findByNormalizedName(normalizeFacultyName(values.name), operations);
  if (!values.phoneNumber && existing?.phone_number) values.phoneNumber = existing.phone_number;
  if (existing?.designation) values.designation = existing.designation;
  if (existing?.department) values.department = existing.department;

  const facultyId = await facultyRepository.saveContact(values, operations);
  await facultyRepository.setCoordinator(values.section, facultyId, operations);
  await operations.execute(
    `INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
     VALUES (?, 'IMPORT_COORDINATOR', 'FACULTY', ?, ?)`,
    [adminId, String(facultyId), JSON.stringify({ section: values.section })]
  );
  return { facultyId };
}

module.exports = { facultyForStudent, formatFaculty, saveFaculty, saveImportedCoordinator, validateFacultyInput };
