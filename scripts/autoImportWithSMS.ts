#!/usr/bin/env ts-node

/**
 * 🚀 Automatic Bulk Import + SMS Sender
 *
 * פשוט תשלח CSV ואני אטפל בהכל:
 * 1. יוצר משתמשים ב-Firebase
 * 2. מייצר סיסמאות בנות 6 ספרות
 * 3. שולח SMS אוטומטית לכל לקוח
 * 4. מייצר דוח מסודר
 *
 * Usage:
 * npm run auto-import scripts/customers.csv
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

// SMS4Free Configuration
const SMS_CONFIG = {
  apiKey: 'mgfwkoRBI',
  user: '+972522210281',
  pass: '73960779',
  sender: 'ToriX',
  endpoint: 'https://api.sms4free.co.il/ApiSMS/v2/SendSMS'
};

// App Store Links
const APP_LINKS = {
  ios: 'https://apps.apple.com/app/idXXXXXXXX', // עדכן עם הלינק האמיתי
  android: 'https://play.google.com/store/apps/details?id=com.eilonmatok.app', // עדכן
  universal: 'https://eilonmatok.app' // או לינק אוניברסלי
};

interface LegacyUser {
  name: string;
  phone: string;
}

interface ImportResult {
  name: string;
  phone: string;
  password: string;
  uid: string;
  authCreated: boolean;
  firestoreCreated: boolean;
  smsSent: boolean;
  error?: string;
}

/**
 * Generate 6-digit password
 */
function generatePassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone to +972 format
 */
function normalizePhone(phone: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    return `+972${cleanPhone.substring(1)}`;
  } else if (cleanPhone.startsWith('972')) {
    return `+${cleanPhone}`;
  } else {
    return `+972${cleanPhone}`;
  }
}

/**
 * Convert to Israeli local format (05xxxxxxxx) for SMS
 */
function toLocalPhone(phone: string): string {
  if (phone.startsWith('+972')) {
    return '0' + phone.substring(4);
  }
  return phone;
}

/**
 * Create synthetic email
 */
function createSyntheticEmail(phone: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `${cleanPhone}@eilonmatok.local`;
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): LegacyUser[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  const users: LegacyUser[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header
    if (i === 0 && (line.includes('name') || line.includes('שם'))) {
      continue;
    }

    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const [name, phone] = parts;
      if (name && phone) {
        users.push({ name, phone });
      }
    }
  }

  return users;
}

/**
 * Send SMS via SMS4Free
 */
async function sendSMS(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const localPhone = toLocalPhone(to);

    // Truncate message if too long (SMS4Free limit)
    const truncatedMessage = message.length > 70 ? message.substring(0, 67) + '...' : message;

    const body = {
      key: SMS_CONFIG.apiKey,
      user: SMS_CONFIG.user,
      pass: SMS_CONFIG.pass,
      sender: SMS_CONFIG.sender,
      recipient: localPhone,
      msg: truncatedMessage,
    };

    console.log(`   📱 Sending SMS to ${localPhone}...`);

    const response = await fetch(SMS_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`   ❌ SMS HTTP Error: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = JSON.parse(responseText);

    if (typeof result?.status === 'number' && result.status > 0) {
      console.log(`   ✅ SMS sent successfully (ID: ${result.status})`);
      return { success: true };
    } else {
      console.error(`   ❌ SMS API Error: ${result?.message || 'unknown'}`);
      return { success: false, error: result?.message || 'API error' };
    }
  } catch (error: any) {
    console.error(`   ❌ SMS Exception:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create SMS message for user
 */
function createSMSMessage(name: string, password: string): string {
  const firstName = name.split(' ')[0]; // Use only first name to save space

  // Short message to fit SMS limits
  return `שלום ${firstName}! ברוך הבא למספרה של נאור עמר 💈\nהסיסמה שלך: ${password}\nהורד את האפליקציה: ${APP_LINKS.universal}`;
}

/**
 * Import single user with SMS
 */
async function importUserWithSMS(user: LegacyUser): Promise<ImportResult> {
  const normalizedPhone = normalizePhone(user.phone);
  const syntheticEmail = createSyntheticEmail(normalizedPhone);
  const password = generatePassword();

  const result: ImportResult = {
    name: user.name,
    phone: normalizedPhone,
    password: password,
    uid: '',
    authCreated: false,
    firestoreCreated: false,
    smsSent: false,
  };

  try {
    console.log(`\n👤 Processing: ${user.name} (${normalizedPhone})`);

    // Check if user exists
    const existingUsers = await db.collection('users')
      .where('phone', '==', normalizedPhone)
      .get();

    if (!existingUsers.empty) {
      console.log(`   ⚠️  User already exists - skipping`);
      result.error = 'User already exists';
      return result;
    }

    // 1. Create Firebase Auth user
    try {
      const userRecord = await auth.createUser({
        email: syntheticEmail,
        password: password,
        displayName: user.name,
        phoneNumber: normalizedPhone,
      });
      result.uid = userRecord.uid;
      result.authCreated = true;
      console.log(`   ✅ Auth created (${userRecord.uid})`);
    } catch (error: any) {
      console.error(`   ❌ Auth creation failed:`, error.message);
      result.error = `Auth: ${error.message}`;
      return result;
    }

    // 2. Create Firestore document
    try {
      await db.collection('users').doc(result.uid).set({
        uid: result.uid,
        name: user.name,
        phone: normalizedPhone,
        email: syntheticEmail,
        type: 'client',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isLegacyUser: true,
        legacyImportedAt: admin.firestore.FieldValue.serverTimestamp(),
        firstLoginCompleted: false,
      });
      result.firestoreCreated = true;
      console.log(`   ✅ Firestore created`);
    } catch (error: any) {
      console.error(`   ❌ Firestore creation failed:`, error.message);
      result.error = `Firestore: ${error.message}`;
      return result;
    }

    // 3. Send SMS with password
    const smsMessage = createSMSMessage(user.name, password);
    const smsResult = await sendSMS(normalizedPhone, smsMessage);

    if (smsResult.success) {
      result.smsSent = true;
      console.log(`   ✅ Complete! User created and SMS sent`);
    } else {
      result.error = `SMS failed: ${smsResult.error}`;
      console.log(`   ⚠️  User created but SMS failed: ${smsResult.error}`);
    }

    return result;
  } catch (error: any) {
    console.error(`   ❌ Unexpected error:`, error.message);
    result.error = error.message;
    return result;
  }
}

/**
 * Generate CSV report
 */
function generateReport(results: ImportResult[], outputPath: string): void {
  const header = 'Name,Phone,Password,UID,Auth,Firestore,SMS,Error\n';
  const rows = results.map(r =>
    `"${r.name}","${r.phone}","${r.password}","${r.uid}","${r.authCreated}","${r.firestoreCreated}","${r.smsSent}","${r.error || ''}"`
  ).join('\n');

  fs.writeFileSync(outputPath, header + rows, 'utf-8');
}

/**
 * Generate summary report
 */
function generateSummaryReport(results: ImportResult[], outputPath: string): void {
  const total = results.length;
  const successful = results.filter(r => r.authCreated && r.firestoreCreated && r.smsSent).length;
  const partialSuccess = results.filter(r => r.authCreated && r.firestoreCreated && !r.smsSent).length;
  const failed = results.filter(r => !r.authCreated).length;

  const failedUsers = results.filter(r => !r.smsSent);

  let summary = '';
  summary += '=' .repeat(60) + '\n';
  summary += '📊 IMPORT SUMMARY\n';
  summary += '='.repeat(60) + '\n';
  summary += `✅ Fully Successful: ${successful} (Created + SMS sent)\n`;
  summary += `⚠️  Partial Success: ${partialSuccess} (Created but SMS failed)\n`;
  summary += `❌ Failed: ${failed}\n`;
  summary += `📋 Total: ${total}\n`;
  summary += '='.repeat(60) + '\n\n';

  if (partialSuccess > 0) {
    summary += '⚠️  Users created but SMS not sent (send manually):\n\n';
    failedUsers.forEach(r => {
      if (r.authCreated) {
        summary += `${r.name} (${r.phone}): ${r.password}\n`;
        summary += `Message: ${createSMSMessage(r.name, r.password)}\n\n`;
      }
    });
  }

  if (failed > 0) {
    summary += '\n❌ Failed Users:\n\n';
    results.filter(r => !r.authCreated).forEach(r => {
      summary += `${r.name} (${r.phone}): ${r.error}\n`;
    });
  }

  fs.writeFileSync(outputPath, summary, 'utf-8');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('\n❌ Error: Please provide CSV file path\n');
    console.log('Usage: npm run auto-import scripts/customers.csv\n');
    console.log('CSV Format:');
    console.log('name,phone');
    console.log('דוד כהן,0501234567');
    console.log('משה לוי,0502345678\n');
    process.exit(1);
  }

  const csvPath = args[0];

  if (!fs.existsSync(csvPath)) {
    console.error(`\n❌ Error: File not found: ${csvPath}\n`);
    process.exit(1);
  }

  console.log('\n🚀 Starting AUTOMATIC bulk import + SMS sending...\n');
  console.log(`📂 Reading CSV: ${csvPath}\n`);

  // Parse CSV
  const users = parseCSV(csvPath);
  console.log(`📊 Found ${users.length} users to import\n`);

  if (users.length === 0) {
    console.log('❌ No users found in CSV file\n');
    process.exit(1);
  }

  // Confirm
  console.log('⚠️  This will:');
  console.log('   1. Create Firebase Auth users');
  console.log('   2. Create Firestore documents');
  console.log('   3. Send SMS to each user with password and app link');
  console.log('\n⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Import with SMS
  const results: ImportResult[] = [];

  for (const user of users) {
    const result = await importUserWithSMS(user);
    results.push(result);

    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds between users
  }

  // Generate reports
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const outputDir = path.join(__dirname, 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvOutputPath = path.join(outputDir, `import-report-${timestamp}.csv`);
  const summaryOutputPath = path.join(outputDir, `import-summary-${timestamp}.txt`);

  generateReport(results, csvOutputPath);
  generateSummaryReport(results, summaryOutputPath);

  // Print summary
  const successful = results.filter(r => r.authCreated && r.firestoreCreated && r.smsSent).length;
  const partialSuccess = results.filter(r => r.authCreated && r.firestoreCreated && !r.smsSent).length;
  const failed = results.filter(r => !r.authCreated).length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Fully Successful: ${successful} (Created + SMS sent)`);
  console.log(`⚠️  Partial Success: ${partialSuccess} (Created but SMS failed)`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${results.length}`);
  console.log('='.repeat(60));

  console.log('\n📄 Reports generated:');
  console.log(`   - CSV: ${csvOutputPath}`);
  console.log(`   - Summary: ${summaryOutputPath}`);

  if (partialSuccess > 0) {
    console.log('\n⚠️  Some SMS messages failed to send.');
    console.log('   Check the summary file for users who need manual SMS.\n');
  }

  console.log('\n✅ Import completed!\n');

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
