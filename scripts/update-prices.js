const fs = require('fs');
const path = require('path');

async function fetchLatestPrices() {
    const samplePrices = {
        'মিনিকেট চাল': { lowest: 72, highest: 80 },
        'মসুর ডাল': { lowest: 135, highest: 145 },
        'সয়াবিন তেল': { lowest: 160, highest: 165 },
        'আলু': { lowest: 45, highest: 55 },
        'পেঁয়াজ': { lowest: 85, highest: 95 },
        'গরুর মাংস': { lowest: 780, highest: 800 },
        'খাসির মাংস': { lowest: 1100, highest: 1180 },
        'মুরগির মাংস (ব্রয়লার)': { lowest: 210, highest: 230 },
        'মুরগির ডিম': { lowest: 48, highest: 52 },
        'ইলিশ মাছ': { lowest: 1300, highest: 1850 },
        'রুই মাছ': { lowest: 380, highest: 480 },
    };

    for (const product in samplePrices) {
        const randomChange = Math.floor(Math.random() * 5) - 2;
        samplePrices[product].lowest += randomChange;
        samplePrices[product].highest += randomChange;
    }
    
    return samplePrices;
}

async function updateHtmlFile() {
    try {
        const latestPrices = await fetchLatestPrices();
        const htmlFilePath = path.join(__dirname, '..', 'index.html');
        
        let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
        let changesMade = 0;

        for (const productName in latestPrices) {
            const newPrices = latestPrices[productName];
            const searchRegex = new RegExp(`(name: '${productName}'[\\s\\S]*?lowest_price: )\\d+(,[\\s\\S]*?highest_price: )\\d+`, 'g');
            
            if (htmlContent.match(searchRegex)) {
                htmlContent = htmlContent.replace(searchRegex, `$1${newPrices.lowest}$2${newPrices.highest}`);
                console.log(`Updated price for: ${productName}`);
                changesMade++;
            }
        }
        
        if (changesMade > 0) {
            fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
            console.log(`Successfully updated ${changesMade} prices.`);
        }

    } catch (error) {
        console.error("Error updating prices:", error);
        process.exit(1);
    }
}

updateHtmlFile();
