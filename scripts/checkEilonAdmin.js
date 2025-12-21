#!/usr/bin/env node

/**
 * Check Eilon Admin User Status
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

async function checkEilonAdmin() {
  console.log('🔍 Checking Eilon Admin User Status...\n');
  
  const adminEmail = '972508315002@eilonmatok.app';
  
  try {
    // Get user from Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminEmail);
      console.log('✅ User found in Authentication:');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Phone: ${userRecord.phoneNumber || 'Not set'}`);
      console.log(`   Display Name: ${userRecord.displayName || 'Not set'}`);
      
      // Check custom claims
      console.log(`   Custom Claims:`, userRecord.customClaims || 'None');
    } catch (error) {
      console.error('❌ User not found in Authentication:', error.message);
      process.exit(1);
    }
    
    const userId = userRecord.uid;
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('\n❌ User document NOT found in Firestore!');
      console.log('   This is the problem - user needs a Firestore document with isAdmin: true');
    } else {
      const userData = userDoc.data();
      console.log('\n✅ User document found in Firestore:');
      console.log(`   isAdmin: ${userData.isAdmin || false}`);
      console.log(`   isBarber: ${userData.isBarber || false}`);
      console.log(`   displayName: ${userData.displayName || 'N/A'}`);
      console.log(`   phone: ${userData.phone || 'N/A'}`);
      console.log(`   email: ${userData.email || 'N/A'}`);
      
      if (!userData.isAdmin) {
        console.log('\n⚠️  PROBLEM: isAdmin is false or missing!');
        console.log('   This needs to be set to true for upload permissions.');
      } else {
        console.log('\n✅ User is correctly set as admin in Firestore');
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Summary:');
    console.log(`   Auth User: ${userRecord ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   Firestore Doc: ${userDoc.exists ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   isAdmin: ${userDoc.exists && userDoc.data().isAdmin ? '✅ True' : '❌ False/Missing'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error checking admin user:', error);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Error message: ${error.message}`);
    }
    process.exit(1);
  }
}

checkEilonAdmin();
