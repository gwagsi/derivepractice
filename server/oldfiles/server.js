
import express from 'express';
import fs from 'fs';
import cors from 'cors';
 

const app = express();
app.use(cors());
const port = process.env.PORT || 3000; // Use environment variable or default to 3000

app.get('/prices', (req, res) => {
    console.log('Request received');
  fs.readFile('prices.json', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      res.status(500).send('Error retrieving data');
    } else {
        console.log('Data read');
      
      try {
        const prices = JSON.parse(data);
       const reversePrice = prices.reverse();
        let percentageDifferences = [];
        let count = 0;
     // Iterate over the array, skipping the last value because it has no following value
for (let i = 1; i < reversePrice.length - 1; i++) {
    // Calculate the percentage difference between the current value and the one after it
    let percentageDifference = ((reversePrice[i] - reversePrice[i - 1]) / reversePrice[i + 1]) * 100;
    const within_limit = Math.abs(percentageDifference) <= 0.02431;
  
if (within_limit) {
    count++;
    }
    else {
        percentageDifferences.unshift(count);
    count = 0;
    }
 
  }

  
  // Now percentageDifferences contains the percentage differences between each value and the one after it, starting from the last value
  console.log(percentageDifferences);
  

        res.status(200).json(percentageDifferences); // Send the price data as JSON
      } catch (error) {
        console.error('Error parsing JSON:', error);
        res.status(400).send('Invalid data format');
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
