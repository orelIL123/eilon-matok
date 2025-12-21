#!/usr/bin/env node

/**
 * Create Admin User for Eilon Matok
 * 
 * Creates an admin user with phone number 0522210281 and password 112233
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

async function createEilonAdmin() {
  console.log('🔐 Creating Admin User: אילון מתוק\n');
  
  const adminData = {
    phone: '+972508315002',
    phoneLocal: '0508315002',
    displayName: 'אילון מתוק',
    email: '972508315002@eilonmatok.app', // Auto-generated email from phone
    password: '112233',
  };
  
  try {
    // Check if user already exists by email
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminData.email);
      console.log('⚠️  User already exists in Authentication');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        console.log('📝 Creating new user in Firebase Auth...');
        userRecord = await auth.createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.displayName,
          phoneNumber: adminData.phone,
          emailVerified: true,
        });
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
    await db.collection('users').doc(userId).set({
      uid: userId,
      email: adminData.email,
      displayName: adminData.displayName,
      name: adminData.displayName,
      phone: adminData.phone,
      isAdmin: true,
      isBarber: true,
      hasPassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
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
    console.log(`טלפון:    ${adminData.phone} (או ${adminData.phoneLocal})`);
    console.log(`סיסמה:    ${adminData.password}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ אילון מתוק הוא עכשיו אדמין ויכול להתחבר!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    process.exit(1);
  }
}

createEilonAdmin();

