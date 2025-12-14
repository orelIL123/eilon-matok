const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');
const { getStorage } = require('firebase/storage');

const firebaseConfig = {
  apiKey: "AIzaSyBiDFQNbnExTE03YS_6xoNE6_RrX4HBN4Q",
  authDomain: "barber-app-template.firebaseapp.com",
  projectId: "barber-app-template",
  storageBucket: "barber-app-template.firebasestorage.app",
  messagingSenderId: "246646930767",
  appId: "1:246646930767:web:d1bdd3b156eda443f2193a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const demoShopItems = [
  {
    name: "שמפו מקצועי לגברים",
    description: "שמפו איכותי המיועד לשיער גברים, עשיר בויטמינים ומינרלים לטיפוח יומיומי.",
    price: 45,
    category: "מוצרי שיער",
    imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400&h=400&fit=crop",
    stock: 15,
    isActive: true
  },
  {
    name: "פומד עיצוב חזק",
    description: "פומד להחזקה חזקה ומראה מבריק, מתאים לכל סוגי העיצובים.",
    price: 35,
    category: "מוצרי עיצוב",
    imageUrl: "https://images.unsplash.com/photo-1503803548695-c2a7b4a5b875?w=400&h=400&fit=crop",
    stock: 20,
    isActive: true
  },
  {
    name: "שמן זקן טבעי",
    description: "שמן זקן טבעי לטיפוח והזנה, מעניק ריח נפלא ומרכך את הזקן.",
    price: 55,
    category: "טיפוח זקן",
    imageUrl: "https://images.unsplash.com/photo-1506629905496-4d1b902ee0f7?w=400&h=400&fit=crop",
    stock: 8,
    isActive: true
  },
  {
    name: "קרם לחות לפנים",
    description: "קרם מיוחד לגברים, מרטיב ומגן על העור לאחר הגילוח.",
    price: 40,
    category: "טיפוח פנים",
    imageUrl: "https://images.unsplash.com/photo-1556228578-dd6e12104d89?w=400&h=400&fit=crop",
    stock: 12,
    isActive: true
  },
  {
    name: "ג'ל עיצוב קל",
    description: "ג'ל עיצוב להחזקה קלה-בינונית, נותן מראה טבעי ולא דביק.",
    price: 28,
    category: "מוצרי עיצוב",
    imageUrl: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=400&h=400&fit=crop",
    stock: 25,
    isActive: true
  },
  {
    name: "בושם לגבר - מאסק",
    description: "בושם עדין ואלגנטי לגבר מודרני, בושם יוקרתי בעל נפח מיוחד.",
    price: 120,
    category: "בשמים",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop",
    stock: 5,
    isActive: true
  }
];

async function addDemoShopItems() {
  console.log('🛍️ Adding demo shop items...');
  
  try {
    for (const item of demoShopItems) {
      const docRef = await addDoc(collection(db, 'shopItems'), {
        ...item,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log(`✅ Added: ${item.name} (${docRef.id})`);
    }
    
    console.log(`🎉 Successfully added ${demoShopItems.length} shop items!`);
    console.log('🛒 Shop is now ready with products that can be ordered via WhatsApp!');
    
  } catch (error) {
    console.error('❌ Error adding shop items:', error);
  }
}

addDemoShopItems();