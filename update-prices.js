const admin = require('firebase-admin');

// GitHub Secrets থেকে ফায়ারবেস একাউন্ট এর তথ্য নেওয়া হচ্ছে
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
          // বর্তমান দাম নেওয়া হচ্ছে। parseFloat ব্যবহার করা হয়েছে যাতে টেক্সট থাকলেও কাজ করে।
          let currentLow = parseFloat(product.lowest_price) || 0;
          let currentHigh = parseFloat(product.highest_price) || 0;

          // যদি কোনো কারণে দাম ০ থাকে, তবে ডিফল্ট একটা দাম সেট হবে
          if (currentLow <= 0) currentLow = 50;
          if (currentHigh <= 0) currentHigh = 60;

          // দামের পরিবর্তন (৫ থেকে ১৫ টাকার মধ্যে)
          const changeAmount = Math.floor(Math.random() * 11) + 5; 
          
          // সিদ্ধান্ত নেওয়া: দাম বাড়বে নাকি কমবে? (৫০% চান্স)
          const isIncrease = Math.random() < 0.5;

          let newLow, newHigh;

          if (isIncrease) {
              newLow = currentLow + changeAmount;
              newHigh = currentHigh + changeAmount;
          } else {
              newLow = currentLow - changeAmount;
              newHigh = currentHigh - changeAmount;
          }

          // সেফটি চেক: দাম যেন কখনো অবাস্তব (যেমন ১০ টাকার নিচে) না নামে
          if (newLow < 20) newLow = 20;
          
          // সর্বোচ্চ দাম যেন সবসময় সর্বনিম্ন দামের চেয়ে অন্তত ৫ টাকা বেশি থাকে
          if (newHigh <= newLow) newHigh = newLow + 5;

          // আপডেটের জন্য ডাটা প্রস্তুত করা (Math.round দিয়ে পূর্ণসংখ্যা করা হয়েছে)
          updates[`/products/${key}/lowest_price`] = Math.round(newLow);
          updates[`/products/${key}/highest_price`] = Math.round(newHigh);
          
          // সময় আপডেট (ISO ফরম্যাটে) - এটি ইউজার অ্যাপে 'কতক্ষণ আগে' দেখাবে
          updates[`/products/${key}/effective_date`] = new Date().toISOString();
      }
    });

    // ডাটাবেসে আপডেট পাঠানো
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        console.log("Successfully updated prices (Realistic range 5-15 TK).");
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
