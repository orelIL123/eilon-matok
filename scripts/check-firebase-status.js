#!/usr/bin/env node

/**
 * בדיקת סטטוס Firebase - מה כבר קיים
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccount = require(path.join(__dirname, '..', 'firebase-admin-key.json'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function checkStatus() {
  console.log('\n🔍 בודק מה כבר קיים ב-Firebase...\n');
  
  try {
    // Check Business Settings
    const businessSettingsRef = db.collection('businessSettings').doc('main');
    const businessDoc = await businessSettingsRef.get();
    
    if (businessDoc.exists) {
      console.log('✅ הגדרות עסק קיימות:');
      const data = businessDoc.data();
      console.log(`   שם עסק: ${data.businessName || 'לא מוגדר'}`);
      console.log(`   טלפון: ${data.ownerPhone || 'לא מוגדר'}`);
      console.log(`   אימייל: ${data.ownerEmail || 'לא מוגדר'}`);
      console.log(`   משך תור: ${data.slotDuration || 'לא מוגדר'} דקות`);
    } else {
      console.log('❌ אין הגדרות עסק');
    }
    
    // Check Treatments
    const treatmentsSnapshot = await db.collection('treatments').get();
    console.log(`\n✅ טיפולים: ${treatmentsSnapshot.size} טיפולים קיימים`);
    
    if (treatmentsSnapshot.size > 0) {
      treatmentsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name} (${data.price}₪, ${data.duration} דקות)`);
      });
    }
    
    // Check Barbers
    const barbersSnapshot = await db.collection('barbers').get();
    console.log(`\n✅ ספרים: ${barbersSnapshot.size} ספרים קיימים`);
    
    if (barbersSnapshot.size > 0) {
      barbersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name || doc.id}`);
      });
    }
    
    // Check Users
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n✅ משתמשים: ${usersSnapshot.size} משתמשים קיימים`);
    
    // Check Appointments
    const appointmentsSnapshot = await db.collection('appointments').get();
    console.log(`\n✅ תורים: ${appointmentsSnapshot.size} תורים קיימים`);
    
    // Check Collections
    console.log('\n📚 Collections קיימות:');
    const collections = [
      'appointments', 'barbers', 'gallery', 'notifications',
      'reviews', 'statistics', 'users', 'waitlist', 'treatments', 'businessSettings'
    ];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).limit(1).get();
        console.log(`   ✅ ${collectionName}: ${snapshot.size > 0 ? 'יש נתונים' : 'ריק'}`);
      } catch (error) {
        console.log(`   ❌ ${collectionName}: שגיאה`);
      }
    }
    
    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    process.exit(1);
  }
}

checkStatus();

