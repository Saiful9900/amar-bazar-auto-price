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
    const currentTime = new Date().toISOString(); // দাম পরিবর্তনের সঠিক সময় (ISO Format)

    snapshot.forEach((childSnapshot) => {
      const product = childSnapshot.val();
      const key = childSnapshot.key;
      
      // শুধুমাত্র 'active' পণ্যের দাম পরিবর্তন হবে
      if (product.status === 'active') {
          
          // ১. বর্তমান দাম নেওয়া হচ্ছে
          let currentLow = parseFloat(product.lowest_price) || 0;
          let currentHigh = parseFloat(product.highest_price) || 0;

          // ২. বেস প্রাইস লজিক (দাম নিয়ন্ত্রণ করার জন্য)
          // যদি ডাটাবেসে base_price না থাকে, তবে বর্তমান দামকেই বেস ধরা হবে
          let baseLow = parseFloat(product.base_price_low) || currentLow;
          let baseHigh = parseFloat(product.base_price_high) || currentHigh;

          // ৩. দামের পরিবর্তন (২ থেকে ৫ টাকার মধ্যে - যা বাজারের জন্য স্বাভাবিক)
          const changeAmount = Math.floor(Math.random() * 4) + 2; 
          
          // ৪. দাম নিয়ন্ত্রণের স্মার্ট লজিক:
          let isIncrease;
          
          // দাম যদি বেস প্রাইস থেকে ১০ টাকা বেড়ে যায়, তবে কমানোর সিদ্ধান্ত নেবে
          if (currentLow > (baseLow + 10)) {
              isIncrease = false;
          } 
          // দাম যদি বেস প্রাইস থেকে ১০ টাকা কমে যায়, তবে বাড়ানোর সিদ্ধান্ত নেবে
          else if (currentLow < (baseLow - 10)) {
              isIncrease = true;
          } 
          // মাঝামাঝি থাকলে র্যান্ডমলি বাড়বে বা কমবে
          else {
              isIncrease = Math.random() < 0.5;
          }

          let newLow, newHigh;

          if (isIncrease) {
              newLow = currentLow + changeAmount;
              newHigh = currentHigh + changeAmount;
          } else {
              newLow = currentLow - changeAmount;
              newHigh = currentHigh - changeAmount;
          }

          // ৫. অতিরিক্ত সুরক্ষা: দাম যেন আসল দাম (Base Price) থেকে ২০ টাকার বেশি পার্থক্য না হয়
          if (newLow > (baseLow + 20)) newLow = baseLow + 15;
          if (newLow < (baseLow - 20)) newLow = baseLow - 15;
          
          // ৬. যদি কোনো পণ্যের দাম আপনার স্ক্রিনশটের মতো ভুলবশত অনেক বেশি (যেমন ১০০০+) হয়ে থাকে, 
          // তাকে স্বয়ংক্রিয়ভাবে ১০০ টাকার নিচে নিয়ে আসবে (সুরক্ষার জন্য)
          if (newLow > 1000) newLow = 60; 

          // ৭. সর্বোচ্চ দাম সর্বনিম্ন দামের চেয়ে ৫-১০ টাকা বেশি রাখা
          if (newHigh <= newLow) newHigh = newLow + 5;

          // ৮. ডাটাবেস আপডেটের জন্য ডাটা প্রস্তুত করা
          updates[`/products/${key}/lowest_price`] = Math.round(newLow);
          updates[`/products/${key}/highest_price`] = Math.round(newHigh);
          
          // সময় আপডেট: এটি আপনার অ্যাপে "কতক্ষণ আগে" দেখাবে
          updates[`/products/${key}/effective_date`] = currentTime;

          // যদি আগে বেস প্রাইস না থেকে থাকে, তবে প্রথমবার এটি ডাটাবেসে সেভ হবে
          if (!product.base_price_low) {
              updates[`/products/${key}/base_price_low`] = Math.round(currentLow > 1000 ? 50 : currentLow);
              updates[`/products/${key}/base_price_high`] = Math.round(currentHigh > 1000 ? 60 : currentHigh);
          }
      }
    });

    // ডাটাবেসে দাম এবং সময় একসাথে আপডেট পাঠানো
    if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        console.log("দাম এবং সময় সফলভাবে আপডেট হয়েছে।");
    } else {
        console.log("আপডেট করার মতো কোনো একটিভ পণ্য পাওয়া যায়নি।");
    }
    
    process.exit(0);

  } catch (error) {
    console.error("Error updating prices:", error);
    process.exit(1);
  }
}

updatePrices();
