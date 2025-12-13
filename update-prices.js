const admin = require('firebase-admin');

// GitHub Secrets থেকে ফায়ারবেস একাউন্ট এর তথ্য নেওয়া হবে
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amar-bazar-dor-default-rtdb.firebaseio.com"
});

const db = admin.database();
const productsRef = db.ref('products');

async function updatePrices() {
  try {
    const snapshot = await productsRef.once('value');
    if (!snapshot.exists()) {
      console.log("No products found.");
      process.exit(0);
    }

    const updates = {};
    
    snapshot.forEach((childSnapshot) => {
      const product = childSnapshot.val();
      const key = childSnapshot.key;
      
      // শুধুমাত্র 'active' স্ট্যাটাসের পণ্যগুলোর দাম পরিবর্তন হবে
      if (product.status === 'active') {
          // বর্তমান দাম নেওয়া হচ্ছে (যদি না থাকে তবে ডিফল্ট ১০০ ধরা হবে)
          let currentLow = parseInt(product.lowest_price) || 100;
          let currentHigh = parseInt(product.highest_price) || 120;

          // দাম কমানো বা বাড়ানোর লজিক (র‍্যান্ডম -৫ থেকে +১০ টাকা)
          const fluctuation = Math.floor(Math.random() * 16) - 5; 

          let newLow = currentLow + fluctuation;
          let newHigh = currentHigh + fluctuation;

          // দাম যেন কখনো ১০ টাকার নিচে না নামে এবং লজিক ঠিক থাকে
          if (newLow < 10) newLow = 10;
          if (newHigh <= newLow) newHigh = newLow + 5;

          // আপডেটের জন্য ডাটা প্রস্তুত করা হচ্ছে
          updates[`/products/${key}/lowest_price`] = newLow;
          updates[`/products/${key}/highest_price`] = newHigh;
          
          // ইউজার অ্যাপে দেখানোর জন্য যে সময় আপডেট হলো তা সেট করা (UTC format)
          updates[`/products/${key}/effective_date`] = new Date().toISOString();
      }
    });

    // ডাটাবেসে আপডেট পাঠানো
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        console.log("Successfully updated product prices.");
    } else {
        console.log("No active products to update.");
    }
    
    process.exit(0);

  } catch (error) {
    console.error("Error updating prices:", error);
    process.exit(1);
  }
}

updatePrices();
