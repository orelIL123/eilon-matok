#!/usr/bin/env node

/**
 * Create New Admin User
 * 
 * Creates a new admin user with custom details
 * Usage: node scripts/createNewAdmin.js
 * 
 * You can modify the adminData object below with the desired details
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-admin-key.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createNewAdmin() {
  console.log('🔐 Creating New Admin User\n');
  
  // ============================================
  // Admin User Details - משתמש חדש
  // ============================================
  const adminData = {
    email: '972523985505@eilonmatok.app',  // Email based on phone number
    password: '112233',                     // Password
    displayName: 'מנהל חדש',              // Display name
    phone: '+972523985505',                 // Phone number with country code
    phoneLocal: '0523985505',               // Local phone format
  };
  // ============================================
  
  try {
    // Check if user already exists by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminData.email);
      console.log('⚠️  User already exists in Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log('\n📝 Updating existing user to admin...');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user in Firebase Auth...');
        const createUserData = {
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.displayName,
          emailVerified: true,
        };
        
        if (adminData.phone) {
          createUserData.phoneNumber = adminData.phone;
        }
        
        userRecord = await auth.createUser(createUserData);
        console.log('✅ User created in Firebase Authentication!');
        console.log(`   UID: ${userRecord.uid}`);
        console.log(`   Email: ${adminData.email}`);
      } else {
        throw error;
      }
    }
    
    const userId = userRecord.uid;
    
    // Check if user document exists in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      console.log('\n⚠️  User document already exists in Firestore');
      console.log('   Updating to admin status...');
    } else {
      console.log('\n📝 Creating user document in Firestore...');
    }
    
    // Create/update user document in Firestore
    const userDocumentData = {
      uid: userId,
      email: adminData.email,
      displayName: adminData.displayName,
      name: adminData.displayName,
      isAdmin: true,
      isBarber: true, // Can also manage barbers
      hasPassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (adminData.phone) {
      userDocumentData.phone = adminData.phone;
      userDocumentData.phoneLocal = adminData.phoneLocal || adminData.phone;
    }
    
    await db.collection('users').doc(userId).set(userDocumentData, { merge: true });
    
    console.log('✅ User document created/updated in Firestore');
    
    // Set custom claims for admin access
    console.log('\n🔑 Setting custom claims...');
    await auth.setCustomUserClaims(userId, {
      admin: true,
      barber: true
    });
    console.log('✅ Custom claims set successfully');
    
    console.log('\n🎉 Admin user setup complete!');
    console.log('\n📋 פרטי התחברות:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`אימייל:   ${adminData.email}`);
    console.log(`סיסמה:   ${adminData.password}`);
    if (adminData.phone) {
      console.log(`טלפון:   ${adminData.phone} (או ${adminData.phoneLocal})`);
    }
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ המשתמש הוא עכשיו אדמין ויכול להתחבר!');
    console.log('\n💡 חשוב: שמור את הפרטים האלה במקום בטוח!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

createNewAdmin();

