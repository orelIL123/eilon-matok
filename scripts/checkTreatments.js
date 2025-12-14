/**
 * Check if treatments exist in database
 */

const admin = require('firebase-admin');

// Load service account
const serviceAccount = require('../gal-shemesh-firebase-adminsdk-fbsvc-a1bc48ced4.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTreatments() {
  console.log('🔍 Checking treatments and barbers...\n');
  
  // Check treatments
  console.log('💇 Checking treatments collection...');
  try {
    const treatmentsSnapshot = await db.collection('treatments').get();
    if (treatmentsSnapshot.empty) {
      console.log('❌ No treatments found in database!');
    } else {
      console.log(`✅ Found ${treatmentsSnapshot.size} treatments:`);
      treatmentsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name}: ₪${data.price}`);
      });
    }
  } catch (error) {
    console.log('❌ Error checking treatments:', error.message);
  }
  
  // Check barbers
  console.log('\n👨‍🦱 Checking barbers collection...');
  try {
    const barbersSnapshot = await db.collection('barbers').get();
    if (barbersSnapshot.empty) {
      console.log('⚠️ No barbers found in database (this is normal if you\'re adding the first one)');
    } else {
      console.log(`✅ Found ${barbersSnapshot.size} barbers:`);
      barbersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name}`);
      });
    }
  } catch (error) {
    console.log('❌ Error checking barbers:', error.message);
  }
  
  process.exit(0);
}

checkTreatments();

