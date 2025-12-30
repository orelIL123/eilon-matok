#!/usr/bin/env node
/**
 * Create Admin User: appadmin
 *
 * Usage:
 *   node scripts/createAppAdmin.js
 *
 * Creates/updates a Firebase Auth user + Firestore user doc with isAdmin: true
 * and sets custom claims: { admin: true, barber: true }
 */
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin using the project's service account
const serviceAccount = require(path.join(__dirname, '../firebase-admin-key.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createAppAdmin() {
  console.log('🔐 Creating Admin User: appadmin\n');

  // ============================================
  // Admin User Details
  // ============================================
  const adminData = {
    email: 'appadmin@eilonmatok.app',
    password: 'AppAdmin123!',
    displayName: 'appadmin',
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
        console.log('📝 Creating new user in Firebase Auth...');
        userRecord = await auth.createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.displayName,
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

    // Create/update user document in Firestore
    await db.collection('users').doc(userId).set(
      {
        uid: userId,
        email: adminData.email,
        displayName: adminData.displayName,
        name: adminData.displayName,
        isAdmin: true,
        isBarber: true,
        hasPassword: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log('✅ User document created/updated in Firestore');

    // Set custom claims for admin access
    console.log('\n🔑 Setting custom claims...');
    await auth.setCustomUserClaims(userId, {
      admin: true,
      barber: true,
    });
    console.log('✅ Custom claims set successfully');

    console.log('\n🎉 Admin user setup complete!');
    console.log('\n📋 Login Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log(`UID:      ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    if (error.code) console.error(`   Error code: ${error.code}`);
    if (error.message) console.error(`   Error message: ${error.message}`);
    process.exit(1);
  }
}

createAppAdmin();


