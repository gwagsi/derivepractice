 
// import { createObjectCsvWriter as createCsvWriter } from './csv-writer';
//const createObjectCsvWriter  = require("csv-write")  ;
import {createObjectCsvWriter} from 'https://cdn.jsdelivr.net/npm/csv-writer@1.6.0/dist/index.min.js';

export function saveTickDataToCsv(tickData) {
  const csvWriter = createObjectCsvWriter({
    path: 'tickData.csv',
    header: [
      {id: 'ask', title: 'ASK'},
      {id: 'bid', title: 'BID'},
      {id: 'epoch', title: 'EPOCH'},
      {id: 'id', title: 'ID'},
      {id: 'pip_size', title: 'PIP_SIZE'},
      {id: 'quote', title: 'QUOTE'},
      {id: 'symbol', title: 'SYMBOL'},
    ]
  });

  csvWriter.writeRecords(tickData)
    .then(() => console.log('Tick data has been written to CSV file'));
}

 