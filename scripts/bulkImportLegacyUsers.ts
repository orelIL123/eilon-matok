#!/usr/bin/env ts-node

/**
 * Bulk Import Legacy Users Script
 *
 * This script imports legacy users from a CSV file (name, phone) into Firebase.
 * It creates user accounts with auto-generated 6-digit passwords.
 *
 * Usage:
 * 1. Create a CSV file with format: name,phone
 *    Example:
 *    ישראל ישראלי,0501234567
 *    משה כהן,0502345678
 *
 * 2. Run the script:
 *    npx ts-node scripts/bulkImportLegacyUsers.ts path/to/users.csv
 *
 * The script will:
 * - Generate a unique 6-digit password for each user
 * - Create a synthetic email (phone@phonesign.local)
 * - Store user in Firebase Auth and Firestore
 * - Mark user as "legacy" (needs first-time password change)
 * - Output a CSV with user credentials to send via SMS
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const auth = admin.auth();
const db = admin.firestore();

interface LegacyUser {
  name: string;
  phone: string;
}

interface ImportedUser {
  name: string;
  phone: string;
  password: string;
  email: string;
  uid: string;
  success: boolean;
  error?: string;
}

/**
 * Generate a random 6-digit password
 */
function generatePassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone number to +972 format
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // Convert to +972 format
  if (cleanPhone.startsWith('0')) {
    return `+972${cleanPhone.substring(1)}`;
  } else if (cleanPhone.startsWith('972')) {
    return `+${cleanPhone}`;
  } else {
    return `+972${cleanPhone}`;
  }
}

/**
 * Create synthetic email from phone number
 */
function createSyntheticEmail(phone: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `${cleanPhone}@eilonmatok.local`;
}

/**
 * Parse CSV file and return array of users
 */
function parseCSV(filePath: string): LegacyUser[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());

  const users: LegacyUser[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header if exists
    if (i === 0 && (line.includes('name') || line.includes('שם'))) {
      console.log('📋 Skipping header line');
      continue;
    }

    const parts = line.split(',').map(p => p.trim());

    if (parts.length < 2) {
      console.warn(`⚠️  Line ${i + 1}: Invalid format (expected: name,phone) - skipping`);
      continue;
    }

    const [name, phone] = parts;

    if (!name || !phone) {
      console.warn(`⚠️  Line ${i + 1}: Missing name or phone - skipping`);
      continue;
    }

    users.push({ name, phone });
  }

  return users;
}

/**
 * Import a single legacy user
 */
async function importUser(user: LegacyUser): Promise<ImportedUser> {
  const normalizedPhone = normalizePhone(user.phone);
  const syntheticEmail = createSyntheticEmail(normalizedPhone);
  const password = generatePassword();

  try {
    console.log(`\n👤 Processing: ${user.name} (${normalizedPhone})`);

    // Check if user already exists by phone
    const existingUsers = await db.collection('users')
      .where('phone', '==', normalizedPhone)
      .get();

    if (!existingUsers.empty) {
      console.log(`⚠️  User already exists: ${user.name}`);
      return {
        ...user,
        phone: normalizedPhone,
        email: syntheticEmail,
        password: password,
        uid: existingUsers.docs[0].id,
        success: false,
        error: 'User already exists',
      };
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: syntheticEmail,
      password: password,
      displayName: user.name,
      phoneNumber: normalizedPhone,
    });

    console.log(`✅ Created Auth user: ${userRecord.uid}`);

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      name: user.name,
      phone: normalizedPhone,
      email: syntheticEmail,
      type: 'client',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isLegacyUser: true, // Flag for first-time login
      legacyImportedAt: admin.firestore.FieldValue.serverTimestamp(),
      firstLoginCompleted: false,
    });

    console.log(`✅ Created Firestore document`);

    return {
      ...user,
      phone: normalizedPhone,
      email: syntheticEmail,
      password: password,
      uid: userRecord.uid,
      success: true,
    };
  } catch (error: any) {
    console.error(`❌ Error importing ${user.name}:`, error.message);
    return {
      ...user,
      phone: normalizePhone(user.phone),
      email: syntheticEmail,
      password: password,
      uid: '',
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate output CSV with credentials
 */
function generateOutputCSV(users: ImportedUser[], outputPath: string): void {
  const header = 'Name,Phone,Password,Email,UID,Success,Error\n';
  const rows = users.map(user =>
    `"${user.name}","${user.phone}","${user.password}","${user.email}","${user.uid}","${user.success}","${user.error || ''}"`
  ).join('\n');

  fs.writeFileSync(outputPath, header + rows, 'utf-8');
  console.log(`\n📄 Output CSV saved to: ${outputPath}`);
}

/**
 * Generate SMS messages file for easy copy-paste
 */
function generateSMSMessages(users: ImportedUser[], outputPath: string): void {
  const successfulUsers = users.filter(u => u.success);

  const messages = successfulUsers.map(user => {
    const message = `שלום ${user.name}! 👋\n\nברוך הבא לאפליקציה של המספרה! 💈\n\nהסיסמה שלך: ${user.password}\n\nהתחבר עם מספר הטלפון שלך והסיסמה.\n\nנתראה במספרה! ✂️`;
    return `=== ${user.name} (${user.phone}) ===\n${message}\n`;
  }).join('\n\n');

  fs.writeFileSync(outputPath, messages, 'utf-8');
  console.log(`📱 SMS messages saved to: ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Please provide CSV file path');
    console.log('\nUsage: npx ts-node scripts/bulkImportLegacyUsers.ts path/to/users.csv');
    console.log('\nCSV Format:');
    console.log('name,phone');
    console.log('ישראל ישראלי,0501234567');
    console.log('משה כהן,0502345678');
    process.exit(1);
  }

  const csvPath = args[0];

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log('\n🚀 Starting bulk import of legacy users...\n');
  console.log(`📂 Reading CSV: ${csvPath}\n`);

  // Parse CSV
  const users = parseCSV(csvPath);
  console.log(`\n📊 Found ${users.length} users to import\n`);

  if (users.length === 0) {
    console.log('❌ No users found in CSV file');
    process.exit(1);
  }

  // Confirm before proceeding
  console.log('⚠️  This will create Firebase Auth users and Firestore documents.');
  console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Import users
  const results: ImportedUser[] = [];

  for (const user of users) {
    const result = await importUser(user);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Generate output files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvOutputPath = path.join(outputDir, `imported-users-${timestamp}.csv`);
  const smsOutputPath = path.join(outputDir, `sms-messages-${timestamp}.txt`);

  generateOutputCSV(results, csvOutputPath);
  generateSMSMessages(results, smsOutputPath);

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${results.length}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Failed users:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name} (${r.phone}): ${r.error}`);
    });
  }

  console.log('\n✅ Import completed!');
  console.log(`\n📄 Files generated:`);
  console.log(`   - CSV: ${csvOutputPath}`);
  console.log(`   - SMS: ${smsOutputPath}`);
  console.log('\n💡 Next steps:');
  console.log('   1. Review the CSV output file');
  console.log('   2. Send SMS messages to users using the generated text file');
  console.log('   3. Users can now login with their phone number and password');
  console.log('\n');

  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
