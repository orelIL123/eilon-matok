const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBiDFQNbnExTE03YS_6xoNE6_RrX4HBN4Q",
  authDomain: "barber-app-template.firebaseapp.com",
  projectId: "barber-app-template",
  storageBucket: "barber-app-template.firebasestorage.app",
  messagingSenderId: "246646930767",
  appId: "1:246646930767:web:d1bdd3b156eda443f2193a",
  measurementId: "G-S6VSPNP5LH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedData = async () => {
  try {
    console.log('Starting to seed data...');
    
    // Check if data already exists
    const barbersSnapshot = await getDocs(collection(db, 'barbers'));
    const treatmentsSnapshot = await getDocs(collection(db, 'treatments'));
    
    // Add barbers only if they don't exist
    if (barbersSnapshot.empty) {
      console.log('Adding barbers...');
      const barbers = [
      {
        name: "אילון מתוק",
        experience: "15 שנות ניסיון",
        rating: 5.0,
        available: true,
        specialties: ["תספורת מקצועית", "עיצוב זקן", "טיפוח גברי", "תספורת מודרנית"],
        image: ""
      }
    ];

      for (const barber of barbers) {
        await addDoc(collection(db, 'barbers'), barber);
        console.log(`Added barber: ${barber.name}`);
      }
    } else {
      console.log('Barbers already exist, skipping...');
    }

    // Add treatments only if they don't exist
    if (treatmentsSnapshot.empty) {
      console.log('Adding treatments...');
      const treatments = [
      {
        name: "תספורת קלאסית",
        description: "תספורת גברים קלאסית עם גימור מושלם",
        price: 80,
        duration: 45,
        image: ""
      },
      {
        name: "עיצוב זקן",
        description: "עיצוב וגימור זקן מקצועי",
        price: 60,
        duration: 25,
        image: ""
      },
      {
        name: "תספורת + זקן",
        description: "פקאג' שלם - תספורת ועיצוב זקן",
        price: 120,
        duration: 60,
        image: ""
      },
      {
        name: "טיפוח פנים",
        description: "טיפוח פנים מקצועי לגברים",
        price: 100,
        duration: 50,
        image: ""
      }
    ];

      for (const treatment of treatments) {
        await addDoc(collection(db, 'treatments'), treatment);
        console.log(`Added treatment: ${treatment.name}`);
      }
    } else {
      console.log('Treatments already exist, skipping...');
    }

    // Add gallery images
    const galleryImages = [
      {
        title: "תספורת 1",
        url: "",
        category: "תספורת"
      },
      {
        title: "עיצוב זקן 1",
        url: "",
        category: "זקן"
      },
      {
        title: "תספורת 2",
        url: "",
        category: "תספורת"
      },
      {
        title: "עיצוב זקן 2",
        url: "",
        category: "זקן"
      }
    ];

    for (const image of galleryImages) {
      await addDoc(collection(db, 'gallery'), image);
    }

    console.log('✅ Sample data seeded successfully!');
    console.log('Data includes:');
    console.log('- 3 barbers');
    console.log('- 4 treatments');
    console.log('- 4 gallery images');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
};

// Run the seed function
seedData();