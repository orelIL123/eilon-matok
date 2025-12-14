#!/usr/bin/env node

/**
 * 🔥 Firebase Ultra Setup Script
 * 
 * סקריפט מקיף להגדרת Firebase עבור gal-shemesh
 * 
 * מה הסקריפט עושה:
 * 1. בודק שהקבצים הנכונים קיימים
 * 2. בודק חיבור ל-Firebase
 * 3. יוצר את מבנה ה-Firestore Collections
 * 4. מגדיר הגדרות עסק בסיסיות
 * 5. יוצר טיפולים בסיסיים
 * 
 * Usage: npm run setup-firebase-ultra
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step} ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Check if firebase-admin-key.json exists
function checkFiles() {
  logStep('📁', 'בודק קבצים...');
  
  const adminKeyPath = path.join(__dirname, '..', 'firebase-admin-key.json');
  
  if (!fs.existsSync(adminKeyPath)) {
    logError('קובץ firebase-admin-key.json לא נמצא!');
    logWarning('אנא וודא שהקובץ קיים בתיקייה הראשית של הפרויקט');
    process.exit(1);
  }
  
  logSuccess('קובץ firebase-admin-key.json נמצא');
  return adminKeyPath;
}

// Initialize Firebase Admin
function initializeFirebase(adminKeyPath) {
  logStep('🔥', 'מתחבר ל-Firebase...');
  
  try {
    const serviceAccount = require(adminKeyPath);
    
    // Check if already initialized
    if (admin.apps.length > 0) {
      logWarning('Firebase כבר מאותחל, משתמש באפליקציה קיימת');
      return admin.app();
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    logSuccess(`מחובר לפרויקט: ${serviceAccount.project_id}`);
    return admin.app();
  } catch (error) {
    logError(`שגיאה באתחול Firebase: ${error.message}`);
    process.exit(1);
  }
}

// Test Firebase connection
async function testConnection(db) {
  logStep('🔌', 'בודק חיבור ל-Firestore...');
  
  try {
    // Try to read a collection (even if empty)
    await db.collection('_test').limit(1).get();
    logSuccess('חיבור ל-Firestore עובד!');
    return true;
  } catch (error) {
    logError(`שגיאה בחיבור ל-Firestore: ${error.message}`);
    return false;
  }
}

// Initialize Business Settings
async function initializeBusinessSettings(db) {
  logStep('🏢', 'יוצר הגדרות עסק...');
  
  try {
    const businessSettingsRef = db.collection('businessSettings').doc('main');
    const doc = await businessSettingsRef.get();
    
    if (doc.exists) {
      logWarning('הגדרות עסק כבר קיימות, מדלג...');
      return;
    }
    
    await businessSettingsRef.set({
      businessName: "אילון מתוק",
      ownerName: "אילון מתוק",
      ownerPhone: "+972501234567", // עדכן לפי הצורך
      ownerEmail: "info@galshemesh.com", // עדכן לפי הצורך
      address: "כתובת העסק",
      addressEn: "Business Address",
      workingHours: {
        sunday: { open: "09:00", close: "20:00", closed: false },
        monday: { open: "09:00", close: "20:00", closed: false },
        tuesday: { open: "09:00", close: "20:00", closed: false },
        wednesday: { open: "09:00", close: "20:00", closed: false },
        thursday: { open: "09:00", close: "20:00", closed: false },
        friday: { open: "08:00", close: "14:00", closed: false },
        saturday: { open: "00:00", close: "00:00", closed: true }
      },
      slotDuration: 30, // דקות
      advanceBookingDays: 30,
      cancellationPolicy: "ניתן לבטל עד 24 שעות לפני התור",
      welcomeMessage: "ברוכים הבאים למספרת אילון מתוק!",
      primaryColor: "#8B4513",
      language: "he",
      currency: "ILS",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logSuccess('הגדרות עסק נוצרו בהצלחה');
  } catch (error) {
    logError(`שגיאה ביצירת הגדרות עסק: ${error.message}`);
    throw error;
  }
}

// Initialize Treatments
async function initializeTreatments(db) {
  logStep('✂️', 'יוצר טיפולים...');
  
  try {
    const treatments = [
      {
        treatmentId: "treatment_haircut",
        name: "תספורת גברים",
        nameEn: "Men's Haircut",
        description: "תספורת מקצועית לגברים",
        price: 80,
        duration: 30,
        category: "haircut",
        active: true,
        popularityScore: 100,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        treatmentId: "treatment_haircut_beard",
        name: "תספורת + זקן",
        nameEn: "Haircut + Beard",
        description: "תספורת וגילוח זקן",
        price: 120,
        duration: 60,
        category: "haircut",
        active: true,
        popularityScore: 90,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        treatmentId: "treatment_beard_only",
        name: "זקן בלבד",
        nameEn: "Beard Only",
        description: "גילוח וטיפול בזקן",
        price: 50,
        duration: 30,
        category: "beard",
        active: true,
        popularityScore: 70,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const treatment of treatments) {
      const treatmentRef = db.collection('treatments').doc(treatment.treatmentId);
      const doc = await treatmentRef.get();
      
      if (doc.exists) {
        logWarning(`טיפול "${treatment.name}" כבר קיים, מדלג...`);
        skipped++;
        continue;
      }
      
      await treatmentRef.set(treatment);
      logSuccess(`נוצר טיפול: ${treatment.name} (${treatment.price}₪)`);
      created++;
    }
    
    logSuccess(`נוצרו ${created} טיפולים חדשים, ${skipped} כבר היו קיימים`);
  } catch (error) {
    logError(`שגיאה ביצירת טיפולים: ${error.message}`);
    throw error;
  }
}

// Create empty collections structure
async function createCollectionsStructure(db) {
  logStep('📚', 'יוצר מבנה Collections...');
  
  const collections = [
    'appointments',
    'barbers',
    'gallery',
    'notifications',
    'reviews',
    'statistics',
    'users',
    'waitlist'
  ];
  
  try {
    for (const collectionName of collections) {
      // Just verify the collection exists by trying to read it
      await db.collection(collectionName).limit(1).get();
      logSuccess(`Collection "${collectionName}" מוכן`);
    }
  } catch (error) {
    logWarning(`שגיאה ביצירת Collections: ${error.message}`);
    // Don't throw - collections will be created automatically on first write
  }
}

// Install dependencies
function installDependencies() {
  logStep('📦', 'מתקין תלויות...');
  
  try {
    log('מריץ npm install...', 'cyan');
    execSync('npm install', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    logSuccess('תלויות הותקנו בהצלחה');
    return true;
  } catch (error) {
    logError(`שגיאה בהתקנת תלויות: ${error.message}`);
    return false;
  }
}

// Check for Firebase CLI
function checkFirebaseCLI() {
  try {
    execSync('firebase --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Deploy Firebase rules and indexes
async function deployFirebase(projectId) {
  logStep('🚀', 'מבצע Deploy ל-Firebase...');
  
  if (!checkFirebaseCLI()) {
    logWarning('Firebase CLI לא מותקן. מדלג על Deploy...');
    logWarning('התקן עם: npm install -g firebase-tools');
    logWarning('ואז הרץ: firebase login && firebase use --add');
    return false;
  }
  
  const projectRoot = path.join(__dirname, '..');
  
  try {
    // Set Firebase project if not already set
    log('מגדיר פרויקט Firebase...', 'cyan');
    try {
      execSync(`firebase use ${projectId}`, {
        stdio: 'pipe',
        cwd: projectRoot
      });
      logSuccess(`פרויקט הוגדר: ${projectId}`);
    } catch (error) {
      // Try to add project
      logWarning('פרויקט לא מוגדר, נדרש הגדרה ידנית');
      logWarning(`הרץ: firebase use --add ובחר את הפרויקט ${projectId}`);
      logWarning('או: firebase deploy --project ${projectId} --only firestore:rules,storage:rules');
      return false;
    }
    
    // Deploy Firestore Rules
    log('מעלה Firestore Rules...', 'cyan');
    try {
      execSync('firebase deploy --only firestore:rules', {
        stdio: 'inherit',
        cwd: projectRoot
      });
      logSuccess('Firestore Rules הועלו בהצלחה');
    } catch (error) {
      logWarning(`שגיאה ב-Deploy של Firestore Rules: ${error.message}`);
    }
    
    // Deploy Storage Rules
    log('מעלה Storage Rules...', 'cyan');
    try {
      execSync('firebase deploy --only storage', {
        stdio: 'inherit',
        cwd: projectRoot
      });
      logSuccess('Storage Rules הועלו בהצלחה');
    } catch (error) {
      logWarning(`שגיאה ב-Deploy של Storage Rules: ${error.message}`);
    }
    
    // Deploy Firestore Indexes (if firestore.indexes.json exists)
    const indexesPath = path.join(projectRoot, 'firestore.indexes.json');
    if (fs.existsSync(indexesPath)) {
      log('מעלה Firestore Indexes...', 'cyan');
      try {
        execSync('firebase deploy --only firestore:indexes', {
          stdio: 'inherit',
          cwd: projectRoot
        });
        logSuccess('Firestore Indexes הועלו בהצלחה');
      } catch (error) {
        logWarning(`שגיאה ב-Deploy של Firestore Indexes: ${error.message}`);
      }
    } else {
      logWarning('קובץ firestore.indexes.json לא נמצא, מדלג...');
    }
    
    return true;
  } catch (error) {
    logError(`שגיאה כללית ב-Deploy: ${error.message}`);
    return false;
  }
}

// Main setup function
async function setupFirebaseUltra() {
  log('\n🔥🔥🔥 Firebase Ultra Setup - אילון מתוק 🔥🔥🔥\n', 'bright');
  
  try {
    // Step 1: Install dependencies
    const depsInstalled = installDependencies();
    if (!depsInstalled) {
      logWarning('המשך למרות שגיאות בהתקנת תלויות...');
    }
    
    // Step 2: Check files
    const adminKeyPath = checkFiles();
    
    // Step 3: Initialize Firebase
    const app = initializeFirebase(adminKeyPath);
    const serviceAccount = require(adminKeyPath);
    const db = admin.firestore();
    
    // Step 4: Test connection
    const connected = await testConnection(db);
    if (!connected) {
      process.exit(1);
    }
    
    // Step 5: Initialize Business Settings (with duplicate check)
    await initializeBusinessSettings(db);
    
    // Step 6: Initialize Treatments (with duplicate check)
    await initializeTreatments(db);
    
    // Step 7: Create Collections Structure
    await createCollectionsStructure(db);
    
    // Step 8: Deploy Firebase Rules
    await deployFirebase(serviceAccount.project_id);
    
    // Success!
    log('\n🎉🎉🎉 הגדרת Firebase הושלמה בהצלחה! 🎉🎉🎉\n', 'green');
    log('📝 השלבים הבאים:', 'cyan');
    log('   1. עדכן את פרטי העסק ב-businessSettings/main');
    log('   2. הוסף ספרים ב-collection barbers');
    log('   3. בדוק שהכל עובד באפליקציה');
    log('\n');
    
    process.exit(0);
  } catch (error) {
    logError(`שגיאה כללית: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
setupFirebaseUltra();

